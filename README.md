# Disha — a voice-first AI life & career coach

**Disha** (Hindi for *direction*) is an AI coach and mentor that you talk to with your voice, right in the browser.
It helps you reflect on your actions, untangle tough decisions, and grow personally and professionally.
Every conversation ends with insights, next steps and a journal entry, and Disha **remembers** what you talked about
and follows up next time.

Built for the **Bolna.ai Buildathon**. All voice runs on **Bolna Voice AI**, using the browser **Web Call SDK**
(`@bolna/web-call`, WebRTC). There are no phone calls.

## Features

- 🎙️ **Real-time voice conversation in the browser.** Bolna web calls run over WebRTC with Opus, echo cancellation and barge-in, so you can interrupt anytime.
- 🧭 **Five coaching modes, one coach:** Life Coach · Career Coach · Personality Coach · Decision Coach · Daily Reflection.
  One Bolna agent is configured per call through dynamic variables (`user_data`).
- 🧠 **Memory across sessions.** Recent summaries, commitments and suggested follow-ups go into the next call's prompt.
  Disha checks in on what you committed to.
- 📓 **Post-call reflection.** Summary, key insights, action items (checkable), mood and confidence, plus the full transcript.
- 🔥 **Journal and stats:** sessions, minutes, day streak, average mood.
- 🛟 **Safety guardrails.** Disha is a coach, not a therapist. Crisis language triggers helpline guidance (Tele-MANAS 14416 / KIRAN in India).
- 📱 **Mobile-ready architecture.** Domain logic, API client and coaching modes live in a platform-agnostic `@disha/core` package. Voice is behind a `VoiceClient` interface.

## Architecture

```
┌──────────── Browser (React + Vite) ────────────┐         ┌────────── Bolna ──────────┐
│ Pick mode → POST /api/bolna-session ───────────┼──▶ server ──▶ POST /web-call/freeswitch-session
│                                                │         │   (bn- key, agent_id, user_data:
│ @bolna/web-call  ◀── single-use SIP creds ─────┼─────────│    name, mode, goal, memory)
│        ═══════════ WebRTC audio (Opus) ════════╪═════════╪══▶ Disha agent (STT → LLM → TTS)
│ call ends → /sessions/:id (polls) ─────────────┼──▶ server ──▶ GET /executions/:id  (or webhook)
│   summary · insights · action items · transcript│         │   transcript, summary, extracted_data
└────────────────────────────────────────────────┘         └───────────────────────────┘
```

```
packages/core   @disha/core: shared types, coaching modes, memory builder, transcript parser, API client
apps/server     Express API: mints Bolna sessions, stores sessions, webhook, insights; serves the web build
apps/web        React web app: landing, mode picker, live call UI (voice orb), reflection, journal
bolna/          Agent system prompt, agent config, create/update script
```

- **The API key never reaches the browser.** The server mints a short-lived (~120s), single-use web-call session per call.
- **One agent, many personas.** `{user_name}`, `{coach_mode}`, `{mode_guidance}`, `{session_goal}`, `{memory}` are filled in per call.
- **Post-call insights** come from the first available source, in this order:
  1. Bolna `extracted_data` (if you add an extraction prompt in the Bolna dashboard; see `bolna/extraction-prompt.md`).
  2. An LLM pass over the transcript, if you set `GEMINI_API_KEY` (Google AI Studio), `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`.
  3. Bolna's built-in call summary (enabled on the agent).
- **Storage** is a JSON file behind a `Store` interface (`apps/server/src/store.ts`). Swap in Postgres or Supabase by implementing four methods.
- **Identity** is an anonymous device id (UUID in `localStorage`, sent as `X-User-Id`). Replace it with real auth before going beyond the MVP.

## Run locally

Requires Node 20+.

```bash
cp .env.example .env          # set BOLNA_API_KEY (bn-...) and BOLNA_AGENT_ID
npm install
npm run dev                   # server :8787 + web :5173 (proxying /api)
```

Open http://localhost:5173, pick a coach and press **Start voice session**. The browser will ask for microphone access.

Production build (single process serving API and web):

```bash
npm run build && npm start    # http://localhost:8787
```

### Bolna setup

1. **Agent.** The Disha agent already exists in the connected Bolna account (`acc0ced2-24b6-49f9-ac37-db3b0e0f43fc`).
   To create it in another account: `BOLNA_API_KEY=bn-... npm run setup:agent`.
   To push prompt edits from `bolna/system-prompt.md` to the existing agent, set `BOLNA_AGENT_ID` and run it again.
2. **Web calls.** The browser SDK is in beta. If starting a session fails with a capacity or "not enabled" error,
   ask Bolna support (Slack or email) to enable web calls for your account.
3. **Webhook (optional, recommended in production).** Set the agent's webhook URL to
   `https://<your-host>/api/webhooks/bolna?token=<WEBHOOK_TOKEN>`. Without it, the app polls `GET /executions/:id`, which works fine for the MVP.
4. **Richer insights (optional).** Either add an extraction prompt (`bolna/extraction-prompt.md`) in the agent's Analytics tab,
   or set `GEMINI_API_KEY` (Google AI Studio), `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` on the server.

## Deploy

- **Render:** a `render.yaml` is included. Connect the repo, set `BOLNA_API_KEY`, and deploy.
  HTTPS is required for microphone access, and Render provides it.
- **Docker:** `docker build -t disha . && docker run -p 8787:8787 --env-file .env disha`
- The free-tier filesystem is ephemeral, so journal data resets on redeploy. Mount a disk (`DATA_FILE=/data/db.json`) or plug in a database.

## Mobile app (next)

The codebase is set up so a React Native / Expo app can reuse most of it:

- `@disha/core` (types, modes, memory, `createApiClient(baseUrl)`) is plain TypeScript with no DOM dependency at runtime.
- The server is a plain JSON REST API. Point the app at it via `baseUrl` and enable `CORS_ORIGINS` if needed.
- Voice sits behind `apps/web/src/voice/VoiceClient.ts`. A native implementation can use `react-native-webrtc` + SIP.js,
  the same stack `@bolna/web-call` uses, or embed the web call in a WebView as a fast first version.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | API (tsx watch) and web (Vite) with hot reload |
| `npm run build` | Build the web app into `apps/web/dist` |
| `npm start` | Serve API and built web app |
| `npm run typecheck` | Type-check all packages |
| `npm test` | Unit tests for core logic (transcript parsing, insights, memory, stats) |
| `npm run setup:agent` | Create or update the Bolna agent from `bolna/` |
