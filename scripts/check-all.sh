#!/usr/bin/env sh

set -eu

repository_root="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

echo "[1/7] 비밀 파일 검사"
"$repository_root/scripts/check-no-secrets.sh"

echo "[2/7] OpenAPI 검사"
cd "$repository_root"
npx --yes @redocly/cli lint docs/openapi.yaml --config .redocly.yaml

echo "[3/7] Frontend lint"
cd "$repository_root/frontend"
npm run lint

echo "[4/7] Frontend production dependency audit"
npm audit --omit=dev --audit-level=high

echo "[5/7] Frontend build and route tests"
npm run test

echo "[6/7] Frontend browser E2E"
npm run test:e2e

echo "[7/7] Backend tests"
cd "$repository_root/backend"
./gradlew test

echo "전체 검사를 통과했습니다."
