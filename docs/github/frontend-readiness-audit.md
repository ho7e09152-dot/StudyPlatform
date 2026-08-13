# GitHub Frontend Integration Readiness Audit

- Status: foundation refactor applied — no GitHub UI or GitHub backend implementation
- Audited: 2026-08-13
- Scope: `frontend/app`, `frontend/components`, `frontend/lib`, frontend tests/E2E fixtures, and the backend contracts consumed by the frontend
- Current production provider: GitLab only

## Executive Summary

> 2026-08-13 foundation update: stable `user_accounts.id`, `ProviderAccount`, provider-owned credential,
> normalized `RepositoryConnection`, repository summary DTO, Provider descriptor, connected-account list,
> provider-aware StorageDetails copy, and backend capability API are now implemented. Remaining GitHub work is
> adapter/linking/write-port integration, removal of deprecated GitLab Workspace/member fields, and rollout QA.

### Resolved vs remaining

| Audit blocker | State | Evidence |
|---|---|---|
| Stable Study-ing identity/session | RESOLVED | UUID `user_accounts.id`, `StudyIngPrincipal`, `study-ing:{id}` session index |
| Provider Account and credential ownership | RESOLVED | `provider_accounts`, credential FK/backfill, connected-account list API |
| Repository uniqueness/normalized identity | RESOLVED FOUNDATION | `repository_connections` unique by provider + external id; legacy fields remain deprecated |
| Capability-gated rollout | RESOLVED | `/api/v1/capabilities` exposes GITLAB only |
| Generic repository selector DTO | RESOLVED FOUNDATION | `/api/v1/repositories` and frontend `Repository` adapter |
| Provider operation implementations | REMAINING | Schedule/Submission/Review/Sync/Migration are still GitLab adapters |
| Stable member/submission attribution only | REMAINING | `gitlabUserId` remains for existing repository files and Workspace JSON |
| GitHub OAuth/link/repository/discovery | REMAINING | intentionally not implemented or exposed |

Study-ing의 화면 IA와 주요 학습 UI는 GitHub를 추가해도 대부분 유지할 수 있다. Today, Schedule 목록, Library 목록/문서, Records, Activity, App Role, Workspace route는 대체로 저장소 Provider를 알 필요가 없다. `AuthProviderButton`, `StorageDetails`, Workspace 기반 API route, Discovery DTO의 `provider` 필드도 재사용 가능한 출발점이다.

그러나 현재 상태는 “descriptor에 GitHub 한 줄을 추가하면 되는 구조”가 아니다. GitHub 지원을 막는 P0는 다음 네 가지다.

1. Study-ing 계정의 공개 식별자와 현재 사용자 판정이 GitLab user ID에 결합되어 있다.
2. OAuth credential이 사용자당 단일 row이며 Provider/account 식별자가 없다.
3. Workspace와 Member DTO가 `gitlabProjectId`, `gitlabProjectPath`, `gitlabUserId`를 필수 필드로 사용한다.
4. Workspace의 읽기·쓰기·동기화·리뷰가 모두 현재 GitLab OAuth session/token을 직접 요구한다.

따라서 순서는 반드시 **계정/Provider Account 계약 → Workspace RepositoryConnection 계약 → frontend compatibility adapter → GitHub UI 활성화**여야 한다. 이 선행 조건이 해결되기 전에는 GitHub 버튼을 노출하면 안 된다.

### Readiness verdict

| 영역 | 현재 준비도 | 결론 |
|---|---|---|
| 제품 IA / route | 높음 | 재설계 불필요 |
| 일반 학습 화면 | 높음 | Provider metadata만 주입하면 됨 |
| 공통 UI foundation | 중간 | 이름은 generic이지만 호출부 정리가 필요 |
| Auth / account identity | 낮음 | P0 backend contract 선행 |
| Connected Accounts | 낮음 | P0 list/link/disconnect contract 필요 |
| Workspace repository DTO | 낮음 | P0 normalized connection contract 필요 |
| Repository permission | 낮음 | raw GitLab access level 비교 제거 필요 |
| Discovery / Join | 중간 | endpoint/DTO 일부 generic, 실행은 GitLab 고정 |
| Rollout safety | 낮음 | supported-provider capability가 없음 |
| Test foundation | 낮음 | GitLab-only fixture가 공통 동작을 고정함 |

## Audit Method

문자열 검색은 이슈 개수를 세기 위한 것이 아니라 조사 누락을 막기 위해 사용했다. `GitLab`, `gitlab`, `GITLAB`, GitLab 명명 타입, `projectId`, `projectPath`, `repositoryPath`, provider 비교, `RepositoryProvider`, `RepositoryConnection`, `ProviderAccount`, `StorageDetails`, `AuthProviderButton`을 검색하고 실제 사용 의미를 확인했다.

- Frontend app/component/lib 중 GitLab 계열 문자열 포함 파일: 42개
- Frontend test/E2E 중 포함 파일: 3개
- 캡처·QA script 중 포함 파일: 13개
- `gitlabUserId` 또는 `authorGitLabUserId` 사용 frontend 파일: 9개
- `gitlabProjectId` 또는 `gitlabProjectPath` 사용 frontend 파일: 9개
- raw `accessLevel` 크기 비교 frontend 파일: 1개
- `ProviderAccount`/`providerAccounts[]` domain type 또는 API: 없음
- supported auth/repository provider capability endpoint: 없음
- `switch(provider)` 또는 실제 provider별 UI 분기: 없음. 현재 provider가 adapter/DTO에서 항상 GitLab로 고정되기 때문이며, multi-provider 준비가 완료됐다는 의미는 아니다.

CSS class 이름이나 현재 GitLab 전용 사용자 문구만으로 hard-coding 이슈로 판정하지 않았다. 실제 Provider가 GitLab인 화면에서 GitLab이라고 표시하는 것은 현재로서는 정확하다.

