/**
 * Dashboard WebSocket setup: terminal, chat-terminal, n8n proxy, preview proxy.
 * Called from server.ts after HTTP server is created.
 */
import * as pty from 'node-pty';
import { platform } from 'node:os';
import type { Server as HttpServer, IncomingMessage as HttpIncomingMessage } from 'node:http';
import type HttpProxyServer from 'http-proxy';
import type WebSocket from 'ws';
import config from '../config.js';
import { verifyToken } from './auth.js';
import { logger } from '../logger.js';
import { resolvePreviewTarget } from './sandbox/index.js';

const IS_WIN = platform() === 'win32';

function parseCookies(cookieStr: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const pair of cookieStr.split(';')) {
    const [k, ...v] = pair.trim().split('=');
    if (k) {cookies[k.trim()] = decodeURIComponent(v.join('='));}
  }
  return cookies;
}

function isN8nPath(pathname: string, n8nPublicPath: string): boolean {
  return pathname === n8nPublicPath || pathname.startsWith(`${n8nPublicPath}/`);
}

function isN8nRootPath(pathname: string): boolean {
  return (
    pathname === '/healthz' ||
    pathname === '/rest' ||
    pathname.startsWith('/rest/') ||
    pathname.startsWith('/types/') ||
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/static/')
  );
}

export type SetupWsOptions = {
  getCodebaseRoot: () => string;
  sandboxPreviewProxy: HttpProxyServer;
  n8nProxy: HttpProxyServer | null;
  n8nPublicPath: string;
};

