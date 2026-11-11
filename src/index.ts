import { createWhatsAppClient } from './adapters/whatsapp.js';
import config, { validateProductionConfig } from './config.js';
import { logger } from './logger.js';
import type { Server as HttpServer } from 'node:http';

type WhatsAppSockLike = Awaited<ReturnType<typeof createWhatsAppClient>>;
type IncomingWhatsAppMessage = Parameters<Parameters<typeof createWhatsAppClient>[0]>[0];

async function handleWhatsAppMessage({ text, sender, senderNumber, sock }: IncomingWhatsAppMessage): Promise<void> {
  logger.info({ senderNumber, len: text.length }, 'WhatsApp non-OTP message ignored');
  await sock.sendMessage(sender, {
    text: 'Agent features are disabled while this part of the project is being rebuilt. WhatsApp OTP login is still available from the dashboard.',
  });
}

let whatsappSock: WhatsAppSockLike | null = null;
let isShuttingDown = false;
/** Set by main() when dashboard is created; used by graceful shutdown to close HTTP server. */
let httpServer: HttpServer | null = null;

const SHUTDOWN_DRAIN_MS = 30000;

function setupGracefulShutdown(getHttpServer: () => HttpServer | null): void {
  const shutdown = (signal: 'SIGINT' | 'SIGTERM') => {
    if (isShuttingDown) {return;}
    isShuttingDown = true;
    logger.info({ signal }, 'Shutting down');

    let exited = false;
    function finishShutdown() {
      if (exited) {return;}
      exited = true;
      if (whatsappSock?.end) {whatsappSock.end(undefined);}
      process.exit(0);
    }

    const server = getHttpServer();
    if (server) {
      server.close(() => finishShutdown());
      setTimeout(() => finishShutdown(), SHUTDOWN_DRAIN_MS);
    } else {
      finishShutdown();
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception (kept alive)');
  });
  process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'Unhandled rejection (kept alive)');
  });
}

async function main() {
  validateProductionConfig();

  setupGracefulShutdown(() => httpServer);

  logger.info('My IDE — WhatsApp OTP & Dashboard');
  logger.info({ allowedNumbers: config.allowedNumbers.length ? '(set)' : '(none)' }, 'Allowed numbers');

  if (config.allowedNumbers.length === 0 && !config.dashboardEnabled) {
    throw new Error('Set ALLOWED_NUMBERS for WhatsApp and/or enable Dashboard (DASHBOARD_ENABLED=1)');
  }

  let dashboardSetSock: ((sock: WhatsAppSockLike | null) => void) | null = null;

  if (config.allowedNumbers.length > 0) {
    whatsappSock = await createWhatsAppClient(handleWhatsAppMessage, {
      isShuttingDown: () => isShuttingDown,
      onReconnect: (newSock: WhatsAppSockLike) => {
        whatsappSock = newSock;
        if (dashboardSetSock) {dashboardSetSock(newSock);}
      },
    });
  }
  if (config.dashboardEnabled) {
    const { createDashboardServer, setWhatsAppSock } = await import('./dashboard/server.js');
    dashboardSetSock = setWhatsAppSock;
    setWhatsAppSock(whatsappSock);
    httpServer = await createDashboardServer();
    if (!whatsappSock && config.allowedNumbers.length === 0) {
      logger.info('Dashboard requires WhatsApp for phone verification. Set ALLOWED_NUMBERS.');
    }
  }
}

main().catch((err) => {
  logger.fatal({ err }, 'Fatal error');
  process.exit(1);
});
