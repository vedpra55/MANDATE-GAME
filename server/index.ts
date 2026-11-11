import { createApp } from './app.ts';
import { loadConfig } from './config.ts';

const config = loadConfig();
const app = createApp(config);

app.listen(config.port, () => {
  console.log(`[server] AI proxy listening on http://localhost:${config.port}`);
  if (!config.openaiApiKey) {
    console.warn('[server] OPENAI_API_KEY is not set; AI endpoints will use fallbacks.');
  }
});
