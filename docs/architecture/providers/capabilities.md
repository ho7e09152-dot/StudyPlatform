# Provider Capabilities

Status: active
Updated: 2026-08-13

`GET /api/v1/capabilities` is the rollout source of truth.

Without configured GitHub OAuth credentials, the response exposes only:

```json
{
  "authProviders": ["GITLAB"],
  "accountLinkProviders": ["GITLAB"],
  "repositoryProviders": ["GITLAB"],
  "features": { "workspaceDiscovery": true }
}
```

When `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`, and `GITHUB_OAUTH_REDIRECT_URI` are configured, only `accountLinkProviders` adds `GITHUB`. `authProviders` and `repositoryProviders` remain `GITLAB` in this phase. The frontend may therefore show GitHub only in Settings > 연결된 계정; Login, Workspace Connect, Discovery and repository UI must not expose it.

Enum membership does not imply support. Each capability changes only after its corresponding backend path is configured and tested.
