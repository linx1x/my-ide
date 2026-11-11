// Baileys 7.x: https://github.com/WhiskeySockets/Baileys | Docs: https://baileys.wiki | Migration: https://whiskey.so/migrate-latest
import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  makeCacheableSignalKeyStore,
  fetchLatestWaWebVersion,
} from '@whiskeysockets/baileys';
import { getContentType } from '@whiskeysockets/baileys';
import type { proto } from '@whiskeysockets/baileys';
import pino from 'pino';
import { Writable } from 'node:stream';
import QRCode from 'qrcode';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';
import config from '../config.js';

// Suppress known-harmless Baileys noise (non-fatal init query rejections from WA server)
// "url generation failed": Baileys tries to fetch link previews; agent output like "file-tree.json"
// gets misparsed as a URL hostname, causing FetchError — we use linkPreview: false so preview isn't sent
const SUPPRESS_MSGS = new Set([
  "unexpected error in 'init queries'",
  'url generation failed',
]);
const filteredStdout = new Writable({
  write(chunk: Buffer | string, _enc, cb) {
    try {
      const obj = JSON.parse(chunk.toString());
      if (!SUPPRESS_MSGS.has(obj.msg)) {process.stdout.write(chunk);}
    } catch { process.stdout.write(chunk); }
    cb();
  },
});
const logger = pino({ level: 'warn' }, filteredStdout);

function openFile(filePath: string): boolean {
  const cmd =
    process.platform === 'win32'
      ? `start "" "${filePath}"`
      : process.platform === 'darwin'
        ? `open "${filePath}"`
        : `xdg-open "${filePath}"`;
  try {
    execSync(cmd, { stdio: 'ignore' });
  } catch {
    return false;
  }
  return true;
}

async function saveAndOpenQR(qrData: string): Promise<void> {
  const QR_IMAGE_PATH = resolve(process.cwd(), 'qr-code.png');
  await QRCode.toFile(QR_IMAGE_PATH, qrData, {
    type: 'png',
    width: 800,
    margin: 4,
    color: { dark: '#000000', light: '#ffffff' },
  });

  const isDockerOrHeadless = process.env.DOCKER || !process.stdin.isTTY;

  if (isDockerOrHeadless) {
    const qrcodeTerminal = await import('qrcode-terminal').then((m) => m.default);
    console.log('\n Scan this QR code with WhatsApp:');
    console.log(' Settings → Linked Devices → Link a Device');
    console.log(` Or open this file: ${QR_IMAGE_PATH}\n`);
    qrcodeTerminal.generate(qrData, { small: true });
    return;
  }

  console.log('\n┌─────────────────────────────────────────┐');
  console.log(`│  QR code saved to: ${QR_IMAGE_PATH}`);
  console.log('│  Scan it with WhatsApp:                 │');
  console.log('│  Settings > Linked Devices > Link       │');
  console.log('└─────────────────────────────────────────┘\n');

  if (!openFile(QR_IMAGE_PATH)) {
    console.log('Could not auto-open. Open the file manually:', QR_IMAGE_PATH);
  }
}

// Track IDs of messages we sent, to avoid processing our own replies (echo loop)
const sentMessageIds = new Set();

type IncomingMessagePayload = {
  text: string;
  sender: string;
  senderNumber: string;
  sock: Awaited<ReturnType<typeof makeWASocket>>;
  msg: unknown;
};

type CreateClientOptions = {
  onReconnect?: (sock: Awaited<ReturnType<typeof makeWASocket>>) => void;
  isShuttingDown?: () => boolean;
};

