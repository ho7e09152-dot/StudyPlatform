#!/usr/bin/env sh
set -eu

PROJECT_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
BACKUP_DIR=${1:-"$PROJECT_ROOT/backups/postgres"}
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP_FILE="$BACKUP_DIR/study-workspace-$STAMP.dump"

mkdir -p "$BACKUP_DIR"
cd "$PROJECT_ROOT"
docker compose -f compose.prod.yml exec -T postgres sh -c \
  'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump --format=custom --no-owner --no-acl --username="$POSTGRES_USER" "$POSTGRES_DB"' \
  > "$BACKUP_FILE"

test -s "$BACKUP_FILE"
echo "$BACKUP_FILE"