export function setupTerminalWebSocket(
  server: HttpServer,
  opts: SetupWsOptions,
): void {
  const { getCodebaseRoot, sandboxPreviewProxy, n8nProxy, n8nPublicPath } = opts;

  import('ws')
    .then(({ WebSocketServer }) => {
      function handleTerminalConnection(ws: WebSocket, req: HttpIncomingMessage) {
        const cookies = parseCookies((req.headers.cookie as string) || '');
        const token = cookies.dashboard_token;
        const auth = verifyToken(token);
        if (!auth.ok) {
          logger.warn('Dashboard: Terminal WS auth failed (no/invalid token)');
          ws.close(4001, 'Unauthorized');
          return;
        }

        if (!config.terminalSshEnabled) {
          try {
            ws.send(
              '\r\n\x1b[33mTerminal disabled. Set TERMINAL_SSH_ENABLED=1 in .env to enable.\x1b[0m\r\n',
            );
          } catch {}
          ws.close(4003, 'Terminal disabled');
          return;
        }

        const keepAlive = setInterval(() => {
          if (ws.readyState === ws.OPEN) {ws.ping();}
        }, 30000);
        ws.on('close', (code, reason) => {
          clearInterval(keepAlive);
          if (code !== 1000 && code !== 1001) {
            logger.warn({ code, reason: reason?.toString?.() || reason }, 'Dashboard: Terminal WS closed');
          }
        });
        ws.on('error', (err) => {
          clearInterval(keepAlive);
          logger.warn({ err: err.message }, 'Dashboard: Terminal WS error');
        });

        const cwd = getCodebaseRoot();
        let proc: pty.IPty | null = null;
        let launched = false;
        let killedByUs = false;
        let ptyCols = 80;
        let ptyRows = 24;

        const safeEnv = Object.fromEntries(
          Object.entries(process.env).filter(
            ([k]) => !/API_KEY|SECRET|TOKEN|PASSWORD|PASSPHRASE/i.test(k),
          ),
        );

        function launch() {
          if (launched) {return;}
          launched = true;

          const shellBin = IS_WIN
            ? process.env.ComSpec || 'cmd.exe'
            : process.env.SHELL || '/bin/bash';
          const shellArgs = IS_WIN ? [] : ['-i'];

          logger.info({ shell: shellBin, cwd }, 'Dashboard: spawning PTY shell');

          try {
            proc = pty.spawn(shellBin, shellArgs, {
              name: 'xterm-256color',
              cols: ptyCols,
              rows: ptyRows,
              cwd,
              env: { ...safeEnv, TERM: 'xterm-256color' },
            });
          } catch (err: any) {
            logger.error({ err: err?.message }, 'Dashboard: PTY spawn error');
            try {
              ws.send(
                `\r\n\x1b[31mFailed to start shell: ${err?.message}\x1b[0m\r\n`,
              );
              ws.close(4002);
            } catch {}
            return;
          }

          proc.onData((data: string) => {
            try {
              ws.send(data);
            } catch {}
          });

          ws.on('close', () => {
            killedByUs = true;
            try {
              proc?.kill();
            } catch {}
          });
          ws.on('error', () => {
            killedByUs = true;
            try {
              proc?.kill();
            } catch {}
          });

          proc.onExit(({ exitCode, signal }) => {
            if (!killedByUs) {
              logger.warn({ exitCode, signal }, 'Dashboard: Terminal shell exited unexpectedly');
            }
            try {
              ws.close();
            } catch {}
          });
        }

        ws.on('message', (msg: Buffer | string) => {
          const str = msg.toString();
          if (str.startsWith('\x01resize:')) {
            // eslint-disable-next-line no-control-regex -- terminal SOH for resize
            const match = str.match(/^\x01resize:(\d+),(\d+)/);
            if (match) {
              const cols = Math.max(1, parseInt(match[1] ?? '80', 10));
              const rows = Math.max(1, parseInt(match[2] ?? '24', 10));
              ptyCols = cols;
              ptyRows = rows;
              if (proc) {proc.resize(cols, rows);}
            }
            if (!launched) {launch();}
            return;
          }
          if (!launched) {launch();}
          if (proc) {proc.write(str);}
        });

        launch();
      }

      const wsOpts = { noServer: true, perMessageDeflate: false };
      const wss = new WebSocketServer(wsOpts);
      wss.on('connection', handleTerminalConnection);
      const wssChatTerm = new WebSocketServer(wsOpts);
      wssChatTerm.on('connection', handleTerminalConnection);

      server.on('upgrade', (req, socket, head) => {
        const path = ((req.url || '').split('?')[0] ?? '');
        if (path === '/ws/terminal') {
          wss.handleUpgrade(req, socket, head, (ws) =>
            wss.emit('connection', ws, req),
          );
        } else if (path === '/ws/chat-terminal') {
          wssChatTerm.handleUpgrade(req, socket, head, (ws) =>
            wssChatTerm.emit('connection', ws, req),
          );
        } else if (
          config.n8nEnabled &&
          n8nProxy &&
          (isN8nPath(path, n8nPublicPath) || isN8nRootPath(path))
        ) {
          if (isN8nPath(path, n8nPublicPath))
          {req.url =
              (path.slice(n8nPublicPath.length) || '/') +
              ((req.url || '').includes('?')
                ? '?' + (req.url || '').split('?')[1]
                : '');}
          req.headers['x-forwarded-host'] = req.headers.host || '';
          req.headers['x-forwarded-proto'] = req.headers['x-forwarded-proto'] || 'http';
          n8nProxy.ws(req, socket, head, { target: config.n8nInternalUrl });
        } else {
          const pathMatch = path.match(/^\/api\/previews\/([^/]+)(\/.*)?$/);
          if (pathMatch) {
            const previewId = pathMatch[1];
            if (!previewId) {socket.destroy(); return;}
            const pathSuffix = pathMatch[2] || '/';
            const target = resolvePreviewTarget(previewId);
            if (target) {
              req.url = target.basePath ? path : pathSuffix;
              sandboxPreviewProxy.ws(req, socket, head, {
                target: `http://${target.host}:${target.port}`,
              });
              return;
            }
          }
          socket.destroy();
        }
      });
    })
    .catch((err) => {
      logger.warn({ err: err.message }, 'Dashboard: ws not available, terminal disabled');
    });
}
