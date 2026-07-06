#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../backend"
DATABASE_URL="${DATABASE_URL_DEV:-${DATABASE_URL:?DATABASE_URL or DATABASE_URL_DEV required}}" npm run prisma:migrate
