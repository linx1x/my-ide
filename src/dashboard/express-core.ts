/**
 * Dashboard Express stack: trust proxy, Helmet/CSP, CORS, health, rate limits, body parsers.
 */
import express from 'express';
import type { Application, Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import config from '../config.js';
import { registerHealthRoutes } from './routes/health.js';
import { isN8nRelatedRequest } from './n8n-proxy-mount.js';
import { isLangfusePath } from './langfuse-proxy-mount.js';

const skipJsonPaths = [
  '/api/voice/transcribe',
  '/api/previews',
];

export function registerDashboardExpressCore(app: Application) {
  app.set('trust proxy', config.trustProxyHops);

  app.use((req: Request & { id?: string }, res: Response, next: NextFunction) => {
    req.id = req.get('X-Request-Id') || randomUUID();
    next();
  });

  app.use(
    compression({
      // SSE must not be gzip-buffered or EventSource may never open / updates stall.
      filter(req: Request, res: Response) {
        const path = String(req.path || req.url || '').split('?')[0] ?? '';
        return compression.filter(req, res);
      },
    }),
  );

  const previewPortMin = Math.max(3000, config.previewPortMin ?? 5173);
  const previewPortMax = Math.min(65535, config.previewPortMax ?? 5199);
  const previewFrameSrc = [
    "'self'",
    'https://*.codesandbox.io',
    'https://preview.sandpack-static-server.codesandbox.io',
  ];
  for (let p = previewPortMin; p <= previewPortMax; p++) {
    previewFrameSrc.push(`http://localhost:${p}`, `http://127.0.0.1:${p}`);
  }

  const helmetMiddleware = helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          'https://cdnjs.cloudflare.com',
          'https://cdn.jsdelivr.net',
          'https://static.cloudflareinsights.com',
          "'wasm-unsafe-eval'",
          "'sha256-lEKV1wCTzKX3XUMA/9EKdQgsHu/CsmUrUEcWe417yoA='",
          "'sha256-VvzCmjrDoXTuv8ECEL//y+RpsCqpFP9xpz5sQ12sVKg='",
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://cdn.jsdelivr.net',
          'https://fonts.googleapis.com',
        ],
        imgSrc: [
          "'self'",
          'data:',
          'blob:',
          // Marketing pages (e.g. public/bridge-landing.html) load hero imagery from CDNs.
          'https://images.unsplash.com',
          'https://plus.unsplash.com',
        ],
        connectSrc: [
          "'self'",
          'ws:',
          'wss:',
          'blob:',
          'https://www.google.com',
          'https://*.google.com',
          'https://*.googleapis.com',
          'https://static.cloudflareinsights.com',
        ],
        fontSrc: [
          "'self'",
          'data:',
          'https://cdnjs.cloudflare.com',
          'https://cdn.jsdelivr.net',
          'https://fonts.gstatic.com',
        ],
        objectSrc: ["'none'"],
        frameSrc: previewFrameSrc,
        workerSrc: ["'self'", 'blob:'],
        frameAncestors: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (config.n8nEnabled && isN8nRelatedRequest(req)) {return next();}
    if (req.path.startsWith('/api/previews/')) {return next();}
    return helmetMiddleware(req, res, next);
  });

  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Permissions-Policy', 'microphone=(self)');
    next();
  });

  const baseUrlOrigin = (() => {
    try {
      const u = new URL(config.dashboardBaseUrl || '');
      if (u.protocol === 'https:' && u.hostname !== 'localhost') {return u.origin;}
    } catch {
      /* ignore */
    }
    return null;
  })();
  const localOrigins = [
    `http://localhost:${config.dashboardPort}`,
    `http://127.0.0.1:${config.dashboardPort}`,
  ];
  const corsOrigins = [
    ...config.dashboardCorsOrigins,
    ...(baseUrlOrigin ? [baseUrlOrigin] : []),
    ...localOrigins,
  ].filter((o, i, a) => a.indexOf(o) === i);

  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) {return cb(null, true);}
        if (corsOrigins.includes(origin)) {return cb(null, origin);}
        if (config.dashboardCorsStrict) {return cb(new Error('CORS: origin not allowed'));}
        if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {return cb(null, origin);}
        return cb(new Error('CORS: origin not allowed'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-Id'],
    }),
  );

  registerHealthRoutes(app);

  const authLimiter = rateLimit({
    windowMs: config.dashboardAuthRateLimitWindowMs,
    max: config.dashboardAuthRateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many auth attempts. Try again later.' },
    skip: (req: Request) => req.method === 'OPTIONS',
  });

  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Rate limit exceeded. Slow down.' },
  });

  const searchLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Search rate limit exceeded.' },
  });

  const completionLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Code completion rate limit exceeded.' },
  });

  const voiceLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Voice transcription rate limit exceeded. Try again in a minute.',
    },
  });

  const uploadLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Upload rate limit exceeded.' },
  });

  const skillsSearchLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Skills search rate limit exceeded.' },
  });

  app.use('/api/auth', authLimiter);
  app.use('/api/editor/complete', completionLimiter);
  app.use('/api/search', searchLimiter);
  app.use('/api/skills/search', skillsSearchLimiter);
  app.use('/api/skills/ai-search', skillsSearchLimiter);
  app.use('/api', apiLimiter);

  const limiters = {
    auth: authLimiter,
    api: apiLimiter,
    search: searchLimiter,
    completion: completionLimiter,
    voice: voiceLimiter,
    upload: uploadLimiter,
    skillsSearch: skillsSearchLimiter,
  };

  return { corsOrigins, limiters };
}

export function registerDashboardBodyParsers(app: Application) {
  app.use(cookieParser());
  const jsonParser = express.json({ limit: '1mb' });
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (config.n8nEnabled && isN8nRelatedRequest(req)) {return next();}
    if (config.langfuseEnabled && isLangfusePath((req.path || req.url || '').split('?')[0])) {return next();}
    if (skipJsonPaths.includes(req.path)) {return next();}
    return jsonParser(req, res, next);
  });
}
