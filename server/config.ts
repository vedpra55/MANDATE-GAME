import 'dotenv/config';

export type ServerConfig = {
  port: number;
  /** Server-side only. Never send this to the client or log it. */
  openaiApiKey: string | undefined;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const port = Number(env.SERVER_PORT ?? 8787);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`SERVER_PORT must be a positive integer, got "${env.SERVER_PORT}"`);
  }
  const key = env.OPENAI_API_KEY?.trim();
  return { port, openaiApiKey: key ? key : undefined };
}
