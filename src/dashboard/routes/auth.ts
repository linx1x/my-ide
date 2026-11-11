/**
 * Auth API routes: request-otp, verify-otp, logout.
 */
import type express from 'express';
import { requestOTP, verifyOTP, revokeToken } from '../auth.js';
import type { DashboardContext } from '../context.js';

export function registerAuthRoutes(app: express.Application, ctx: DashboardContext): void {
  const { getWhatsAppSock } = ctx;

  app.post('/api/auth/request-otp', async (req, res) => {
    try {
      const { phone } = req.body || {};
      if (typeof phone !== 'string' || !phone) {return res.status(400).json({ error: 'Phone number required' });}
      const result = await requestOTP(phone, getWhatsAppSock());
      if (!result.ok) {return res.status(400).json({ error: result.error });}
      res.json({ message: 'Code sent to your WhatsApp' });
    } catch (err) {
      console.error('[Dashboard] request-otp error:', err);
      res.status(500).json({ error: 'Failed to send code. Check server logs and ensure your number is in ALLOWED_NUMBERS and WhatsApp is connected.' });
    }
  });

  app.post('/api/auth/verify-otp', (req, res) => {
    try {
      const { phone, code } = req.body || {};
      if (typeof phone !== 'string' || typeof code !== 'string' || !phone || !code) {return res.status(400).json({ error: 'Phone and code required' });}
      const result = verifyOTP(phone, code);
      if (!result.ok) {return res.status(400).json({ error: result.error });}
      const isSecure = req.secure || (req.headers['x-forwarded-proto'] === 'https');
      res
        .cookie('dashboard_token', result.token, {
          httpOnly: true,
          secure: isSecure,
          sameSite: 'lax',
          maxAge: 12 * 60 * 60 * 1000,
        })
        .json({ ok: true });
    } catch (err) {
      console.error('[Dashboard] verify-otp error:', err);
      res.status(500).json({ error: 'Verification failed. Try again.' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    const token = req.cookies?.dashboard_token || req.headers.authorization?.replace(/^Bearer\s+/i, '');
    revokeToken(token);
    res.clearCookie('dashboard_token').json({ ok: true });
  });
}
