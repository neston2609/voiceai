#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../backend"
DATABASE_URL="${DATABASE_URL_PROD:?DATABASE_URL_PROD required}" npx prisma migrate deploy