## Classification

### A. Already provider-independent

- App route와 Workspace-scoped route: `/today`, `/schedule`, `/library`, `/records`, `/settings/*`, `/workspaces`.
- Today와 Schedule의 주 목록, Library 목록/팀 문서, Records analytics, Activity 목록과 deep link.
- `Workspace` App Role (`OWNER`, `MANAGER`, `MEMBER`)과 UI label.
- `AuthProviderButton`: `provider`, `href`, `icon`, label을 props로 받는다 (`frontend/components/auth/AuthProviderButton.tsx:4`).
- `StorageDetails`: title/description/content만 받는 disclosure foundation이다 (`frontend/components/ui/StorageDetails.tsx:4`).
- Workspace API URL은 대부분 `/api/v1/workspaces/{id}/...` 형태로 Provider-neutral하다.
- Discovery/Join frontend endpoint 이름과 join request는 Workspace 중심이다 (`frontend/lib/api/services/workspaceApi.ts:33`).
- Activity는 notification title/message/actionPath를 렌더링할 뿐 GitLab event enum을 해석하지 않는다 (`frontend/components/notifications/ActivityInbox.tsx:144`).
- 외부 저장소 URL을 `gitlab.com/...` 문자열로 직접 조립하는 page component는 발견하지 않았다. 현재 Library는 API의 `project.webUrl`을 사용한다.
- `RepositoryMembershipPort`와 adapter map은 backend에 존재한다. 다만 현재 service가 `GITLAB`을 직접 선택하므로 아직 완성된 multi-provider contract는 아니다.

### B. GitLab-specific, but currently correct user-facing UI

- Landing의 GitLab 시작 CTA, Data & Trust 설명, Terms/Privacy의 GitLab 데이터 경계.
- Login의 현재 단일 GitLab OAuth action.
- Profile onboarding의 “GitLab 계정 연결 완료”.
- Settings Members의 “GitLab 권한”, Maintainer/Developer 상세, GitLab 멤버 동기화.
- GitLab 저장 구조 migration의 Provider-specific 설명.
- GitLab 장애·재승인·권한 오류를 현재 실제 Provider 이름으로 설명하는 문구.

이 문구를 지금 generic copy로 바꿀 필요는 없다. GitHub 지원 시 descriptor 또는 Workspace Provider context에서 렌더링해야 한다는 의미다.

### C. GitLab hard-coding that must change before GitHub UI

- `RepositoryProvider = "GITLAB"` 단일 union과 Workspace에서 provider를 강제로 만드는 adapter.
- `Workspace`, `StudyMember`, review comment의 GitLab 전용 식별자.
- `GitLabConnectionProvider`를 모든 protected route에 전역으로 감싼 RootShell.
- Workspace Switcher의 `gitlabProjectPath`와 “다른 GitLab 프로젝트 선택”.
- Workspace Connect가 GitLab API/DTO/raw access level을 직접 사용.
- Sidebar/Settings/Library가 `useGitLabConnection`을 직접 사용.
- Discovery UI가 응답의 `provider`를 무시하고 GitLab을 출력.
- `StorageDetails` 호출부 네 곳 이상에 GitLab title/description이 흩어짐.
- Login notice, generic API error map, 401 redirect가 GitLab error code를 직접 해석.
- review의 현재 사용자 판정이 `authorGitLabUserId` 비교에 의존.

### D. Backend contract required first

- 하나의 Study-ing Account에 GitLab + GitHub Provider Account 연결.
- 로그인에 사용한 Provider와 Workspace Repository Provider의 독립성.
- Provider Account 목록/연결/재승인/연결 해제 상태.
- normalized Workspace RepositoryConnection과 provider + external repository ID uniqueness.
- 현재 Workspace에 사용할 credential/account 선택과 서버-side authorization.
- provider-neutral repository list, permission/capability, analysis, connection status DTO.
- OAuth callback의 Provider 식별 및 provider-neutral current-account response.
- supported provider capability/feature rollout 응답.
- multi-provider Discovery의 부분 성공/장애 상태.
- review/submission author의 Study-ing user identity.

### E. Descriptor or small adapter extension is sufficient

- Provider display name/icon/auth label/reconnect label/repository label.
- Workspace Hub의 `Provider · repositoryPath` row.
- Workspace Switcher의 secondary repository identity.
- Sidebar와 Settings Repository의 provider icon/name/status copy.
- Profile onboarding provider success eyebrow.
- StorageDetails title과 “원본 열기” label.
- Provider-aware error/reconnect notice.
- normalized visibility display (`공개`, `비공개`, `내부`).

## Current Provider Architecture

현재 실제 흐름은 다음과 같다.

```text
/login
  -> /api/v1/auth/gitlab/login
  -> /api/v1/auth/gitlab/callback
  -> /api/v1/auth/gitlab/complete
  -> AuthSession.mode = gitlab-oauth
  -> AuthenticatedGitLabUser.id = GitLab user id

AuthProvider
  -> WorkspaceProvider
       current member = member.gitlabUserId === auth user.id
       Workspace.gitlabProjectId / gitlabProjectPath
  -> GitLabConnectionProvider
       /api/v1/gitlab/projects/{gitlabProjectId}/connection-check
  -> AppShell / Settings / Library
```

`Repository`, `RepositoryConnection`, `RepositoryProvider`라는 이름은 존재하지만 현재 adapter는 GitLab DTO를 입력받고 provider를 항상 `GITLAB`으로 만든다 (`frontend/lib/domain/repository.ts:28`, `frontend/lib/domain/repository.ts:41`). 이는 useful façade이지만 provider abstraction의 source of truth는 아니다.

