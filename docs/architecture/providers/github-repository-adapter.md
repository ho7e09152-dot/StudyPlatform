# GitHub Repository Adapter

Status: implemented behind `GITHUB_REPOSITORY_ENABLED`  
Updated: 2026-08-14

## User flow

1. An authenticated Study-ing user explicitly links GitHub in Settings.
2. Workspace Connect shows GitHub only when the backend returns it in `repositoryProviders`.
3. If the App is not installed for a repository, the user opens `/api/v1/github/installations/new` and installs the GitHub App.
4. GitHub returns to `/api/v1/github/installations/setup?installation_id=...`.
5. The backend treats that ID as untrusted and verifies it against the current user's `/user/installations` response.
6. Repository selection lists only repositories returned by `/user/installations/{id}/repositories`.
7. Workspace creation, discovery and join use `(GITHUB, externalRepositoryId)` and require normalized write capability.

GitHub login remains disabled. A user reaches this flow through an existing Study-ing session and a linked GitHub ProviderAccount.

## Token boundary

- User access token: encrypted under the ProviderAccount and used for user-attributed repository reads/writes. Effective permission is the intersection of the App permission, installation repository selection and the user's own access.
- App JWT: generated in memory from App ID and the mounted private key.
- Installation access token: supported as an internal foundation but not substituted for the acting user's credential.

Workspace connections never own credentials, and the creator's token is never reused as a shared Workspace token.

## Required GitHub App registration

- User authorization callback: `https://sandbox.withroro.com/api/v1/provider-accounts/github/callback`
- Setup URL: `https://sandbox.withroro.com/api/v1/github/installations/setup`
- Repository permissions: Metadata read, Contents read/write
- Installation target: user or organization repositories selected by the installer

No webhook permissions are required in this phase.

## Provider operations

- Repository list/detail: GitHub App installations visible to the current user
- Discovery/join: provider plus external repository ID and normalized `canWrite`
- Tree/file operations: Git Trees and Contents APIs
- Multi-file migration: Git Data tree/commit/ref update
- Review: commit comments
- Conflict protection: latest commit/file SHA and non-forced ref update

GitHub 401 is reauthorization, a confirmed 403/404 is access denied/not found, 429 is rate limited, and timeout/5xx is provider unavailable. Provider failures are not converted into membership revocation unless access loss is confirmed.

## Remaining limitations

- GitHub login/signup is not implemented.
- GitHub organization member administration/sync is not implemented; self-service Discovery/Join is supported.
- Webhook-driven installation/token revocation is not implemented; access is revalidated on login, Workspace access TTL expiry, switch and write actions.
- A real GitHub organization/repository two-user staging pass remains required after the GitHub App registration permissions and Setup URL are saved.
