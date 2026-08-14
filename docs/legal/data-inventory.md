# 외부 Provider 데이터 목록

Status: draft operational inventory
Updated: 2026-08-13

이 문서는 연결된 외부 계정에 관한 구현 사실을 기록한다. 법적 분류는 `implementation-facts.md`의 기존 검토 항목에 따라 계속 검토해야 한다.

| Provider | 기능 상태 | 수신·저장 데이터 | Credential | 목적 | 삭제 |
|---|---|---|---|---|---|
| GitLab | Login과 repository 작업 | external user ID, username, display name, avatar URL, profile URL 및 기본 목록에 설명된 project/repository 데이터 | 기존 AES-GCM 정책으로 암호화한 access/refresh token, expiry와 scope | 인증과 현재 GitLab 기반 Workspace 기능 | logout/account 삭제는 현재 GitLab 정책을 따르며 account 삭제 시 ProviderAccount와 credential 삭제 |
| GitHub | Login/signup, Connected Account linking과 capability-gated repository 작업 | GitHub user ID, login/username, 선택적 display name, avatar/profile URL, 설치된 repository의 ID/name/visibility/branch/permission, Workspace 작업에 필요한 file·commit·commit comment | 기존 AES-GCM 정책으로 암호화한 GitHub App user access token과 선택적 refresh/expiry metadata. App private key는 mount된 server secret이며 user data가 아님 | identity 인증 또는 명시적 연결·재인가와 사용자가 요청한 Workspace repository 작업 | account 삭제 시 GitHub ProviderAccount와 credential 삭제. Workspace 삭제 시 Study-ing 연결 데이터만 삭제하고 GitHub repository history는 유지. 별도 disconnect는 아직 미제공 |

GitHub email은 요청하거나 저장하지 않는다. Repository content는 GitHub에 유지되며 Study-ing은 이를 읽고 GitLab adapter와 같은 방식으로 파생된 Workspace 상태를 DB에 저장할 수 있다.

GitHub는 account linking과 capability-gated repository 저장을 위한 외부 서비스다. 이 관계가 제3자 제공, 처리위탁 또는 다른 법적 분류인지와 국외 이전 조항 적용 여부는 production infrastructure와 운영자 계약이 확정될 때까지 `LEGAL REVIEW REQUIRED`다.