backend에도 `RepositoryProvider`와 `RepositoryMembershipPort`가 있으나 enum은 `GITLAB` 하나뿐이고 Discovery/Access Verifier가 `RepositoryProvider.GITLAB`을 직접 선택한다. Workspace persistence와 JSON state 또한 GitLab project 필드가 필수다.

## GitLab Hard-coding and Severity Findings

| ID | Severity | Class | Finding | Evidence / impact |
|---|---|---|---|---|
| GH-FE-001 | P0 | D | Study-ing account identity가 GitLab identity와 분리되지 않음 | `/auth/me`의 user id가 GitLab id이고 `AuthenticatedGitLabUser`, `StudyMember.gitlabUserId`로 current user를 찾는다. GitHub 로그인 사용자를 기존 Study-ing 계정에 안전하게 연결할 수 없다. `frontend/lib/api/services/authApi.ts:3`, `frontend/components/providers/WorkspaceProvider.tsx:144`, `backend/src/main/java/com/studyworkspace/workspace/controller/AuthController.java:243` |
| GH-FE-002 | P0 | D | OAuth credential이 user당 singleton | `oauth_credentials.user_id`가 PK이고 provider/account column이 없다. GitLab + GitHub credential 동시 보관이 불가능하다. `backend/src/main/java/com/studyworkspace/auth/persistence/OAuthCredentialEntity.java:14`, `backend/src/main/resources/db/migration/V1__identity_and_workspace_metadata.sql:12` |
| GH-FE-003 | P0 | D | Workspace repository contract가 GitLab 필수 필드 | Workspace와 create request가 `gitlabProjectId`, `gitlabProjectPath`를 필수로 요구한다. uniqueness도 GitLab project id 한 컬럼이다. `frontend/lib/domain/types.ts:94`, `frontend/lib/api/services/workspaceApi.ts:249`, `backend/src/main/java/com/studyworkspace/workspace/infrastructure/WorkspaceStateEntity.java:25` |
| GH-FE-004 | P0 | D | Repository operation이 current GitLab OAuth session에 고정 | Workspace controller가 GitLab token provider와 GitLab services를 직접 사용한다. GitLab로 로그인한 사용자가 GitHub Workspace를 쓰는 credential routing이 없다. `backend/src/main/java/com/studyworkspace/workspace/controller/WorkspaceController.java:71`, `:515`, `:596` |
| GH-FE-005 | P0 | D/C | Connected Accounts가 account collection이 아니며 Workspace connection 상태를 재사용 | 단일 `ConnectedAccountsSettings` row가 `useGitLabConnection()`으로 현재 Workspace project 상태를 개인 계정 상태처럼 판정한다. auth/repository scope가 GitHub 추가 시 깨진다. `frontend/components/settings/SettingsWorkspace.tsx:510` |
| GH-FE-006 | P1 | C | protected app 전체가 `GitLabConnectionProvider`에 결합 | GitHub Workspace에서도 GitLab connection query가 실행될 구조다. `frontend/components/shell/RootShell.tsx:33`, `frontend/lib/api/hooks/useGitLabConnection.tsx:32` |
| GH-FE-007 | P1 | C/D | Workspace Connect가 GitLab raw DTO와 numeric ID를 직접 사용 | list/check/analyze/create가 GitLab service 함수와 `number` id, `gitlabProjectId`를 사용한다. `frontend/components/onboarding/WorkspaceOnboarding.tsx:27`, `:72`, `:183` |
| GH-FE-008 | P1 | C/D | Frontend가 GitLab raw access level로 write capability를 판정 | `accessLevel >= 30`이 selection/CTA를 결정한다. GitHub permission model을 추가할 수 없고 backend source-of-truth 원칙과 중복된다. `frontend/lib/domain/repository.ts:61`, `WorkspaceOnboarding.tsx:141` |
| GH-FE-009 | P1 | C/D | Member/review author identity가 GitLab id | `currentGitLabUserId`, `authorGitLabUserId`가 “나” 판정과 write payload 모델에 노출된다. `frontend/components/review/SubmissionReviewPanel.tsx:14`, `frontend/lib/api/services/workspaceApi.ts:305` |
| GH-FE-010 | P1 | C/E | Sidebar repository state는 label만 generic이고 data/error/reload는 GitLab 전용 | provider label과 GitLab hook/error code가 혼합되어 GitHub Workspace에서 모순된 상태를 만들 수 있다. `frontend/components/shell/AppShell.tsx:56` |
| GH-FE-011 | P1 | C/E | StorageDetails 호출부가 Provider를 모름 | 공통 component는 generic이나 Submission, Member Review, Schedule Detail, Library Session이 GitLab title을 직접 전달한다. `frontend/components/today/SubmissionDialog.tsx:275`, `frontend/components/today/MemberDetailDialog.tsx:89`, `frontend/components/schedule/ScheduleDetailPage.tsx:195`, `frontend/components/library/LibrarySessionPage.tsx:82` |
| GH-FE-012 | P1 | C/D | Auth callback/session/error가 Provider를 표현하지 못함 | callback route는 GitLab complete만 호출하고 mode는 `gitlab-oauth` 하나다. 401 interceptor도 `GITLAB_RECONNECT_REQUIRED`만 특별 처리한다. `frontend/components/auth/OAuthCallbackPage.tsx:5`, `frontend/lib/api/client/http.ts:69` |
| GH-FE-013 | P1 | D | Provider capability/feature rollout source가 없음 | frontend/backend 배포 순서가 어긋날 때 GitHub button 노출을 안전하게 제어할 계약이 없다. Public auth provider와 authenticated repository provider capability 모두 필요하다. |
| GH-FE-014 | P2 | C/E | Discovery DTO의 provider를 UI가 무시 | API는 `provider`와 string repository id를 주지만 copy/icon/reconnect가 GitLab 고정이다. `frontend/lib/api/services/workspaceApi.ts:18`, `DiscoverableWorkspaceSection.tsx:96` |
| GH-FE-015 | P2 | C/E | Workspace Hub/Switcher의 generic facade가 원본 GitLab 필드에 의존 | Hub는 provider label을 쓰지만 adapter가 GITLAB을 강제한다. Switcher는 `gitlabProjectPath`를 직접 출력한다. `frontend/components/workspaces/WorkspaceHub.tsx:66`, `frontend/components/shell/WorkspaceSwitcher.tsx:68`, `frontend/lib/domain/repository.ts:41` |
| GH-FE-016 | P2 | C/E | Provider copy와 icon이 분산 | Login, callback, onboarding, settings, app shell, discovery에 label/icon/reconnect copy가 흩어져 있다. `frontend/components/marketing/LoginPage.tsx:82`, `frontend/components/ui/AppLoadingScreen.tsx:23`, `frontend/components/settings/SettingsWorkspace.tsx:452` |
| GH-FE-017 | P2 | B | Public/Legal copy는 현재 정확하지만 GitHub 출시 시 변경 필요 | Landing, metadata, Terms, Privacy의 GitLab 데이터·OAuth·외부 서비스 경계를 release checklist에 포함해야 한다. `frontend/components/marketing/LandingPage.tsx:159`, `frontend/app/terms/page.tsx:17`, `frontend/app/privacy/page.tsx:17` |
| GH-FE-018 | P3 | C | 테스트가 GitLab object만으로 common UI를 검증 | provider-parametric fixture가 없고 test가 `provider === GITLAB`, Developer 숫자, GitLab endpoint를 명시한다. `frontend/tests/repository-connection.test.mjs`, `auth-entry.test.mjs`, `rendered-html.test.mjs` |
| GH-FE-019 | P3 | C | 사용되지 않는 legacy GitLab CSS selector가 남음 | `.gitlab-login-button`, `.auth-transition__gitlab`은 현재 TSX 사용처가 검색되지 않았다. GitHub 작업과 별개로 제거 가능성을 확인하되 이번 audit에서는 삭제하지 않는다. |