export async function createWhatsAppClient(
  onMessage: (payload: IncomingMessagePayload) => Promise<void>,
  { onReconnect, isShuttingDown }: CreateClientOptions = {},
): Promise<Awaited<ReturnType<typeof makeWASocket>>> {
  const { state, saveCreds } = await useMultiFileAuthState(
    config.authStorePath
  );

  if (config.allowedNumbers.length === 0) {
    throw new Error(
      'ALLOWED_NUMBERS must be set in .env (your WhatsApp number with country code, no +). E.g. ALLOWED_NUMBERS=33612345678'
    );
  }

  // In-memory store for sent messages so Baileys can serve retry requests.
  // Without this, every message triggers "could not send message again, as it was not found"
  // and the phone never displays the message (it discards undecryptable messages).
  const sentMessageStore = new Map<string, proto.IMessage>();
  const msgId = (k: { id?: unknown } | null | undefined): string | null => (k?.id !== null && k?.id !== undefined ? String(k.id) : null);

  let reconnectAttempts = 0;
  const RECONNECT_BACKOFF_MS = [3000, 6000, 12000, 24000, 30000];
  const RECONNECT_HINT_AFTER = 5;

  async function startSocket() {
    // Fetch latest WhatsApp Web version so connection gets to QR (avoids 405 from stale pinned version)
    const version =
      config.waVersion ||
      (await fetchLatestWaWebVersion().then((r) => r.version).catch(() => undefined));
    if (version && process.env.DEBUG_WHATSAPP_VERSION) {
      console.log('[WhatsApp] version:', version.join('.'));
    }
    const socketConfig: any = {
      ...(version && { version }),
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      printQRInTerminal: false,
      logger,
      // Provide sent messages for retry re-encryption (multi-device delivery requirement).
      // Normalize key.id to string so lookup matches store (key can come as Buffer or string).
      getMessage: async (key: { id?: unknown }) => {
        const id = msgId(key);
        const found = id ? sentMessageStore.get(id) : undefined;
        if (process.env.DEBUG_WHATSAPP_SEND) {
          console.log(`[WhatsApp] getMessage(${id}) → ${found ? 'found' : 'MISSING'}`);
        }
        return found as proto.IMessage | undefined;
      },
    };
    const sock = makeWASocket(socketConfig);

    // Wrap sendMessage to track sent messages (retry store + echo loop prevention)
    const originalSendMessage = sock.sendMessage.bind(sock);
    sock.sendMessage = async function (jid, content, ...args) {
      let result: Awaited<ReturnType<typeof originalSendMessage>> | undefined;
      try {
        result = await originalSendMessage(jid, content, ...args);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[WhatsApp] sendMessage failed:', message);
        throw err;
      }
      const id = msgId(result?.key);
      if (id) {
        // Store message proto for retry re-encryption (10 min TTL)
        const messageProto = result?.message;
        if (messageProto) {
          sentMessageStore.set(id, messageProto);
          setTimeout(() => sentMessageStore.delete(id), 10 * 60 * 1000);
        }
        // Track sent ID to skip our own echo
        const echoKey = `${jid}:${id}`;
        sentMessageIds.add(echoKey);
        setTimeout(() => sentMessageIds.delete(echoKey), 60000);
      }
      return result;
    };

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        await saveAndOpenQR(qr);
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;
        const shuttingDown = typeof isShuttingDown === 'function' && isShuttingDown();

        if (!shuttingDown) {
          const delay =
            RECONNECT_BACKOFF_MS[Math.min(reconnectAttempts, RECONNECT_BACKOFF_MS.length - 1)];
          reconnectAttempts += 1;
          console.log(
            `Connection closed (status: ${statusCode}).`,
            loggedOut ? 'Logged out. Delete auth_store/ and restart.' : `Reconnecting in ${(delay ?? 0) / 1000}s...`
          );
          if (
            !loggedOut &&
            reconnectAttempts >= RECONNECT_HINT_AFTER &&
            (statusCode === 405 || statusCode === 401 || statusCode === 403)
          ) {
            console.log(
              'Tip: If this keeps failing, try 1) Delete auth_store/ and re-scan QR, or 2) Set WA_VERSION in .env (e.g. WA_VERSION="[2,3000,1023223821]").'
            );
          }
        }

        if (!loggedOut && !shuttingDown) {
          const delay =
            RECONNECT_BACKOFF_MS[Math.min(reconnectAttempts - 1, RECONNECT_BACKOFF_MS.length - 1)];
          setTimeout(async () => {
            if (typeof isShuttingDown === 'function' && isShuttingDown()) {return;}
            const newSock = await startSocket();
            if (onReconnect) {onReconnect(newSock);}
          }, delay ?? 0);
        }
      }

      if (connection === 'open') {
        reconnectAttempts = 0;
        console.log('\n✓ WhatsApp connected! Bridge is live.\n');
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') {return;}

      for (const msg of messages) {
        if (!msg.message) {continue;}

        // Prefer PN JID for DMs when available (6.8+ remoteJidAlt); else normalize @lid so sending works.
        const rawRemoteJid = msg.key.remoteJid ?? '';
        const sender =
          (msg.key.remoteJidAlt && /@s\.whatsapp\.net$/.test(msg.key.remoteJidAlt)
            ? msg.key.remoteJidAlt
            : null) ||
          (/^\d+@lid$/.test(rawRemoteJid) ? rawRemoteJid.replace(/@lid$/, '@s.whatsapp.net') : rawRemoteJid);

        // Skip our own sent messages (prevents echo loop).
        // Use normalized sender so @lid echos of @s.whatsapp.net sends are matched correctly.
        const msgKey = `${sender ?? ''}:${msg.key.id ?? ''}`;
        if (sentMessageIds.has(msgKey)) {continue;}
        const senderId = (msg.key.participant || rawRemoteJid || '').replace(
          /@(s\.whatsapp\.net|g\.us|lid)/,
          ''
        );
        const senderNumber = senderId.split('@')[0] ?? '';

        // fromMe = you sent from your phone; always allow (it's your account)
        // Otherwise, only allow if sender matches ALLOWED_NUMBERS (phone or LID format)
        const isFromMe = msg.key.fromMe === true;
        const senderNorm = senderNumber.replace(/[\s+]/g, '');
        const isAllowedNumber = config.allowedNumbers.some(
          (n) => senderNorm === n || senderId.startsWith(n) || n === senderId
        );
        if (!isFromMe && !isAllowedNumber) {
          console.log(`Blocked message from unauthorized number: ${senderId}`);
          continue;
        }

        // For self-chat (fromMe), use PN JID for reply. 7.x: sock.user?.id may be LID; we use numeric part or first allowed number.
        let replyToJid = sender ?? `${config.allowedNumbers[0] ?? ''}@s.whatsapp.net`;
        if (isFromMe) {
          const ownPhone = sock.user?.id ? String(sock.user.id).replace(/:.*/, '').replace(/@.*/, '') : '';
          const replyPhone = config.allowedNumbers.includes(ownPhone) ? ownPhone : config.allowedNumbers[0];
          if (replyPhone) {replyToJid = `${replyPhone}@s.whatsapp.net`;}
        }

        const contentType = getContentType(msg.message);
        const text =
          msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          '';

        if (contentType === 'audioMessage') {
          await sock.sendMessage(replyToJid, {
            text: "Voice messages aren't supported. Send text instead.",
          });
          continue;
        }

        if (!text.trim()) {continue;}

        const fromMeTag = msg.key.fromMe ? ' [fromMe→replying to self-chat]' : '';
        console.log(`← [WhatsApp] ${senderNumber}${fromMeTag}: ${text}`);
        if (process.env.DEBUG_WHATSAPP_SEND && replyToJid !== sender) {
          console.log(`[WhatsApp] self-chat: replying to ${replyToJid} (raw) instead of ${sender}`);
        }

        try {
          await onMessage({ text, sender: replyToJid, senderNumber, sock, msg });
        } catch (err: unknown) {
          console.error('Error handling message:', err);
          const message = err instanceof Error ? err.message : String(err);
          await sock.sendMessage(replyToJid, {
            text: `⚠️ Error: ${message}`,
          });
        }
      }
    });

    return sock;
  }

  return await startSocket();
}
