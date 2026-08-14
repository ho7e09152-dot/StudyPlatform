# Provider Capability

Status: active
Updated: 2026-08-14

`GET /api/v1/capabilities`가 rollout의 정본이다.

활성화되고 완전한 GitHub App 사용자 인가 설정이 없으면 응답은 다음만 제공한다.

```json
{
  "authProviders": ["GITLAB"],
  "accountLinkProviders": ["GITLAB"],
  "repositoryProviders": ["GITLAB"],
  "features": { "workspaceDiscovery": true }
}
```

`GITHUB_ACCOUNT_LINKING_ENABLED=true`이고 `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_REDIRECT_URI`가 모두 설정된 경우에만 `accountLinkProviders`에 `GITHUB`가 추가된다. 기능을 활성화했지만 설정이 불완전하면 시작 시 경고를 남기고 capability를 비활성 상태로 유지한다.

`repositoryProviders`는 다음 조건을 모두 만족할 때만 `GITHUB`를 추가한다.

- `GITHUB_REPOSITORY_ENABLED=true`
- user-authorization configuration is complete
- App ID and mounted private key pass startup validation
- the GitHub repository adapter is present

`authProviders`는 `GITHUB_LOGIN_ENABLED=true`이고 GitHub 사용자 인가 설정이 완전한 경우에만 `GITHUB`를 추가한다. Login은 button을 표시하기 전에 이 capability를 확인하므로 Backend 준비 전에 배포된 Frontend는 GitHub를 숨긴 상태로 유지한다.

세 GitHub flag는 서로 독립적이다. 안전하게 설정된 조합에 따라 GitHub를 Login, Settings account linking, repository-backed Workspace에서 각각 사용할 수 있다.

enum에 값이 있다는 사실만으로 지원을 의미하지 않는다. 각 capability는 해당 Backend 경로가 설정되고 검증된 후에만 바뀐다.