P0는 현재 GitLab 기능의 결함이라는 의미가 아니라, GitHub를 “동등한 Provider”로 켤 때 반드시 먼저 해결해야 하는 구조적 blocker라는 의미다.

## Page-by-page Impact

| Page / flow | Current state | Class | GitHub work |
|---|---|---|---|
| Landing `/` | 실제 GitLab 제품 copy와 CTA | B | GitHub release 때 CTA를 generic Login entry로 바꾸고 Data & Trust에 지원 Provider를 정확히 반영 |
| Login `/login` | `AuthProviderButton`은 generic, page/URL/notice는 GitLab 단일 | C/D/E | capabilities로 provider button list 렌더, login-vs-link intent 분리 |
| OAuth callback | GitLab complete 호출과 GitLab progress copy | C/D | server session이 pending provider를 소유하고 generic complete/status 응답 제공 |
| Terms / Privacy | 현재 GitLab 사실을 정확히 설명 | B/D | GitHub OAuth/data flow/외부 서비스/국외 처리/삭제 경계 검토 후 문서 version 갱신 |
| Profile onboarding | profile fields는 generic, provider eyebrow/type은 GitLab | E/C | account response에 initial provider identity를 포함하고 descriptor로 header 렌더 |
| First Workspace | `WorkspaceConnectionFlow` 재사용은 좋으나 GitLab API 직접 결합 | C/D | connected provider account selector + normalized repository adapter |
| Workspace Hub | row presentation은 provider label 사용 | A/C/E | Workspace DTO의 real connection 사용, member lookup을 Study-ing user id로 변경 |
| Workspace Connect | flow IA 재사용 가능 | C/D | Provider Account 선택 → normalized repository list/check/analyze/create |
| Discovery / Join | endpoint/DTO 이름은 generic | C/D/E | response provider를 사용; multi-provider partial errors와 reconnect target 필요 |
| Workspace Switcher | Workspace 선택 자체는 generic | C/E | repository identity DTO 사용, “다른 GitLab 프로젝트” copy를 descriptor화 |
| Today | main page는 provider-neutral | A/C | Submission/MemberDetail의 StorageDetails와 author identity만 변경 |
| Schedule | list/calendar는 provider-neutral | A/C | detail storage copy, editor error mapping, migration/write metadata를 provider-aware 처리 |
| Library | list와 Team Document는 provider-neutral | A/C | Session의 origin link/StorageDetails를 current connection 기반으로 렌더 |
| Records | GitLab import/field/condition 없음 | A | provider matrix regression만 추가 |
| Settings General/Profile/Appearance/Account | provider-neutral | A/B | account-delete copy의 connected providers/repository boundary만 release 시 갱신 |
| Settings Members | App Role 분리는 올바름; repository permission/sync는 GitLab | B/C/D | provider permission display descriptor와 provider-specific member adapter 필요 |
| Settings Repository | current Workspace scope는 올바름; hook/DTO/icon/copy가 GitLab | C/D/E | `RepositoryConnectionStatus` normalized contract로 교체 |
| Settings Connected Accounts | 단일 row이며 workspace connection과 혼합 | D/C | `ProviderAccount[]` list와 account-scoped status/action 필요 |
| Settings Data/Migration | route/IA generic, execution/copy는 GitLab | B/C/D | backend provider support 후 descriptor copy; unsupported capability이면 action 숨김 |
| Activity | frontend renderer/deep link는 generic | A/E | provider outage notification은 payload provider/name 또는 already localized server copy 사용 |
| Submission | workspace endpoint와 form은 generic | A/C | storage label과 repository capability/error context 변경 |
| Member Review | UI는 generic, identity/storage/backend comment는 GitLab | C/D | author Study-ing user id + provider-neutral review DTO/adapter |
| Pre-submission Warning | provider dependency 없음 | A | regression only |
| Sidebar status | current Workspace scope는 올바름 | C/D/E | selected Workspace connection을 key로 generic query/reconnect 사용 |
| Toast / Modal / Drawer | provider dependency 없음 | A | regression only |

