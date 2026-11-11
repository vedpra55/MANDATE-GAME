import express from 'express';
import type { ServerConfig } from './config.ts';
import { aiRouter, settingsRouter } from './ai/routes.ts';

/**
 * The AI proxy. It holds the OpenAI key and will expose the Judge and Voice
 * endpoints. For now it has only a health check.
 */
export function createApp(config: ServerConfig) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'mandate-ai-proxy',
      // Reports only whether a key is present, never the key itself.
      openaiConfigured: Boolean(config.openaiApiKey),
    });
  });

  app.use('/api/ai', aiRouter(config.openaiApiKey));
  app.use(
    '/api',
    settingsRouter(config.openaiApiKey, { allowSettingsWrite: config.allowSettingsWrite }),
  );

  app.use('/api', (_req, res) => {
    res.status(404).json({ ok: false, error: 'not_found' });
  });

  return app;
}
