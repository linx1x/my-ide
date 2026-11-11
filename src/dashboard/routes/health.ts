/**
 * Health / readiness endpoints (no auth). For load balancers, Docker HEALTHCHECK, K8s probes.
 * /health — liveness (process up). /ready — readiness (dashboard process ready).
 */
import type express from 'express';

export function registerHealthRoutes(app: express.Application): void {
  app.get('/health', (_req, res) => {
    res.status(200).json({ ok: true, dashboard: true });
  });
  app.get('/ready', (_req, res) => {
    res.status(200).json({ ok: true, dashboard: true });
  });
}