## Type and DTO Impact

### Current frontend types

| Current | Problem | Target shape |
|---|---|---|
| `RepositoryProvider = "GITLAB"` | extension point가 compile-time singleton | `"GITLAB" | "GITHUB"`, but only capability-enabled providers rendered |
| `Repository.id: number` | provider ID가 opaque하지 않고 DTO마다 number/string이 다름 | `externalRepositoryId: string` |
| `Repository.accessLevel?: number` | GitLab raw enum이 common UI에 누출 | `capabilities: { read; write; admin }` plus optional technical display |
| `Workspace.gitlabProjectId/Path` | Workspace가 GitLab schema를 노출 | `repositoryConnection: RepositoryConnection | null` |
| `StudyMember.gitlabUserId` | app member identity와 provider identity 혼합 | `userId`, `repositoryIdentity?`, `repositoryPermission` |
| `AuthenticatedGitLabUser` | Study-ing profile와 로그인 Provider identity 혼합 | `CurrentAccount` + `ProviderAccount[]` |
| `AuthSession.mode = gitlab-oauth` | login provider와 account session을 동일시 | `authenticated`, `account`, `authenticatedVia?`; UI should not infer workspace provider |
| `DiscoverableWorkspace.provider: "GITLAB"` | literal singleton | `RepositoryProvider` plus providerAccount/reconnect context where needed |
| `SubmissionReviewThread.authorGitLabUserId` | author attribution provider-bound | `authorUserId`, provider-specific external actor only in technical metadata |

### Recommended normalized contracts

```ts
type RepositoryProvider = "GITLAB" | "GITHUB";

interface ProviderAccount {
  id: string;                    // Study-ing provider-account id
  provider: RepositoryProvider;
  externalAccountId: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  status: "CONNECTED" | "REAUTHORIZE_REQUIRED" | "DISCONNECTED";
}

interface RepositoryIdentity {
  provider: RepositoryProvider;
  externalRepositoryId: string; // opaque
  fullName: string;
  displayName: string;
  visibility: "PUBLIC" | "PRIVATE" | "INTERNAL" | "UNKNOWN";
  defaultBranch?: string;
  externalUrl?: string;
}

interface RepositoryCapabilities {
  canRead: boolean;
  canWrite: boolean;
  canAdmin: boolean;
  displayPermission?: string;    // advanced detail only
}

interface RepositoryConnection {
  repository: RepositoryIdentity;
  providerAccountId?: string;    // if the server exposes the selected account
  status: "CONNECTED" | "REAUTHORIZE_REQUIRED" | "ACCESS_REVOKED" | "UNAVAILABLE";
}
```

Capability는 display 편의를 위한 응답이며 최종 권한 판정은 계속 backend가 수행해야 한다. Frontend가 GitHub role name이나 GitLab 숫자를 다시 해석해서는 안 된다.

## Provider Descriptor

현재는 `REPOSITORY_PROVIDER_LABEL` 한 개만 있고 icon/auth/reconnect/repository copy는 각 page에 흩어져 있다. descriptor 도입이 필요하다.

```ts
interface ProviderDescriptor {
  id: RepositoryProvider;
  displayName: string;
  icon: ProviderIconKey;
  authLabel: string;
  reconnectLabel: string;
  repositoryLabel: string;
  repositoryPluralLabel: string;
}
```

Descriptor는 UI presentation만 담당한다. OAuth endpoint, permission rule, repository URL format 같은 보안/도메인 규칙을 descriptor에 두지 않는다. 노출 여부는 hard-coded descriptor 존재 여부가 아니라 backend capability와의 교집합으로 결정한다.

현재 Login/Settings는 Study-ing purple primary action과 neutral provider icon을 사용하므로 Provider brand hierarchy는 적절하다. GitHub 추가 후에도 provider brand color로 primary button 색을 바꾸지 않는다.

## Auth

### Reusable

- Login layout은 provider button을 하나 더 렌더링할 공간이 있다.
- `AuthProviderButton`은 provider, icon, href, children을 받는다.
- `safeAppReturnUrl`, already-authenticated redirect, profile/workspace routing은 provider와 무관하다.

### Blockers

- OAuth start/complete URL이 `/api/v1/auth/gitlab/*`로 고정되어 있다.
- callback component와 metadata가 GitLab을 직접 표시한다.
- Auth context의 user type과 mode가 GitLab identity다.
- backend session attribute와 authentication principal도 `GitLabUser`다.
- “기존 Study-ing 계정에 다른 Provider 연결”과 “새 Study-ing 계정으로 로그인”의 account-linking policy/endpoint가 없다.

권장 callback은 client가 임의 provider/token을 전달하는 방식이 아니다. backend가 OAuth state/session에 pending provider와 intent(`LOGIN`/`LINK`)를 보관하고 generic complete endpoint가 이를 판정해야 한다. frontend는 whitelisted provider id를 display 용도로만 사용하거나 complete response의 provider를 사용한다.

### Future login copy

Landing의 primary CTA는 GitHub 지원 시 **“Study-ing 시작하기”**로 Login에 보내는 방식이 가장 자연스럽다. Login에서 capability-enabled provider buttons를 나열한다. Landing에 provider별 primary CTA 두 개를 경쟁시키는 것보다 Login과 Landing의 역할 분리가 유지된다.

