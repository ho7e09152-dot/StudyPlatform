# Repository 모델

Status: GitLab and GitHub adapters implemented; GitHub rollout is capability-gated
Updated: 2026-08-14

## 모델

`Workspace -> RepositoryConnection`은 `repository_connections`에 저장한다. Identity field는 `provider`, opaque `external_repository_id`, `full_name`, `web_url`, `visibility`, `default_branch`다. DB unique 규칙은 `(provider, external_repository_id)`이므로 `GITLAB:123`과 `GITHUB:123`은 다르고 두 `GITLAB:123` 연결은 거부한다.

API Workspace 응답은 정규화된 `repository` metadata와 capability(`canRead`, `canWrite`, `canManage`)를 포함한다. `gitlabProjectId`, `gitlabProjectPath`, `defaultBranch`는 GitLab migration 기간에 호환 field로 유지한다.

## Credential 확인

`RepositoryCredentialResolver`는 작업하는 Study-ing user와 Workspace repository identity를 받아 그 사용자의 Provider Account credential을 확인한다. Workspace 생성자의 credential을 사용하지 않는다. 미지원 Provider는 정규화된 Provider 오류를 반환한다.

GitLab과 GitHub adapter는 확인 뒤 token을 받으며 Provider별 응답 객체를 adapter 경계 밖으로 노출하지 않는다.

## Migration과 rollback

V11은 GITLAB Provider Account 생성·backfill, ciphertext 복호화 없는 credential 소유권 전환, Repository Connection 생성·backfill, 기존 GitLab column 제약 완화 순서의 additive migration이다. 호환 mirror를 유지하며 user, Workspace, membership, submission, review, notification, audit FK를 파괴적으로 다시 쓰지 않는다.

`RepositoryDataPort`는 repository 목록·상세, tree, file 생성·수정, atomic multi-file commit과 commit comment를 정규화한다. Schedule, Submission, Review, Sync, import analysis와 schema migration은 `RepositoryDataService`를 통한다. GitLab과 GitHub 응답 객체는 각 adapter 내부에서만 사용한다.

Application 배포 전 rollback은 DB restore 또는 `provider_account_id`를 `oauth_credentials.user_id`로 복사한 뒤 새 table을 제거하는 검증된 reverse migration이다. 새 쓰기 후 Provider Account 삭제는 안전하지 않으므로 roll-forward해야 한다.

## 기존 field 목록

| Field | Status |
|---|---|
| `workspace_metadata.gitlab_project_id` | DEPRECATED, 현재 GitLab service가 사용 |
| `workspace_metadata.gitlab_project_path` | DEPRECATED, 현재 GitLab service가 사용 |
| Workspace JSON `gitlabProjectId/gitlabProjectPath` | DEPRECATED response compatibility |
| Workspace JSON `repository` | CURRENT normalized contract |
| Discovery `repositoryId/repositoryPath` | DEPRECATED aliases |
| Discovery `externalRepositoryId/repositoryFullName` | CURRENT normalized contract |
