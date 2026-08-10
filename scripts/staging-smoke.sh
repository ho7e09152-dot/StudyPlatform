#!/usr/bin/env sh
set -eu

FRONTEND_BASE_URL=${FRONTEND_BASE_URL:?FRONTEND_BASE_URL is required}
BACKEND_BASE_URL=${BACKEND_BASE_URL:?BACKEND_BASE_URL is required}

FRONTEND_BASE_URL=${FRONTEND_BASE_URL%/}
BACKEND_BASE_URL=${BACKEND_BASE_URL%/}

SMOKE_TMP_DIR=$(mktemp -d)
trap 'rm -rf "$SMOKE_TMP_DIR"' EXIT INT TERM

check_status() {
  label=$1
  url=$2
  expected=$3
  output_file="$SMOKE_TMP_DIR/body"
  status=$(curl --silent --show-error --output "$output_file" --write-out '%{http_code}' "$url")
  if [ "$status" != "$expected" ]; then
    printf '%s: expected HTTP %s, received %s\n' "$label" "$expected" "$status" >&2
    exit 1
  fi
  printf 'PASS %s (HTTP %s)\n' "$label" "$status"
}

check_status "frontend landing" "$FRONTEND_BASE_URL/" 200
check_status "frontend login" "$FRONTEND_BASE_URL/login" 200
check_status "backend readiness" "$BACKEND_BASE_URL/actuator/health/readiness" 200
check_status "protected workspace boundary" "$BACKEND_BASE_URL/api/v1/workspaces" 401

oauth_headers="$SMOKE_TMP_DIR/oauth-headers"
oauth_status=$(curl --silent --show-error --dump-header "$oauth_headers" --output /dev/null --write-out '%{http_code}' \
  "$BACKEND_BASE_URL/api/v1/auth/gitlab/login?returnUrl=%2Ftoday")
if [ "$oauth_status" != "302" ]; then
  printf 'GitLab OAuth entry: expected HTTP 302, received %s\n' "$oauth_status" >&2
  exit 1
fi

oauth_location=$(awk 'tolower($1) == "location:" { sub(/^[^:]*:[[:space:]]*/, ""); sub(/\r$/, ""); print; exit }' "$oauth_headers")
case "$oauth_location" in
  *"/oauth/authorize"*) printf 'PASS GitLab OAuth entry redirects to authorize endpoint\n' ;;
  *)
    printf 'GitLab OAuth entry: unexpected redirect host or path\n' >&2
    exit 1
    ;;
esac

if ! grep -qi '^x-request-id:' "$oauth_headers"; then
  printf 'GitLab OAuth entry: X-Request-ID header is missing\n' >&2
  exit 1
fi
printf 'PASS request ID header\n'

printf 'Staging preflight passed. Continue with docs/staging-e2e-checklist.md.\n'