## Connected Accounts

현재 Settings IA는 “연결된 계정”과 “저장소 연결”을 분리해 두어 올바르다. 하지만 데이터 구현은 분리되어 있지 않다.

- `ConnectedAccountsSettings`는 배열이 아니라 GitLab singleton row다.
- 상태는 개인 Provider Account API가 아니라 현재 Workspace의 `useGitLabConnection`에서 가져온다.
- username fallback도 auth user → current repository connection user → current Workspace member 순서다.
- connect/disconnect/list API가 없고 reauthorize URL만 있다.

필요한 계약은 `GET /provider-accounts`, `POST /provider-accounts/{provider}/link`, provider-account 단위 reauthorize/disconnect다. 정확한 route 이름은 backend convention에 맞추되 응답은 배열이어야 한다. 동일 Provider 여러 계정은 이번 목표가 아니더라도 frontend key는 provider enum이 아니라 providerAccount id를 사용할 것을 권장한다.

## Workspace Connect and Repository Selector

현재 4단계 IA(선택 → 권한 → 분석 → 연결)는 그대로 재사용할 수 있다. GitHub 추가 시 첫 입력은 단순 Provider tab보다 **저장소 계정 선택**이 더 정확하다.

```text
저장소 계정
GitLab · @kim       selected
GitHub · @kim-dev

저장소
...
```

이 방식은 Authentication Provider와 Repository Provider를 분리하고 향후 동일 Provider multi-account도 막지 않는다. 연결된 계정이 하나뿐이면 자동 선택하되 현재 계정 identity는 표시한다.

Repository row의 normalized 최소 필드는 `displayName`, `fullName`, `visibility`, `provider`, `alreadyConnected`, `joinable`, `capabilities`, `externalUrl`이다. 현재 `toRepository(GitLabProject)` adapter는 GitLab API layer 옆으로 이동하고 UI에는 normalized object만 전달해야 한다.

현재 frontend가 `accessLevel >= 30`으로 버튼을 막는 것은 제거 대상이다. Backend가 `canConnect`, `canJoin`, `canSubmit` 또는 normalized capability/eligibility를 반환하고 실제 action에서 재검증해야 한다.

## Discovery and Join

긍정적인 점:

- `/api/v1/workspaces/discoverable`과 `/join`은 provider 이름을 route에 포함하지 않는다.
- DTO는 이미 `provider`, string `repositoryId`, `repositoryPath`를 포함한다.
- Join request는 workspace id만 보내며 client가 role/permission을 보내지 않는다.

남은 문제:

- UI가 `item.provider`를 사용하지 않는다.
- reconnect action은 GitLab URL 하나뿐이다.
- backend Discovery service는 GITLAB port와 GitLab OAuth session을 직접 선택한다.
- 여러 Provider를 조회할 때 한 Provider outage가 전체 Discovery를 실패시킬지 정의되지 않았다.

여러 Provider에서는 다음과 같은 partial result 계약이 안전하다.

```ts
interface WorkspaceDiscoveryResponse {
  items: DiscoverableWorkspace[];
  providerStatuses: Array<{
    provider: RepositoryProvider;
    providerAccountId: string;
    status: "READY" | "REAUTHORIZE_REQUIRED" | "UNAVAILABLE";
  }>;
}
```

GitLab 장애가 GitHub Discovery와 기존 Workspace 사용을 막아서는 안 된다. Join endpoint는 계속 workspace id만 받아도 되지만 server가 해당 Workspace connection provider와 연결 account를 선택하고 join 시 재검증해야 한다.

## Sidebar, Settings, and Provider Status

현재 Sidebar status의 scope가 “현재 Workspace Repository”인 점은 올바르다. 이 의미를 유지하면서 `GitLabConnectionProvider`를 `RepositoryConnectionProvider` 또는 workspace-keyed hook으로 바꿔야 한다.

필요 상태:

- provider
- repository identity
- connection status
- error category (`ACCESS_REVOKED`, `REAUTHORIZE_REQUIRED`, `UNAVAILABLE`)
- reload/reconnect action

Settings > 연결된 계정은 account-scoped query를, Settings > 저장소 연결과 Sidebar는 workspace-scoped query를 사용해야 한다. 같은 hook이나 상태 객체를 공유하면 안 된다.

## StorageDetails and External URLs

`StorageDetails` 자체는 이미 generic이다. 문제는 caller가 title/description과 provider link를 직접 구성한다는 점이다.

영향 위치:

- `frontend/components/today/SubmissionDialog.tsx:275`
- `frontend/components/today/MemberDetailDialog.tsx:89`
- `frontend/components/schedule/ScheduleDetailPage.tsx:195`
- `frontend/components/library/LibrarySessionPage.tsx:56`, `:82`

권장 방식은 current Workspace `RepositoryConnection`을 받는 `RepositoryStorageDetails` wrapper 또는 provider display helper다. raw path/commit/revision은 기존 progressive disclosure 안에 유지한다.

현재 page가 GitLab blob URL을 문자열 조합하지 않는 점은 좋다. GitHub 추가 후에도 backend가 resource별 `externalUrl`을 반환하는 방식을 우선한다. 불가피하면 provider adapter 한 곳에서만 URL을 생성한다.

## Submission, Review, Schedule, Library, Records, Activity

