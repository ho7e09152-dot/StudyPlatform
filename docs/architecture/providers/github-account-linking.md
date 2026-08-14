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

## GitHub App user authorization and permissions

This implementation uses the GitHub App web application flow with `state` and PKCE S256. GitHub App user access tokens use the app's fine-grained permissions rather than classic OAuth scopes. Email and repository data are neither requested nor stored in this phase. The Client ID and Client Secret are still required for user authorization even though the registered integration is a GitHub App.

Official references:

- GitHub App user access-token web flow: <https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app>
- GitHub App authentication overview: <https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app>

App JWT and installation-token handling are separate from this user flow. See [GitHub App configuration](github-app-configuration.md).

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

The user access credential belongs to ProviderAccount and is encrypted by the existing `TokenCipher`. GitHub App user tokens expire by default and can include a refresh token; Study-ing stores the returned access expiry and refresh token when present. Reauthorization replaces ciphertext in the existing row. Study-ing account deletion cascades through all ProviderAccounts and credentials.

Provider disconnect is intentionally not exposed in this phase. The schema supports it, but a future implementation must define Workspace dependency checks, remote token revocation and reconnect behavior.

## Capability rollout

- Feature disabled or user authorization config incomplete: `accountLinkProviders = [GITLAB]`; GitHub UI is absent.
- `GITHUB_ACCOUNT_LINKING_ENABLED=true` plus complete Client ID/Secret/redirect: `accountLinkProviders = [GITLAB, GITHUB]`.
- Always in this phase: `authProviders = [GITLAB]`, `repositoryProviders = [GITLAB]`.

Thus a connected GitHub account cannot affect the current GitLab Workspace, Sidebar provider status or Login provider list.
