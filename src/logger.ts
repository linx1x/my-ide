/**
 * Shared logger for bridge and dashboard. Uses Pino; level from config.logLevel.
 * Redacts common secret keys so accidental logging of bodies/config does not leak secrets.
 */
import pino from 'pino';
import config from './config.js';

const redactPaths = [
  'apiKey',
  'api_key',
  'token',
  'secret',
  'password',
  'authorization',
  'cookie',
  '*.apiKey',
  '*.api_key',
  '*.token',
  '*.secret',
  '*.password',
  '*.authorization',
  '*.cookie',
];

export const logger = pino({
  level: config.logLevel,
  redact: {
    paths: redactPaths,
    censor: '[REDACTED]',
  },
});
