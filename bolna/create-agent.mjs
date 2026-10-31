#!/usr/bin/env node
/**
 * Creates (or updates) the "Disha" coaching agent in your Bolna account.
 *
 *   BOLNA_API_KEY=bn-... node bolna/create-agent.mjs            # create
 *   BOLNA_API_KEY=bn-... BOLNA_AGENT_ID=... node bolna/create-agent.mjs   # update prompt in place
 *
 * The system prompt lives in bolna/system-prompt.md — edit it there, then re-run.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.resolve(here, "../.env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const key = process.env.BOLNA_API_KEY;
const base = (process.env.BOLNA_API_BASE || "https://api.bolna.ai").replace(/\/$/, "");
if (!key) {
  console.error("Set BOLNA_API_KEY (in .env or the environment).");
  process.exit(1);
}

const cfg = JSON.parse(fs.readFileSync(path.join(here, "agent-config.json"), "utf8"));
cfg.agent_prompts.task_1.system_prompt = fs.readFileSync(path.join(here, "system-prompt.md"), "utf8");
if (process.env.PUBLIC_URL) {
  const token = process.env.WEBHOOK_TOKEN ? `?token=${encodeURIComponent(process.env.WEBHOOK_TOKEN)}` : "";
  cfg.agent_config.webhook_url = `${process.env.PUBLIC_URL.replace(/\/$/, "")}/api/webhooks/bolna${token}`;
}

const existing = process.env.BOLNA_AGENT_ID;
const res = await fetch(existing ? `${base}/v2/agent/${existing}` : `${base}/v2/agent`, {
  method: existing ? "PUT" : "POST",
  headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  body: JSON.stringify(cfg),
});
const body = await res.text();
if (!res.ok) {
  console.error(`Bolna API error ${res.status}: ${body}`);
  process.exit(1);
}
console.log(body);
if (!existing) console.log("\n✅ Agent created. Put its agent_id in .env as BOLNA_AGENT_ID.");
else console.log("\n✅ Agent updated.");
