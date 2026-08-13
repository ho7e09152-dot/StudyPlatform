# 현재 아키텍처

Updated: 2026-08-13

## 시스템 경계

```text
Browser
  ├─ Public pages / App Shell / feature UI
  └─ HttpOnly Study-ing session cookie
          ↓
Spring Boot API
  ├─ stable StudyIngUser identity
  ├─ Workspace role and repository permission checks
  ├─ ProviderAccount + encrypted OAuthCredential
  ├─ GitLab/GitHub adapters behind normalized ports
  └─ PostgreSQL + Spring Session JDBC
          ↓
GitLab
  └─ schedule, submission and review repository source
```

Study-ing identity는 외부 Provider ID와 분리된 UUID입니다. GitLab은 현재 login 및 Repository Provider이고, GitHub는 인증된 사용자가 Settings에서 계정을 연결하는 기능만 capability-gated 상태로 제공합니다.

## 사용자 흐름

```text
GitLab OAuth 로그인
→ profile/consent 확인
→ 내 Workspace 또는 참여 가능한 Workspace 확인
→ Repository 연결 또는 명시적 Join
→ 일정 생성
→ 본인 credential로 제출 commit
→ 팀 제출 review
→ Library, Records와 Activity 사용
```

인증 Provider와 현재 Workspace의 Repository Provider는 별개 개념입니다. Sidebar의 Provider 상태는 개인 Connected Account가 아니라 선택한 Workspace의 Repository 연결을 나타냅니다.

## 데이터 저장 위치

| 데이터 | 위치 | 성격 |
|---|---|---|
| Study-ing user/profile/consent | DB | stable account와 설정 |
| ProviderAccount | DB | Provider별 외부 identity metadata |
| OAuth credential | DB | ProviderAccount에 귀속, AES-GCM 암호화 |
| Browser login | HttpOnly cookie | OAuth token을 브라우저에 저장하지 않음 |
| Server session | Spring Session JDBC | 기본 inactivity timeout 8시간 |
| Workspace/member/role | DB | Repository membership과 분리된 app state |
| RepositoryConnection | DB | `(provider, externalRepositoryId)` identity |
| 일정과 학습 항목 | GitLab `session.yml` + DB sync state | GitLab 원본 |
| 제출 | GitLab member Markdown + DB sync state | GitLab 원본 |
| 제출 review | GitLab commit comment + DB notification/audit | GitLab 원본과 app metadata |
| 팀 문서·공지·메시지 | DB | Study-ing-managed content |
| Notification/sync/audit | DB | retention cleanup 대상 |

상세 저장 구조는 [Repository 저장 구조](repository-storage.md), 개인정보 lifecycle은 [구현 사실](../legal/implementation-facts.md)을 따릅니다.

## 권한 모델

- `OWNER`, `MANAGER`, `MEMBER`는 Study-ing Workspace 역할입니다.
- Repository permission은 외부 Provider가 확인하는 별도 권한입니다.
- Workspace 접근은 활성 membership과 현재 Repository access policy를 모두 통과해야 합니다.
- Repository write는 행동하는 사용자의 해당 ProviderAccount credential을 사용합니다.
- Workspace 생성자의 credential을 공용 credential로 사용하지 않습니다.
- revision, document version 또는 `last_commit_id`가 오래되면 409로 거부합니다.

Discovery, Join과 접근 철회 정책은 [Workspace](workspaces.md)에 정리합니다.

## 주요 Frontend route

| 영역 | Route |
|---|---|
| Public | `/`, `/login`, `/auth/callback`, `/terms`, `/privacy` |
| Onboarding | `/onboarding/profile`, `/workspaces/new` |
| Workspace | `/workspaces` |
| Main | `/today`, `/schedule`, `/records`, `/library`, `/settings/*` |
| Detail | `/schedule/:date`, `/library/sessions/:date`, `/library/docs/*` |

`/repository/*`는 `/library/*`로 보내는 compatibility route이며 신규 link에서 사용하지 않습니다.

## Source of truth

| 질문 | 우선 확인 위치 |
|---|---|
| HTTP 요청·응답 | [OpenAPI](../api/openapi.yaml), Controller/DTO test |
| DB schema | `backend/src/main/resources/db/migration/` |
| Provider 지원 범위 | [Capabilities](providers/capabilities.md), `/api/v1/capabilities` |
| UI token/component | [Design system](../design/design-system.md), `frontend/app/design-system.css` |
| 배포/환경변수 | [Production runbook](../operations/production.md), `.env.example` |
| 법무·삭제·보유 | `docs/legal/`와 retention/account lifecycle code |

계획 문서보다 실제 코드·migration·자동 테스트를 우선합니다.
