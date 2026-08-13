# GitHub Account Linking

Status: implemented, capability-gated
Updated: 2026-08-13

## Scope

This phase links a GitHub identity to an already authenticated Study-ing user. It does not support GitHub login, repository listing, Workspace connection, Discovery/Join, submission, review or sync.

## Flow

1. An authenticated user opens Settings > 연결된 계정.
2. The UI renders GitHub only when `accountLinkProviders` contains `GITHUB`.
3. `GET /api/v1/provider-accounts/github/link` stores server-side link state bound to the current Study-ing user and redirects to GitHub.
4. GitHub returns to `/api/v1/provider-accounts/github/callback`.
5. The backend consumes and clears state, validates expiry/action/user binding, exchanges the code with PKCE, and calls `GET /user` for the current GitHub identity.
6. The GitHub adapter emits normalized `ProviderIdentity` and `ProviderOAuthCredential` values.
7. The linking service creates or reauthorizes the current user's `GITHUB` ProviderAccount and AES-GCM encrypted credential.
8. The user returns to `/settings/accounts`; success is announced by the existing Toast system.

Callback query parameters never contain a Study-ing user id or ProviderAccount id. The authenticated session is the only owner input.

## OAuth and scope

This implementation uses a GitHub OAuth App authorization-code flow with `state` and PKCE S256. It requests no OAuth scope because GitHub documents that no scope is sufficient for read-only public identity. Email and repository data are neither requested nor stored. GitHub also documents that an OAuth App needs the broad `repo` scope for private repository contents.

Official references:

- OAuth web flow, state, PKCE and identity revalidation: <https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps>
- OAuth scopes: <https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps>
- GitHub App versus OAuth App: <https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/differences-between-github-apps-and-oauth-apps>

Before repository integration, prefer evaluating a GitHub App. GitHub recommends GitHub Apps in general because permissions are fine-grained, repository selection is explicit and tokens can be short-lived. This account-link phase does not request `repo` preemptively.

## State and CSRF protection

The server stores an unguessable state, creation time, intended action `LINK`, authenticated internal user id and PKCE verifier in the existing HttpSession. State is constant-time compared and expires after 10 minutes. Callback processing fails before token exchange if any binding differs. State is one-time because it is removed before exchange.

Gateway access logging is disabled for the exact GitHub callback path so `code` and `state` do not enter the configured nginx access log. Token DTOs redact credentials from `toString()` and controlled errors do not include upstream bodies.

## Identity and collisions

The unique identity is `(GITHUB, externalUserId)`. Email, username and display name are never merge evidence.

- Not connected: create a GITHUB ProviderAccount owned by the authenticated Study-ing user.
- Same user and same GitHub identity: update metadata and rotate the existing credential.
- Same GitHub identity linked to another Study-ing user: reject with `PROVIDER_ACCOUNT_COLLISION`; never merge.
- Same Study-ing user with a different GitHub identity already linked: reject until a future explicit disconnect/switch policy exists.

## Credential lifecycle

The credential belongs to ProviderAccount, is encrypted by the existing `TokenCipher`, and may have no expiry/refresh token because GitHub OAuth App tokens are non-expiring by default. Reauthorization replaces ciphertext in the existing row. Study-ing account deletion cascades through all ProviderAccounts and credentials.

Provider disconnect is intentionally not exposed in this phase. The schema supports it, but a future implementation must define Workspace dependency checks, remote token revocation and reconnect behavior.

## Capability rollout

- No GitHub config: `accountLinkProviders = [GITLAB]`; GitHub UI is absent.
- Configured and tested GitHub OAuth: `accountLinkProviders = [GITLAB, GITHUB]`.
- Always in this phase: `authProviders = [GITLAB]`, `repositoryProviders = [GITLAB]`.

Thus a connected GitHub account cannot affect the current GitLab Workspace, Sidebar provider status or Login provider list.
