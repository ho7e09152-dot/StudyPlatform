# GitHub App Configuration

Status: account linking and repository adapter implemented behind independent capability flags  
Updated: 2026-08-14

Study-ing registers one **GitHub App**, not a classic OAuth App. A GitHub App still uses two separate authentication families. They must not share token storage or capability decisions.

## Authentication boundaries

### User authorization

Purpose: explicitly link a GitHub identity to an already authenticated Study-ing user and make requests attributable to that user.

1. `GITHUB_CLIENT_ID` builds `https://github.com/login/oauth/authorize`.
2. The server stores random `state`, PKCE verifier, action `LINK`, creation time and the authenticated internal user ID in HttpSession.
3. The exact `GITHUB_REDIRECT_URI` receives `code` and `state`.
4. The backend sends Client ID, Client Secret, code, redirect URI and PKCE verifier to `/login/oauth/access_token`.
5. The resulting GitHub App user access token calls `GET /user` and creates or reauthorizes `ProviderAccount(GITHUB)`.

GitHub App user access tokens do not use classic OAuth scopes. Their effective access is the intersection of the app's fine-grained permissions, the installation's selected repositories and the user's own permission. Study-ing uses this token for identity and for user-attributed repository operations.

### App authentication

Purpose: authenticate Study-ing's GitHub App itself.

- Input: `GITHUB_APP_ID` and the RSA private key loaded from `GITHUB_PRIVATE_KEY_PATH`.
- Output: an in-memory RS256 JWT containing `iat`, `exp` and `iss`.
- `iat` is 60 seconds in the past for clock drift and `exp` is 9 minutes after creation, below GitHub's 10-minute maximum.
- The JWT is generated on demand and is not persisted or logged.

GitHub accepts either the App ID or Client ID as `iss`; Study-ing uses the configured App ID so the App-authentication credential group remains explicit.

### Installation authentication

Purpose: obtain a short-lived token for repositories selected in one installation.

The internal foundation sends the App JWT to `POST /app/installations/{installation_id}/access_tokens`. The authenticated Setup URL first verifies the query-string installation ID against `GET /user/installations` using the current user's GitHub token. It never trusts the callback parameter by itself.

User access tokens and installation access tokens are separate credential types. Current user actions use the user's token so GitHub App permissions, selected installation repositories, and that user's permission are all enforced. Installation tokens remain an App-authentication foundation and are never stored as a user's OAuth credential.

## Environment variables

| Variable | Required when | Purpose |
|---|---|---|
| `GITHUB_CLIENT_ID` | account linking, login or repository user actions | GitHub App user authorization and code exchange |
| `GITHUB_CLIENT_SECRET` | account linking, login or repository user actions | server-only user authorization code exchange |
| `GITHUB_REDIRECT_URI` | account linking or login | exact registered user authorization callback shared by server-side `LINK`/`LOGIN` state actions |
| `GITHUB_ACCOUNT_LINKING_ENABLED` | optional flag | expose GitHub only in Settings Connected Accounts when user config is complete |
| `GITHUB_LOGIN_ENABLED` | optional flag | expose GitHub on Login only when user authorization config is complete |
| `GITHUB_REPOSITORY_ENABLED` | repository operations | expose GitHub repository discovery/connect/write only when user authorization and App authentication are valid |
| `GITHUB_APP_ID` | repository/App auth | JWT issuer |
| `GITHUB_PRIVATE_KEY_PATH` | repository/App auth | container-local PEM path |
| `GITHUB_APP_SLUG` | optional | installation URL construction in a future phase; default `study-ing` |

`GITHUB_REDIRECT_ID`, `GItHUB_CLIENT_ID`, and `GITHUB_OAUTH_*` are not supported names.

## Safe startup and capabilities

- All GitHub flags false and no GitHub credentials: backend starts normally.
- Account linking true with incomplete Client ID/Secret/redirect: backend starts with a warning and omits GitHub from `accountLinkProviders`.
- Login true with complete user-authorization config: `authProviders=[GITLAB,GITHUB]`; the Login page renders the GitHub button from this capability.
- Repository false: App ID and PEM are optional and the key is not read.
- Repository true: App ID and a readable, valid RSA PEM are required. Invalid configuration stops startup before traffic.
- Repository true with valid user authorization and App authentication: `repositoryProviders` adds `GITHUB`.

## Private key deployment

The PEM must not be committed, baked into an image, placed in frontend configuration, stored in the database, or printed. `GitHubAppPrivateKeyLoader` accepts GitHub RSA PEM files in PKCS#8 (`BEGIN PRIVATE KEY`) and PKCS#1 (`BEGIN RSA PRIVATE KEY`) form.

Use a read-only host secret mount:

```bash
GITHUB_PRIVATE_KEY_HOST_PATH=/absolute/host/path/github-app.pem \
GITHUB_PRIVATE_KEY_UID=$(id -u) GITHUB_PRIVATE_KEY_GID=$(id -g) \
docker compose -f compose.sandbox.yml -f compose.github-app.yml up -d
```

Container environment:

```dotenv
GITHUB_PRIVATE_KEY_PATH=/run/secrets/study-ing-github-app.pem
```

Keep the host file at `0600`. The override runs the backend as the configured host owner UID/GID so the non-root process can read the read-only bind without broadening file permissions. The base Compose files do not require this optional override, so GitHub-disabled deployments do not fail because a PEM is absent.

## GitHub App registration

- Homepage URL: the public Study-ing origin.
- Callback URL: exactly `GITHUB_REDIRECT_URI`.
- Setup URL: `https://sandbox.withroro.com/api/v1/github/installations/setup` for sandbox. “Redirect on update” may use the same authenticated verification endpoint.
- Repository permissions: Metadata read and Contents read/write. Do not enable unrelated organization, issue, administration, or email permissions.
- Webhooks: configure only when the application implements signature verification and event handling. User authorization revocation handling is a repository/account lifecycle follow-up.

Official references:

- <https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app>
- <https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-json-web-token-jwt-for-a-github-app>
- <https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app>
