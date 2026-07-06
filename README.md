# Voice AI Bot Flow Builder

Production-oriented full-stack app for designing, configuring, simulating, and monitoring AI voice bot flows for FreePBX/Asterisk. The app defaults to Live Mode and reports missing credentials or connection failures instead of silently using demo data.

## Quick Start

1. Copy environment files:
   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start both apps:
   ```bash
   npm run dev
   ```
4. Open `http://localhost:5173`.
5. Login with `admin@local` and the value of `DEFAULT_ADMIN_PASSWORD`.

## Database

The Prisma schema targets PostgreSQL and contains the production data model requested for organizations, users, credentials, flows, sessions, transcripts, provider logs, audit logs, settings, and backup jobs.

For local Docker development:

```bash
docker compose up --build
```

For direct PostgreSQL setup:

```bash
cd scripts
./setup-db.sh
```

## Live Mode Flow

By default, `MOCK_MODE` is disabled:

- AI provider tests call the configured AI provider.
- Dialogflow tests use uploaded Google service account JSON for Google auth, Dialogflow, and Thai TTS.
- FreePBX/Asterisk tests call the configured ARI endpoint.
- Dashboard and call sessions use live backend records only.
- Missing AI, Dialogflow, or ARI credentials are shown as actionable service health states.

For isolated development only, set `MOCK_MODE=true` explicitly.

## Production Notes

- Never hardcode database passwords, AI keys, Google service account JSON, ARI credentials, JWT secrets, or encryption keys.
- Store secrets in env variables and encrypted database columns.
- Use `ENCRYPTION_KEY` as a 32-byte value in production.
- Route inbound FreePBX DIDs or extensions to `Stasis(voicebot-app)` after enabling ARI.
- Put the frontend behind Nginx and proxy `/api` to the backend.

Detailed docs live in `docs/`.