- Submission: form/API path는 generic. provider-specific storage label, error context, commit wording만 분리한다. Git 기반 provider에는 commit이 공통이지만 장기 Managed Storage까지 고려하면 기본 UI에서는 “저장 메시지”를 유지한다.
- Review: visual UI는 재사용 가능. backend GitLab commit comment 구현과 author GitLab id를 normalized review contract 뒤로 숨겨야 한다.
- Schedule: 목록/캘린더는 그대로 유지. editor의 GitLab error code/copy와 detail StorageDetails만 변경한다.
- Library: 목록/팀 문서는 그대로 유지. Session page의 origin URL/label만 provider-aware하게 한다.
- Records: provider-specific 코드가 발견되지 않았다. regression test만 필요하다.
- Activity: renderer는 generic하다. Provider 장애 notification을 backend가 localized text로 보낼 수 있으나 구조화된 provider 표시가 필요해지면 payload에 provider를 추가한다. GitLab-only event enum을 frontend에 새로 만들 필요는 없다.

## Errors and Reconnect

현재 `ERROR_COPY`와 HTTP 401 redirect는 GitLab error code를 직접 해석한다. 목표는 error category와 provider context를 분리하는 것이다.

```ts
interface ProviderErrorContext {
  category: "REAUTHORIZE_REQUIRED" | "ACCESS_REVOKED" | "UNAVAILABLE" | "RATE_LIMITED";
  provider?: RepositoryProvider;
  providerAccountId?: string;
}
```

사용자 문구와 icon은 descriptor에서 만들고, redirect/reconnect URL은 backend가 안전하게 생성하거나 provider-account API를 통해 얻는다. `REPOSITORY_PROVIDER_UNAVAILABLE` 같은 generic code에 GitLab 문구를 고정하지 않는다.

## Capability and Rollout

현재 capability endpoint 또는 feature flag는 검색되지 않았다. 권장 최소 계약:

```ts
interface PublicCapabilities {
  authProviders: RepositoryProvider[];
}

interface AccountCapabilities {
  connectableAccountProviders: RepositoryProvider[];
  repositoryProviders: RepositoryProvider[];
}
```

Frontend descriptor registry에 GitHub가 존재해도 backend capability가 없으면 렌더링하지 않는다. 배포 순서는 backend capability default-off → frontend code 배포 → backend GitHub 기능 검증 → capability on이다. build-time env 하나만으로 제어하면 frontend/backend 버전 불일치를 발견하기 어려우므로 backend capability를 우선한다.

## API Contract Dependencies

| Contract | Current | Required before GitHub exposure |
|---|---|---|
| Current account | GitLab profile object; id is GitLab user id | stable Study-ing account + linked `ProviderAccount[]` |
| OAuth credential | one credential row per user | one credential per Provider Account, encrypted and independently renewable |
| Auth start/callback | `/auth/gitlab/*` | provider-aware start/link intent with server-owned OAuth state |
| Provider capabilities | none | public auth providers and authenticated repository providers, default GitHub off |
| Workspace repository | required `gitlabProjectId/path` | `RepositoryConnection { provider, externalRepositoryId, fullName, ... }` |
| Repository identity | number in connect, string in discovery | opaque string consistently, scoped by provider |
| Repository list/check/analyze | `/gitlab/projects/*` raw DTO | normalized repository/capability/analysis contract or adapter endpoint |
| Permission | GitLab access level number | backend-decided eligibility/capabilities plus optional technical display |
| Connected Accounts | no list contract | account-scoped list/link/reauthorize/disconnect status |
| Discovery | GitLab session; plain item array | multi-account/provider result with partial provider statuses |
| Repository status | GitLab connection response | workspace-scoped provider-neutral status/error/reconnect context |
| Review/member author | GitLab user id | stable Study-ing user id; provider external id stays technical metadata |
| External origin link | GitLab project `webUrl` | backend-supplied provider-safe repository/resource URL |

## Recommended Frontend Target Architecture

현재 Next/React context와 API service 구조를 유지하고 새 state library를 도입하지 않는다.

```text
frontend/lib/providers/
  types.ts
  descriptors.ts
  display.ts

frontend/lib/api/types/
  account.ts
  repository.ts
  workspace.ts

frontend/lib/api/services/
  providerAccountsApi.ts
  repositoriesApi.ts
  workspaceApi.ts
  gitlabApi.ts             # adapter-only compatibility boundary

frontend/lib/api/hooks/
  useRepositoryConnection.tsx
  useProviderAccounts.ts

frontend/components/providers/
  ProviderIcon.tsx
  ProviderIdentity.tsx
  ProviderReconnectNotice.tsx

frontend/components/repositories/
  RepositoryAccountSelector.tsx
  RepositorySelector.tsx
  RepositoryIdentity.tsx
  RepositoryStorageDetails.tsx

frontend/components/auth/
  AuthProviderButton.tsx   # existing

frontend/components/settings/
  ProviderAccountRow.tsx
```

Provider-specific API response type는 `gitlabApi.ts`/adapter 경계 밖으로 나오지 않게 한다. Domain component는 normalized DTO만 사용한다.

## Minimum Pre-backend Refactor

GitLab 동작과 사용자 UI를 그대로 유지하면서 먼저 할 수 있는 작업이다.

1. Provider descriptor/`ProviderIcon`을 만들고 현재 GITLAB 하나만 등록한다.
2. Login/onboarding/settings/discovery/storage copy와 icon을 descriptor에서 렌더링한다.
3. `Repository.id`를 UI boundary에서 opaque string으로 normalize하고 GitLab adapter에서 변환한다.
4. raw GitLab permission 해석을 adapter로 이동하고 common UI는 `canWrite`를 사용한다. 최종 판정은 backend에 둔다.
5. `useGitLabConnection` 위에 `useRepositoryConnection` compatibility façade를 두고 AppShell/Settings/Library가 generic hook만 사용하게 한다.
6. `WorkspaceSwitcher`와 Hub가 `getWorkspaceRepositoryConnection` 결과만 사용하게 한다.
7. `StorageDetails` callers를 provider-aware wrapper로 통합한다.
8. Login/error/reconnect display를 provider parameter 기반으로 바꾼다.
9. GitLab fixture와 동일한 normalized shape의 second-provider fixture를 추가해 common component parametric test를 만든다. GitHub UI는 capability off 상태로 유지한다.

