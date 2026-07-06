# Deployment

## Local

Run local development with:

```bash
npm install
npm run dev
```

Backend runs on `http://localhost:3001`; frontend runs on `http://localhost:5173`.

## Docker Compose

```bash
docker compose up --build
```

This starts local Postgres, Redis, backend, and frontend. The compose file uses development placeholder credentials only.

## Production

1. Create strong secrets for `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `ENCRYPTION_KEY`.
2. Set `DATABASE_URL_PROD` to the production PostgreSQL database.
3. Run `npm --workspace backend run prisma:generate`.
4. Run `npx prisma migrate deploy` from `backend`.
5. Run `npm --workspace backend run seed` once to create the default organization/admin.
6. Put Nginx or another reverse proxy in front of the frontend and backend.
7. Proxy `/api` to the backend service.

Never commit `.env` files or real provider credentials.
