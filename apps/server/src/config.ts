import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  port: Number(process.env.PORT ?? 8787),
  bolnaApiKey: process.env.BOLNA_API_KEY ?? "",
  bolnaAgentId: process.env.BOLNA_AGENT_ID ?? "",
  bolnaApiBase: (process.env.BOLNA_API_BASE ?? "https://api.bolna.ai").replace(/\/$/, ""),
  corsOrigins: (process.env.CORS_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  webhookToken: process.env.WEBHOOK_TOKEN ?? "",
  geminiApiKey: process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  dataFile: process.env.DATA_FILE ?? path.resolve(here, "../data/db.json"),
  webDist: process.env.WEB_DIST ?? path.resolve(here, "../../web/dist"),
};

export const insightsProvider = config.geminiApiKey
  ? "gemini"
  : config.anthropicApiKey
    ? "anthropic"
    : config.openaiApiKey ? "openai" : "bolna";
