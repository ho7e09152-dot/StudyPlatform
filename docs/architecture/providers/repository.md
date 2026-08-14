# Repository Model

Status: GitLab and GitHub adapters implemented; GitHub rollout is capability-gated
Updated: 2026-08-14

## Model

`Workspace -> RepositoryConnection` is stored in `repository_connections`.

Repository identity fields:

- `provider`
- opaque `external_repository_id`
- `full_name`
- `web_url`
- `visibility`
- `default_branch`

The database uniqueness rule is `(provider, external_repository_id)`. Therefore `GITLAB:123` and `GITHUB:123` are different identities while two `GITLAB:123` connections are rejected.

API Workspace responses include normalized `repository` metadata and capabilities (`canRead`, `canWrite`, `canManage`). The compatibility fields `gitlabProjectId`, `gitlabProjectPath`, and `defaultBranch` remain during the GitLab migration window.

## Credential resolution

`RepositoryCredentialResolver` accepts the acting Study-ing user and Workspace repository identity. It resolves that user's Provider Account credential. It never resolves a Workspace creator credential. Unsupported providers return a normalized Provider error.

`RepositoryDataPort` now normalizes repository list/detail, tree, file create/update, atomic multi-file commit, and commit comments. Schedule, Submission, Review, Sync, import analysis and schema migration route through `RepositoryDataService`. GitLab and GitHub response objects stop inside their adapters.

## Migration and rollback

V11 performs additive backfill first:

1. Create and backfill GITLAB Provider Accounts.
2. Repoint credential ownership without decrypting ciphertext.
3. Create and backfill Repository Connections.
4. Relax legacy GitLab columns so a future non-GitLab Workspace can leave them null.
5. Retain compatibility mirrors; no user, Workspace, membership, submission, review, notification, or audit FK is rewritten destructively.

Rollback before application deployment is a database restore or a tested reverse migration that copies `provider_account_id` back to `oauth_credentials.user_id` before dropping new tables. After new writes occur, dropping Provider Accounts is not safe; roll forward is required.

## Legacy inventory

| Field | Status |
|---|---|
| `workspace_metadata.gitlab_project_id` | DEPRECATED, current GitLab service still reads it |
| `workspace_metadata.gitlab_project_path` | DEPRECATED, current GitLab service still reads it |
| Workspace JSON `gitlabProjectId/gitlabProjectPath` | DEPRECATED response compatibility |
| Workspace JSON `repository` | CURRENT normalized contract |
| Discovery `repositoryId/repositoryPath` | DEPRECATED aliases |
| Discovery `externalRepositoryId/repositoryFullName` | CURRENT normalized contract |
