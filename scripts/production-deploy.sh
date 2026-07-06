#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/app/voiceai}"
BRANCH="${BRANCH:-main}"
LOG_PREFIX="[voiceai-deploy]"
LOCK_FILE="/tmp/voiceai-production-deploy.lock"
FORCE="${1:-}"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "$LOG_PREFIX another deployment is already running"
  exit 0
fi

cd "$APP_DIR"

git fetch origin "$BRANCH"
LOCAL_SHA="$(git rev-parse HEAD)"
REMOTE_SHA="$(git rev-parse "origin/$BRANCH")"

if [[ "$FORCE" != "--force" && "$LOCAL_SHA" == "$REMOTE_SHA" ]]; then
  echo "$LOG_PREFIX already up to date at ${LOCAL_SHA:0:7}"
  exit 0
fi

echo "$LOG_PREFIX deploying ${REMOTE_SHA:0:7}"
git reset --hard "origin/$BRANCH"

npm ci
npm --workspace backend run prisma:generate

if [[ -f backend/.env ]]; then
  set -a
  # shellcheck disable=SC1091
  source backend/.env
  set +a
fi

if [[ -n "${DATABASE_URL:-}" ]]; then
  npx prisma db push --schema backend/prisma/schema.prisma --accept-data-loss
fi

npm run build

if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files voiceai-backend.service >/dev/null 2>&1; then
  sudo systemctl restart voiceai-backend
else
  pm2 restart voiceai-backend --update-env
  pm2 save
fi

if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet nginx; then
  sudo systemctl reload nginx
fi

echo "$LOG_PREFIX deployed ${REMOTE_SHA:0:7}"
