#!/usr/bin/env sh

set -eu

repository_root="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

echo "[1/5] 비밀 파일 검사"
"$repository_root/scripts/check-no-secrets.sh"

echo "[2/5] OpenAPI 검사"
cd "$repository_root"
npx --yes @redocly/cli lint docs/openapi.yaml --config .redocly.yaml

echo "[3/5] Frontend lint"
cd "$repository_root/frontend"
npm run lint

echo "[4/5] Frontend build and route tests"
npm run test

echo "[5/5] Backend tests"
cd "$repository_root/backend"
./gradlew test

echo "전체 검사를 통과했습니다."
