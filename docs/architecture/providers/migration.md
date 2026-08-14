# Multi-provider Migration 계획

Status: V11 implemented and verified on H2 PostgreSQL mode; production backup/restore rehearsal required
Updated: 2026-08-13

## Migration 전 검사

- `user_accounts`, `workspace_metadata`, `oauth_credentials` 수를 기록한다.
- 모든 credential `user_id`가 정확히 한 user를 가리키는지 확인한다.
- null이 아닌 `gitlab_user_id`, `gitlab_project_id`가 unique인지 확인한다.
- 암호화 DB backup을 만들고 restore credential을 검증한다.
- V11 배포 중 application의 동시 쓰기를 중단한다.

## V11 단계

1. `provider_accounts`와 외부 identity constraint를 추가한다.
2. user UUID를 유지하며 기존 user마다 GITLAB account 하나를 backfill한다.
3. ciphertext를 복호화하지 않고 credential 소유권을 Provider Account로 옮긴다.
4. 한 compatibility release 동안 deprecated user-id mirror를 유지한다.
5. `repository_connections`를 추가하고 모든 Workspace를 GITLAB으로 backfill한다.
6. 향후 non-GitLab row를 위해 기존 GitLab column의 제약을 완화하되 아직 삭제하지 않는다.
7. 정규화 field를 먼저, compatibility field를 다음으로 읽는 code를 배포한다.

## Migration 후 검증

user, Workspace, credential, active membership 수가 migration 전과 같아야 한다. 기존 GitLab user마다 GITLAB Provider Account가 정확히 하나인지, orphan account/credential이 없는지, 기존 Workspace마다 Repository Connection이 하나인지 확인한다. 표본 account의 credential decrypt/refresh, 기존 UUID로의 Login, Workspace Discovery·Join·repository write·account 삭제 회귀 test를 검증한다.

## Rollback

새 multi-provider 쓰기를 받기 전에는 migration 전 backup을 restore하거나 Provider Account 소유권에서 credential `user_id`를 복원하는 검토된 reverse migration을 실행할 수 있다. 새 Provider가 연결된 뒤에는 Provider Account를 삭제하지 않으며 안전한 복구 경로는 roll-forward다.
