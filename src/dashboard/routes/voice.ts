/**
 * Voice API routes: transcribe.
 */
import express from 'express';
import config from '../../config.js';
import type { DashboardContext } from '../context.js';

export function registerVoiceRoutes(app: express.Application, ctx: DashboardContext): void {
  const { authMiddleware, limiters } = ctx;

  app.post('/api/voice/transcribe', limiters.voice, authMiddleware, express.json({ limit: '10mb' }), async (req, res) => {
    if (!config.voiceEnabled) {
      return res.status(400).json({ error: 'Voice transcription disabled. Set VOICE_ENABLED=1 in .env.' });
    }
    const { audio, mimetype = 'audio/webm' } = req.body || {};
    if (!audio || typeof audio !== 'string') {
      return res.status(400).json({ error: 'audio (base64) required' });
    }
    try {
      const buffer = Buffer.from(audio, 'base64');
      const { transcribeVoice } = await import('../../adapters/voice.js');
      const text = await transcribeVoice(buffer, mimetype);
      res.json({ text: text || '' });
    } catch (err) {
      console.error('[Dashboard] Voice transcribe error:', (err as Error).message);
      res.status(500).json({ error: (err as Error).message });
    }
  });
}
