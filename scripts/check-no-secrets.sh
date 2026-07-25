#!/usr/bin/env sh

set -eu

repository_root="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$repository_root"

tracked_env_files="$(git ls-files | grep -E '(^|/)\.env$' || true)"
if [ -n "$tracked_env_files" ]; then
  echo "실제 .env 파일이 Git에 포함되어 있습니다:"
  echo "$tracked_env_files"
  exit 1
fi

if git grep -nE 'GITLAB_ACCESS_TOKEN=[^[:space:]]+' -- \
  ':!*.example' \
  ':!*.md' \
  ':!.gitlab-ci.yml' \
  ':!scripts/check-no-secrets.sh'; then
  echo "GitLab token처럼 보이는 값이 추적 파일에 있습니다."
  exit 1
fi

echo "비밀 파일 기본 검사를 통과했습니다."
