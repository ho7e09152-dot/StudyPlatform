# GitHub Account Linking

Status: implemented, capability-gated
Updated: 2026-08-13

## 범위

이 흐름은 이미 인증된 Study-ing 사용자에게 GitHub identity를 연결한다. GitHub login과 repository 작업은 별도의 capability-gated 흐름을 사용한다. Account linking은 항상 명시적으로 수행하며 account를 자동으로 merge하지 않는다.

## 흐름

1. 인증된 사용자가 Settings > 연결된 계정을 연다.
2. UI는 `accountLinkProviders`에 `GITHUB`가 있을 때만 GitHub를 표시한다.
3. `GET /api/v1/provider-accounts/github/link`가 현재 Study-ing 사용자에 묶인 link state를 서버에 저장하고 GitHub로 redirect한다.
4. GitHub가 `/api/v1/provider-accounts/github/callback`으로 돌아온다.
5. Backend는 state를 소비·삭제하고 expiry/action/user binding을 검증한 뒤 PKCE로 code를 교환하고 `GET /user`로 현재 GitHub identity를 확인한다.
6. GitHub adapter가 정규화된 `ProviderIdentity`와 `ProviderOAuthCredential`을 만든다.
7. linking service가 현재 사용자의 `GITHUB` ProviderAccount와 AES-GCM 암호화 credential을 생성하거나 재인가한다.
8. 사용자는 `/settings/accounts`로 돌아오고 기존 Toast system이 성공을 알린다.

Callback query parameter에는 Study-ing user id나 ProviderAccount id를 넣지 않는다. 인증 session만 소유자 입력으로 사용한다.

## GitHub App 사용자 인가와 permission

이 구현은 `state`와 PKCE S256을 사용하는 GitHub App web application flow를 사용한다. GitHub App user access token은 classic OAuth scope가 아니라 App의 세분화된 permission을 사용한다. 이 단계에서는 email과 repository data를 요청하거나 저장하지 않는다. 등록된 통합이 GitHub App이어도 사용자 인가에는 Client ID와 Client Secret이 필요하다.

공식 참고 자료:

- GitHub App user access-token web flow: <https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app>
- GitHub App authentication overview: <https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app>

App JWT와 installation token 처리는 이 사용자 흐름과 분리된다. [GitHub App 설정](github-app-configuration.md)을 참고한다.

## State와 CSRF 보호

서버는 추측할 수 없는 state, 생성 시각, action `LINK`, 인증된 내부 user id와 PKCE verifier를 기존 HttpSession에 저장한다. State는 constant-time으로 비교하고 10분 후 만료하며 교환 전에 삭제해 한 번만 사용한다. binding이 다르면 token 교환 전에 실패한다.

`code`와 `state`가 nginx access log에 남지 않도록 정확한 GitHub callback path의 gateway access logging을 끈다. Token DTO는 `toString()`에서 credential을 가리고 통제된 오류에 upstream body를 포함하지 않는다.

## Identity와 충돌

고유 identity는 `(GITHUB, externalUserId)`다. Email, username과 display name을 merge 근거로 사용하지 않는다.

- 미연결: 인증된 Study-ing 사용자가 소유하는 GITHUB ProviderAccount를 생성한다.
- 같은 사용자·같은 GitHub identity: metadata를 갱신하고 기존 credential을 교체한다.
- 다른 Study-ing 사용자에게 이미 연결된 identity: `PROVIDER_ACCOUNT_COLLISION`으로 거부하고 merge하지 않는다.
- 같은 Study-ing 사용자에게 다른 GitHub identity가 이미 연결됨: 명시적 disconnect/switch 정책이 생길 때까지 거부한다.

## Credential 생명주기

사용자 access credential은 ProviderAccount 소유이며 기존 `TokenCipher`로 암호화한다. GitHub App user token은 기본적으로 만료되며 refresh token을 포함할 수 있다. Study-ing은 응답에 포함된 access expiry와 refresh token을 저장한다. 재인가는 기존 row의 ciphertext를 교체한다. Study-ing account 삭제는 모든 ProviderAccount와 credential로 cascade한다.

이 단계에는 Provider disconnect를 노출하지 않는다. 향후 구현은 Workspace 의존성, remote token revoke와 reconnect 동작을 정의해야 한다.

## Capability rollout

- 기능이 비활성 상태이거나 사용자 인가 설정이 불완전함: `accountLinkProviders = [GITLAB]`, GitHub UI 미표시.
- `GITHUB_ACCOUNT_LINKING_ENABLED=true`이고 Client ID/Secret/redirect가 완전함: `accountLinkProviders = [GITLAB, GITHUB]`.
- `GITHUB_LOGIN_ENABLED=true`이면 독립적으로 `authProviders`에 GitHub를 추가한다.
- `GITHUB_REPOSITORY_ENABLED=true`이고 App 인증이 검증되면 독립적으로 `repositoryProviders`에 GitHub를 추가한다.

GitHub account 연결은 현재 Workspace repository Provider나 Sidebar 상태를 바꾸지 않는다. Login, account linking과 repository capability는 서로 독립적이다.
