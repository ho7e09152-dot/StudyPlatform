# Provider Identity 모델

Status: implemented; capability-gated GitLab and GitHub login plus explicit account linking
Updated: 2026-08-14

## 불변조건

- `user_accounts.id`는 안정적인 Study-ing user id인 UUID 문자열이며 Provider id에서 만들지 않는다.
- `provider_accounts`가 외부 identity metadata를 소유하고 `(provider, external_user_id)`와 `(user_id, provider)`는 unique다.
- `oauth_credentials.provider_account_id`가 암호화 credential을 소유한다. Workspace가 생성자의 credential을 소유하거나 빌리지 않는다.
- Browser session은 `StudyIngPrincipal`을 저장하고 Spring Session index는 `study-ing:{userId}`다.
- Provider email, username, display name은 identity-linking 증명이 아니다.
- 향후 account link는 인증된 Study-ing session과 별도의 성공한 Provider OAuth 증명을 요구한다.

## 현재 login 확인 과정

1. GitLab OAuth 또는 GitHub App 사용자 인가가 검증된 Provider identity를 반환한다.
2. Backend가 `provider_accounts(provider, external_user_id)`를 찾는다.
3. 연결된 `user_accounts` row를 읽는다.
4. 해당 Provider Account의 암호화 credential만 교체한다.
5. 안정적인 Study-ing principal을 session에 저장한다.

새 identity는 transaction 안에서 Study-ing user, 일치하는 Provider Account와 credential을 하나씩 만든다. 반복 login은 같은 row를 찾는다. Settings에서 이미 연결된 검증된 GitHub identity는 기존 Study-ing user를 찾으며 email과 username을 account merge 근거로 사용하지 않는다.

## Credential 보안

AES-GCM 암호화, log redaction, HttpOnly session Cookie, OAuth state 검증과 callback query log 보호를 유지한다. V11은 token plaintext를 복호화하거나 기록하지 않고 credential FK를 바꾼다. Account 삭제는 Study-ing user에서 모든 Provider Account와 credential로 cascade한다.

## 전환 field

| Field | Status | 이유 / 제거 조건 |
|---|---|---|
| `user_accounts.gitlab_user_id` | DEPRECATED | Workspace JSON과 운영 attribution이 사용 중. member/submission attribution migration 후 제거 |
| `user_accounts.username/avatar_url/web_url` | DEPRECATED as Provider identity | 한 release 동안 API 호환성 유지. 외부 identity 정본은 `provider_accounts` |
| `oauth_credentials.user_id` | DEPRECATED | 읽기 전용 호환 mirror. 새 코드는 `provider_account_id` 사용 |
| `AuthSessionAttributes.GITLAB_USER` | DEPRECATED | 이전 session upgrade에만 허용. 새 session은 `STUDY_ING_USER` 기록 |
| `StudyMember.gitlabUserId` | STILL REQUIRED | GitLab repository filename, 기존 JSON과 member sync가 사용. 새 member는 안정적인 `userId`도 가짐 |

## 현재 제외 범위

- Provider disconnect UI
- 같은 Provider의 여러 account
- 자동 identity merge
- 호환용 `StudyMember.gitlabUserId` field를 Provider-neutral external member id로 전환
