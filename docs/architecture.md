# Architecture

Voice AI Bot Flow Builder is organized as a monorepo with a TypeScript backend, React/Vite frontend, Prisma schema, setup scripts, and operations docs.

The backend exposes REST APIs under `/api`, isolates real integrations behind adapters, and defaults to Live Mode for AI chat, Dialogflow/Google Voice, and FreePBX/Asterisk ARI. The runtime path creates a call session, logs node-by-node execution, records transcript lines, stores masked provider requests, and returns the whole result to the UI.

Primary modules:

- Auth, users, organizations, roles, and audit logs
- AI provider configuration and prompt management
- Dialogflow/Google Voice adapter boundary
- FreePBX/Asterisk ARI adapter boundary
- Flow builder validation, versioning, and publication
- Live runtime test engine and call session observability
- Dashboard, system settings, and backup support

The current app prioritizes real configuration and honest health states. Missing AI keys, Google service account JSON, or ARI connectivity are reported as configuration failures instead of being hidden by demo data.
