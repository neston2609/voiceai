# API

The backend exposes REST APIs under `/api`.

Implemented live-ready endpoints:

- `POST /api/auth/login`
- `POST /api/auth/change-password`
- `GET /api/auth/me`
- `GET /api/dashboard/summary`
- `GET /api/dashboard/charts`
- `GET /api/ai-providers`
- `POST /api/ai-providers`
- `PATCH /api/ai-providers/:id`
- `POST /api/ai-providers/:id/test`
- `GET /api/prompts`
- `GET /api/flows`
- `POST /api/flows/:id/validate`
- `POST /api/flows/:id/publish`
- `POST /api/runtime/simulate-call`
- `GET /api/call-sessions`
- `GET /api/call-sessions/:id/logs`
- `GET /api/call-sessions/:id/transcript`
- `GET /api/call-sessions/:id/provider-requests`
- `GET /api/audit-logs`
- `GET /api/dialogflow-configs`
- `PATCH /api/dialogflow-configs/:id`
- `POST /api/dialogflow-configs/:id/upload-service-account`
- `POST /api/dialogflow-configs/:id/test`
- `GET /api/asterisk-configs`
- `PATCH /api/asterisk-configs/:id`
- `POST /api/asterisk-configs/:id/test`
- `GET /api/system/health`

Every request receives an `x-correlation-id` response header.