Study-ing user id/member id 변경, Provider Accounts 배열, Workspace DTO 교체는 backend contract 없이 의미 있게 완료할 수 없으므로 compatibility 이름 바꾸기로 숨기지 않는다.

## Backend-dependent Frontend Work

- Stable Study-ing account id와 `ProviderAccount[]`.
- provider/account-aware OAuth link/login/callback/reauthorize/disconnect.
- Workspace `repositoryConnection` normalized DTO.
- `(provider, externalRepositoryId)` uniqueness와 opaque string ID.
- provider-aware repository list/check/analyze/external URL.
- provider-aware credential selection for every Workspace read/write.
- normalized repository capabilities/permission display.
- Discovery partial provider status와 account-specific reconnect.
- Review/member author Study-ing user id.
- supported provider capability endpoint.

Frontend-only mock으로 이 항목을 구현하거나 GitHub 버튼을 켜면 안 된다.

## Test Strategy

### Contract and unit

- Descriptor completeness for every capability-enabled provider.
- Unknown provider fails closed and does not render an action.
- Repository IDs remain strings and are never numerically compared.
- visibility normalization: GitLab/GitHub public/private/internal/unknown.
- permission matrix uses capabilities, not provider raw enums.
- provider-aware error category/copy/reconnect target.
- Workspace Hub/Switcher/StorageDetails parameterized by GITLAB and GITHUB.

### Auth/account matrix

- GitLab initial login → GitHub link.
- GitHub initial login → GitLab link.
- reauthorize one account does not change Workspace repository connection.
- provider callback restores safe `returnTo`.
- capability off means no GitHub action in DOM.
- account-link collision is handled by backend, not silently merged by frontend.

### Workspace matrix

- GitLab login + GitLab Workspace.
- GitLab login + GitHub Workspace.
- GitHub login + GitLab Workspace.
- GitHub login + GitHub Workspace.
- Workspace switch immediately updates Sidebar/Settings/StorageDetails provider.
- one Provider outage does not label another Provider as failed.
- reconnect action targets the correct Provider Account.

### Connect/discovery

- one connected account auto-selected but visibly identified.
- two Provider Accounts can switch repository results without stale rows.
- already connected/joinable state uses `(provider, externalRepositoryId)`.
- GitLab and GitHub repositories with the same numeric-looking ID do not collide.
- partial Discovery outage preserves results from the healthy Provider.
- join request does not accept role or client permission.

### Visual/accessibility

- Login provider list desktop/mobile.
- Connected Account rows desktop/mobile.
- Workspace Connect selector/search/permission/analysis.
- Hub/Discovery/Sidebar/Settings/StorageDetails/Reconnect.
- provider icon has accessible text via adjacent label; decorative icon is hidden.
- keyboard order and focus remain unchanged when provider rows are added.

## Migration Order

1. Freeze target normalized contracts and identity/linking policy.
2. Add backend Provider Account + Workspace RepositoryConnection contracts with GitLab data migration/compatibility.
3. Add capability endpoint, default GitHub off.
4. Ship Phase 1 frontend refactor with GITLAB-only capability.
5. Integrate GitHub auth/linking while repository capability remains off.
6. Integrate GitHub repository/search/connection/status/storage details.
7. Integrate Discovery/Join and partial outage behavior.
8. Run full cross-provider matrix, then update Landing/Legal copy and enable capability.

## Risks

1. **Identity collision or accidental account split (P0):** GitLab and GitHub identities must link to one stable Study-ing account only through an authenticated linking flow.
2. **Wrong credential for a Workspace (P0):** current login provider must never implicitly select repository credential.
3. **Cross-provider repository ID collision (P0):** repository ID is only unique with provider; use opaque string and composite identity.
4. **Stale provider state (P1):** Workspace switch must key status/cache by workspace id + repository connection identity.
5. **Partial provider outage (P1):** one Provider failure must not become global auth/session failure or hide healthy Provider results.
6. **Permission drift (P1):** frontend capability is display-only; writes must be server-revalidated.
7. **Unsafe external URL (P1):** prefer backend-provided URL and retain allowed-scheme validation at rendering boundary.
8. **Premature rollout (P1):** GitHub descriptor presence must not expose UI without backend capability.
9. **Legal mismatch (P2):** GitHub launch changes OAuth, external service, repository data and possible overseas-processing disclosures.
10. **Fixture false confidence (P3):** GitLab-only snapshots can pass while generic UI is broken.

## Audit Validation

- `npm run lint`: PASS
- `npx tsc --noEmit --incremental false`: PASS
- `npm test`: environment-blocked before build. The workspace is running Node `18.19.1`, while `frontend/package.json` requires Node `>=22.13.0`; vinext imports `node:fs/promises.glob`, which is unavailable in Node 18.
- Direct `node --test tests/*.test.mjs`: not a substitute for the required build. Eight rendered-route tests passed and three TypeScript-importing suites could not load `.ts` under Node 18.
- No application source, route, API, visible GitHub UI, or backend behavior was changed by this audit.

## Audit Conclusion

Study-ing은 화면 구조를 다시 설계할 필요가 없다. 먼저 해결할 것은 presentation이 아니라 account identity, credential collection, Workspace repository connection, provider capability 계약이다. 그 계약이 준비되면 Login, Connected Accounts, Workspace Connect, Sidebar/Settings status, StorageDetails를 descriptor와 normalized DTO로 연결하는 범위로 GitHub frontend integration을 제한할 수 있다.

이번 audit에서는 GitHub 버튼, GitHub fixture 기반 사용자 UI, backend GitHub adapter, 기존 GitLab 동작 변경을 수행하지 않았다.
