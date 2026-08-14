# Provider Capabilities

Status: active
Updated: 2026-08-14

`GET /api/v1/capabilities` is the rollout source of truth.

Without enabled and complete GitHub App user-authorization configuration, the response exposes only:

```json
{
  "authProviders": ["GITLAB"],
  "accountLinkProviders": ["GITLAB"],
  "repositoryProviders": ["GITLAB"],
  "features": { "workspaceDiscovery": true }
}
```

Only when `GITHUB_ACCOUNT_LINKING_ENABLED=true` and `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `GITHUB_REDIRECT_URI` are complete does `accountLinkProviders` add `GITHUB`. An incomplete enabled configuration produces a startup warning and keeps the capability off.

`repositoryProviders` adds `GITHUB` only when all of these are true:

- `GITHUB_REPOSITORY_ENABLED=true`
- user-authorization configuration is complete
- App ID and mounted private key pass startup validation
- the GitHub repository adapter is present

`authProviders` adds `GITHUB` only when `GITHUB_LOGIN_ENABLED=true` and GitHub user-authorization configuration is complete. Login reads this capability before rendering buttons; a frontend deployed before the backend is ready therefore keeps GitHub hidden.

The three GitHub flags are independent: GitHub may be available for login, Settings account linking, and repository-backed Workspaces in any safely configured combination.

Enum membership does not imply support. Each capability changes only after its corresponding backend path is configured and tested.
