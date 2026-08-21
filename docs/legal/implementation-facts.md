# Study-ing 구현 사실

> 감사 기준일: 2026-08-13
> 문서 성격: 코드와 저장소 내 운영 설정에서 확인한 구현 사실. 법률 자문이나 승인된 운영 정책이 아니다.
> 상태: `CONFIRMED`는 코드/설정에서 직접 확인, `INFERRED`는 프레임워크 기본 동작이나 배포 문서로 추론, `UNKNOWN`은 저장소만으로 확정할 수 없음을 뜻한다.

## 1. 감사 범위와 근거

| 상태 | 범위 | 주요 근거 |
|---|---|---|
| CONFIRMED | Backend schema와 persistence | `backend/src/main/resources/db/migration/V1`, `V3`~`V9`, `db/production/V2__spring_session.sql` |
| CONFIRMED | OAuth, session, account deletion | `OAuthAccountService`, `GitLabOAuthService`, `GitLabOAuthTokenProvider`, `AuthController`, `SecurityConfig` |
| CONFIRMED | Workspace, membership, soft delete, purge | `WorkspaceService`, `WorkspaceStateEntity`, `WorkspaceAccessService` |
| CONFIRMED | GitLab read/write boundary | `GitLabOAuthProjectService`, `GitLabSessionFileService`, `GitLabSubmissionFileService`, `SubmissionReviewService` |
| CONFIRMED | DB-only collaboration data | `WorkspaceDocumentService`, `WorkspaceFeedService`, `InAppNotificationService`, `AuditEventService`, `SyncJobService` |
| CONFIRMED | Browser storage and public copy | `AppThemeProvider`, `demoDocuments`, `/login`, `/privacy`, `/terms` |
| CONFIRMED | Repository-owned deployment templates | `application.yml`, `application-prod.yml`, `compose.prod.yml`, `compose.sandbox.yml`, `deploy/nginx.conf`, `docs/operations/production.md` |
| UNKNOWN | 실제 공개 운영 환경의 서버 사업자, 물리 지역, DNS/CDN, DB host, 모니터링 사업자 | 배포된 인프라 inventory나 계약서가 저장소에 없음 |

## 2. 현재 제품과 account 모델

| 상태 | 사실 |
|---|---|
| CONFIRMED | 현재 로그인 Provider는 GitLab OAuth와 capability-gated GitHub App user authorization이다. GitLab scope 기본값은 `api`다. GitHub email은 요청·저장하지 않으며 verified `(provider, externalUserId)`만 로그인 identity로 사용한다. |
| CONFIRMED | Study-ing 사용자 계정(`user_accounts`), 외부 `provider_accounts`, Provider별 `oauth_credentials`는 별도 row다. |
| CONFIRMED | Workspace는 현재 GitLab project ID에 1:1로 연결되며 `gitlab_project_id`에 unique constraint가 있다. |
| CONFIRMED | Study-ing 역할 `OWNER`/`MANAGER`/`MEMBER`와 GitLab access level은 별도 필드다. |
| CONFIRMED | 결제, 가격, 구독, 광고, checkout 기능 또는 관련 SDK가 코드에 없다. |
| CONFIRMED POLICY | 현재 이호철 개인 개발자가 운영하는 무료·비상업 토이 프로젝트이며 유료 plan, 결제, 광고, marketing 활용, 개인정보 판매가 없다. 서비스 및 개인정보 문의 채널은 `ho7e09152@gmail.com`이다. |

## 3. 개인정보와 서비스 데이터 목록

### 3.1 Account와 profile

| 상태 | 저장 위치 | 필드/데이터 | 생성·갱신 | 목적 | 암호화 | 삭제/보유 |
|---|---|---|---|---|---|---|
| CONFIRMED | PostgreSQL `user_accounts` | 내부 UUID, GitLab user ID, username, display name, avatar URL, GitLab web URL, created/updated time | OAuth 완료 때 생성, 로그인 때 GitLab 값 동기화 | 로그인 사용자 식별, 프로필 표시 | DB column 자체 암호화 없음 | 계정 탈퇴 때 user row hard delete |
| CONFIRMED | `user_accounts` | profile completed, 학습 기록 파일명, IANA timezone | onboarding/profile 저장 | 프로필 및 GitLab 제출 파일명, 시간 표시 | 없음 | 계정 row와 함께 삭제 |
| CONFIRMED | `user_accounts` | theme mode, accent color | 설정 저장 | 화면 환경 설정 | 없음 | 계정 row와 함께 삭제 |
| CONFIRMED | `user_accounts` | `terms_version`, `terms_agreed_at`, `privacy_version`, `privacy_agreed_at`, `minimum_age_confirmed_at` | 최초 onboarding 동의 시 각각 기록; 일반 profile 수정은 동의 시각을 변경하지 않음 | 약관·처리방침 동의와 만 14세 이상 확인 | 없음 | 계정 row와 함께 삭제 |
| CONFIRMED | Browser localStorage `study-workspace-theme` | theme mode, accent color | 테마 변경 시 | 즉시 화면 반영 및 demo/실패 rollback | 브라우저 저장소 평문 | 자동 expiry 없음; 사용자가 browser storage 삭제 가능 |
| CONFIRMED | Browser localStorage `study-demo-library-documents` | demo 팀 문서 title/body/author/time | demo mode 문서 조작 | demo 기능 | 평문 | 자동 expiry 없음; 실제 OAuth Workspace 데이터와 별개 |
| CONFIRMED | Browser sessionStorage `study-ing-demo-session` | 데모 활성 여부 | 랜딩/로그인의 명시적 데모 진입 | 현재 탭에서 실제 인증 데이터와 데모 데이터 분리 | 평문; 인증정보 아님 | 탭 종료 또는 데모 종료/로그인 진입 시 제거 |

### 3.2 OAuth credential과 session

| 상태 | 저장 위치 | 필드/데이터 | 생성·갱신 | 목적 | 보호조치 | 삭제/보유 |
|---|---|---|---|---|---|---|
| CONFIRMED | PostgreSQL `oauth_credentials` | ProviderAccount별 access token ciphertext, optional refresh token ciphertext/expiry, scope, updated time | OAuth code 교환 및 재승인/refresh 때 rotate | Provider identity 연결과 지원되는 Provider API 호출 | 32-byte key를 쓰는 AES/GCM/NoPadding, random 12-byte nonce, 128-bit tag | account delete 때 ProviderAccount FK cascade; 현재 GitLab logout은 GitLab credential도 삭제 |
| CONFIRMED | Environment `OAUTH_TOKEN_ENCRYPTION_KEY` | Base64 32-byte encryption key | 배포 시 주입 | OAuth token 암복호화 | production profile에서 필수 | 실제 secret manager와 rotation 운영은 UNKNOWN |
| CONFIRMED | JDBC `SPRING_SESSION` / `SPRING_SESSION_ATTRIBUTES` | session ID metadata, stable Study-ing principal, CSRF token, GitLab login state/return/pending code, GitHub link state/action/user binding/PKCE verifier와 생성 시각 | login/link/callback/request | 브라우저 session, CSRF, OAuth state 검증 | DB 접근통제에 의존; OAuth access/refresh token은 session attribute에 넣지 않음 | inactivity timeout 8시간; logout/account delete 때 현재 session invalidate |
| CONFIRMED | Browser session cookie | session identifier | session 생성 | 서버 JDBC session 연결 | HttpOnly, SameSite=Lax; production profile Secure=true | max-age/domain/name을 명시 설정하지 않음 |
| INFERRED | Browser session cookie | 기본 이름은 Spring Session의 `SESSION`일 가능성이 높음 | framework default | 동일 | 동일 | 실제 배포 응답으로 최종 확인 필요 |
| CONFIRMED | In-memory backend | repository membership verification cache: user/workspace/state/verified time | login bulk verification, workspace access | GitLab 권한 재검증 호출 절감 | process memory | 기본 TTL 5분; process restart 시 소멸 |

Important OAuth details:

- **CONFIRMED** OAuth state is 32 random bytes, stored server-side, constant-time compared, and valid for 10 minutes.
- **CONFIRMED** GitHub Account linking uses the GitHub App user-authorization web flow, binds state to the authenticated internal user id and action `LINK`, and uses PKCE S256. GitHub App user access tokens use fine-grained App/installation/user permissions rather than classic OAuth scopes; email is not requested or stored.
- **CONFIRMED** GitHub ProviderAccount stores external user ID, username, optional display name, avatar URL and profile URL. Its token is encrypted under the same `TokenCipher`. When repository capability is enabled, the adapter processes installation/repository metadata, permissions, files, commits and commit comments needed for Workspace actions.
- **CONFIRMED** callback authorization `code` is temporarily stored in JDBC session until `/gitlab/complete`; if completion is abandoned, no dedicated cleanup exists beyond session expiry.
- **CONFIRMED** logout and account delete attempt GitLab token revocation, but revocation failure is intentionally ignored so local logout/delete can finish. The local credential row is still deleted.
- **CONFIRMED** access/refresh token DTO and session `toString()` redact token values.
- **CONFIRMED** application log statements found in the audit do not intentionally print Authorization headers or token values.

### 3.3 Workspace 상태, 일정, 제출, 멤버, 설정

| 상태 | 저장 위치 | 필드/데이터 | 목적 | 다른 서비스 전송 | 삭제/보유 |
|---|---|---|---|---|---|
| CONFIRMED | PostgreSQL `workspace_metadata` columns | workspace ID/name, GitLab project ID/path, default branch, repository base path/schema/import mode, timezone, status, timestamps, sync time, optimistic version | Workspace 연결·상태·동기화 | GitLab project ID/ref를 GitLab API에 전송 | soft delete 후 7일, 매일 03:17 purge job이 expired row hard delete |
| CONFIRMED | `workspace_metadata.state_json` | members, roles/status/access level, schedules/items/deadlines, submissions/body/reflection, notification settings, repository metadata | Workspace runtime state와 GitLab 원본 cache | schedule/submission write와 sync 시 GitLab과 양방향 | workspace row와 함께 삭제; 활성 Workspace에는 별도 expiry 없음 |
| CONFIRMED | GitLab repository | `{학습 기록 위치}/.study-workspace/config.yml`, `session.yml`, 멤버 Markdown submission files, commit history/author name/message | 학습 일정·제출의 원본과 변경 이력 | Study-ing이 OAuth 사용자 token으로 read/write | Study-ing account/workspace 삭제가 GitLab 파일이나 history를 삭제하지 않음 |
| CONFIRMED | PostgreSQL schema `workspace_memberships` | workspace/user/role/status/joined time | V1 schema에 존재 | 없음 | FK cascade 정의 |
| CONFIRMED | Current runtime implementation | membership는 별도 JPA entity/table이 아니라 `workspace_metadata.state_json`의 `members` 배열에서 읽고 쓴다 | 접근통제/역할 | GitLab member API와 sync | workspace state 정책을 따름 |
| INFERRED | `workspace_memberships` | 현재 runtime에서 사용되지 않는 legacy/unused table | 코드 검색상 repository/entity가 없음 | 없음 | 실제 production row 존재 여부 UNKNOWN |

`state_json`의 주요 개인정보성 필드:

- **CONFIRMED** member: GitLab user ID, username, display name, initial/avatar text, color, submission filename, Study-ing role/status, GitLab access level.
- **CONFIRMED** schedule: title, description, item title/type/source/URL, deadlines, creator/updater strings, commit ID.
- **CONFIRMED** submission: member ID, GitLab user ID, username, item response type/value/language, submitted/updated time, reflection, commit ID/message.
- **CONFIRMED** settings: workspace timezone, change-note rule, notification toggles.

### 3.4 팀 문서, message, 공지, review

| 상태 | 저장 위치 | 데이터 | 생성·이용 | 삭제/보유 |
|---|---|---|---|---|
| CONFIRMED | PostgreSQL `workspace_documents` | author account ID, author display name, title, Markdown body, version, timestamps, deletedAt | 팀 문서 작성/검색/열람 | author delete 시 account FK is set null but display name/body remain; document delete is soft delete with no per-document purge job |
| CONFIRMED | PostgreSQL `workspace_messages` | author account ID/display name, context date, body, timestamps, deletedAt | Workspace 메시지 | author delete 시 FK null but display name/body remain; message delete is soft delete with no per-message purge job |
| CONFIRMED | PostgreSQL `workspace_announcements` | author ID/display name, title/body, pinned, publish/expiry/update/archive time | Workspace 공지 | author delete 시 FK null but display name/body remain; UI delete archives; no archive purge period |
| CONFIRMED | PostgreSQL `announcement_reads` | announcement ID, account ID, read time | 공지 읽음 상태 | account/workspace/announcement delete cascade |
| CONFIRMED | GitLab commit comments | review body, GitLab author identity/avatar, time, commit relation | 제출 review 조회/작성 | Study-ing DB에는 review body를 저장하지 않음; Study-ing deletion does not delete GitLab comment/history |

### 3.5 알림, activity, audit, sync

| 상태 | 저장 위치 | 데이터 | 목적 | 삭제/보유 |
|---|---|---|---|---|
| CONFIRMED | PostgreSQL `in_app_notifications` | recipient GitLab user ID, workspace ID, type/title/message/action path, readAt, createdAt | Activity 새 소식 및 읽음 상태 | list는 최근 50개; 90일 초과 record daily cleanup; 계정 탈퇴 시 recipient record 즉시 삭제 |
| CONFIRMED | Frontend derived state | Activity todo | current Workspace schedule/submission state에서 계산 | 별도 todo table 저장 없음 |
| CONFIRMED | PostgreSQL `audit_events` | workspace/account actor FK, event/target type and ID, JSON details, createdAt | 설정/멤버/일정/제출/문서/메시지/sync 변경 감사 | 최근 100개 조회; 180일 초과 record daily cleanup; 계정 탈퇴 시 actor FK 즉시 제거 |
| CONFIRMED | PostgreSQL `sync_jobs` | workspace ID, job type/status, sanitized domain error code/message, start/end | GitLab sync 상태/실패 진단 | 최근 20개 조회; 30일 초과 record daily cleanup; workspace purge 시 cascade |
| CONFIRMED | In-memory rate limiter | session ID 또는 unauthenticated remote IP, read/write counter/window | 요청 제한 | 약 2분 이상 지난 window는 주기적 opportunistic cleanup; persistent DB 저장 없음 |

### 3.6 Server와 proxy log

| 상태 | 사실 |
|---|---|
| CONFIRMED | Backend logs include request ID, selected workspace/project IDs, event type, sync errors, and stack traces for notification/audit persistence failures. |
| CONFIRMED | GitLab error response bodies are released and replaced with controlled domain messages; access token is not included in the explicit application log formats found. |
| CONFIRMED | Repository-owned Nginx config previously used the default access log for all routes. Default request logging can contain IP, request target/query, referrer, and User-Agent. |
| CONFIRMED | `deploy/nginx.conf` now disables gateway access logging for the exact OAuth callback path so callback `code` and `state` are not written there. |
| UNKNOWN | External Nginx Proxy Manager, load balancer, Docker logging driver, host journal, log shipping, monitoring retention, and redaction policy. The public sandbox uses an external Nginx Proxy Manager network. |
| UNKNOWN | Whether production error logs can contain user-authored content through an unforeseen exception message. No deliberate content/token logging was found, but no centralized redaction filter exists. |

## 4. GitLab 데이터 경계

### GitLab → Study-ing

| 상태 | Data | Runtime use | Persistent copy in Study-ing |
|---|---|---|---|
| CONFIRMED | OAuth access/refresh token, expiry, scope | GitLab API authorization/refresh | encrypted credential row |
| CONFIRMED | GitLab user ID, username, name, avatar URL, web URL | account/profile/session | account DB; user object in JDBC session |
| CONFIRMED | project ID/name/path/default branch/web URL/visibility/access level | search, connect, permission/discovery | connected project ID/path/branch; access level in member cache |
| CONFIRMED | project member ID/username/name/avatar/web URL/access level/state | candidate list and member sync | selected/active membership fields in workspace state |
| CONFIRMED | repository tree path/type and managed file content/commit metadata | import analysis, sync, Library storage details | parsed schedule/submission content and commit IDs in state JSON |
| CONFIRMED | commit comments and author metadata | review thread | not persisted as review rows by Study-ing |

### Study-ing → GitLab

| 상태 | Data | Destination/use |
|---|---|---|
| CONFIRMED | OAuth client data, authorization code, refresh token | GitLab OAuth token/refresh/revoke endpoints |
| CONFIRMED | project ID, branch/ref, repository paths | GitLab project/tree/file APIs |
| CONFIRMED | Workspace marker/config | repository file/commit |
| CONFIRMED | schedule YAML with title/description/items/deadlines/change metadata | repository file/commit |
| CONFIRMED | submission Markdown with user identity, answers, code/links/text/reflection/times | repository file/commit |
| CONFIRMED | commit message, last commit ID, display name as `author_name` | GitLab commit metadata/conflict control |
| CONFIRMED | review body | GitLab commit comment |
| CONFIRMED | Team document, announcement, Workspace message | **not sent by current implementation**; stored in Study-ing DB |

Study-ing is an API client and cache/metadata store for repository content. It does not take ownership of the GitLab repository in code. The user or project administrator controls the repository and its Git history under GitLab's rules.

## 5. Cookie와 browser storage 목록

| 상태 | Storage | Purpose | Flags/expiry |
|---|---|---|---|
| INFERRED | Spring session cookie (`SESSION` unless deployment overrides) | authenticated JDBC session | HttpOnly; SameSite=Lax; Secure in `prod`; browser-session lifetime plus server inactivity timeout 8h; domain/path default |
| CONFIRMED | CSRF token in server session; value returned by authenticated CSRF endpoint and sent as `X-CSRF-TOKEN` | request forgery protection | no separate analytics cookie observed |
| CONFIRMED | localStorage theme key | theme/accent | no automatic expiry |
| CONFIRMED | localStorage demo document key | demo-only document persistence | no automatic expiry |
| CONFIRMED | Analytics/marketing cookie or SDK | none found in dependencies or source |
| UNKNOWN | Cookies added by an external reverse proxy/CDN | external infrastructure not inventoried |

## 6. 삭제와 revoke 기준표

### 6.1 Logout 처리

| 상태 | Effect |
|---|---|
| CONFIRMED | Attempts GitLab token revocation, deletes local `oauth_credentials`, invalidates current JDBC session. |
| CONFIRMED | Does not delete `user_accounts`, profile, memberships, content, notifications, audit, or GitLab repository data. |
| CONFIRMED | If GitLab revoke fails, local logout still completes; remote token validity until expiry/revocation is not guaranteed by Study-ing. |

### 6.2 Account 삭제

| 상태 | Data | Actual effect |
|---|---|---|
| CONFIRMED | Active Workspace ownership | deletion is rejected if the user is an active `OWNER` of any active Workspace, even when another owner exists |
| CONFIRMED | `user_accounts`, `oauth_credentials`, account sessions | user hard delete; credential FK cascade; indexed account sessions delete; GitLab revoke attempted best-effort |
| CONFIRMED | Workspace member record in `state_json` | GitLab user ID changed to negative value; username/display changed to deleted-user/탈퇴한 사용자; status becomes `PROJECT_ACCESS_LOST` |
| CONFIRMED | cached submissions in `state_json` | body/reflection/commit metadata는 공동 기록으로 유지하고 GitLab user ID와 username은 deleted-user marker로 익명화 |
| CONFIRMED | GitLab schedule/submission/config/commit/comment | unchanged |
| CONFIRMED | documents/messages/announcements | 공동 콘텐츠는 유지하고 author FK 제거 및 표시 이름을 `탈퇴한 사용자`로 변경 |
| CONFIRMED | audit events | actor FK를 제거하고 event/target/details는 최대 180일 운영 보유 |
| CONFIRMED | announcement reads | cascade delete with account |
| CONFIRMED | in-app notifications | recipient GitLab user ID 기준 record를 계정 탈퇴 transaction에서 삭제 |
| CONFIRMED | soft-deleted owned Workspace | account deletion is allowed because owner check only considers active Workspace; anonymized former owner can no longer restore through active-member/owner checks |

### 6.3 Workspace 삭제

| 상태 | Effect |
|---|---|
| CONFIRMED | Owner-only action changes Workspace status to `SOFT_DELETED`, sets `deleted_at`, and sets expiry to 7 days later. |
| CONFIRMED | During 7 days the DB workspace state and cascade-linked data remain. Restore requires the same active Study-ing owner. |
| CONFIRMED | Scheduled job hard-deletes expired `workspace_metadata` rows once daily at 03:17 server scheduling context. |
| CONFIRMED | DB FK cascade removes sync jobs, notifications, announcements, messages, announcement reads, and documents with the workspace row. |
| CONFIRMED | Audit events are retained with `workspace_id = NULL`, not cascade-deleted. |
| CONFIRMED | GitLab repository files, commit history and review comments are not deleted or changed. |
| INFERRED | “7일 후 영구 삭제” means permanent removal of the Workspace's Study-ing DB state and cascade-linked records, not all traces and not GitLab data. Exact purge may occur after the expiry time at the next daily job, rather than exactly at 7×24 hours. |

### 6.4 Member 제거와 repository 권한 철회

| 상태 | Effect |
|---|---|
| CONFIRMED | Study-ing member deactivation sets status to `PROJECT_ACCESS_LOST`; it does not delete historical submissions/reviews/content. |
| CONFIRMED | GitLab member sync updates access level/status and preserves member identity/history in Workspace state. |
| CONFIRMED | A confirmed GitLab 403/404 or missing membership is treated as `REPOSITORY_ACCESS_REVOKED` and private Workspace API content is blocked. |
| CONFIRMED | GitLab 429, timeout, connection failure and 5xx are provider-unavailable states, not membership revocation. |
| CONFIRMED | Access is checked at login bulk verification, workspace switch/read after TTL, and write actions through the workspace interceptor; default verification TTL is 5 minutes. |
| CONFIRMED | Rejoin can reactivate an existing member entry as `MEMBER`, preserving member ID and filename; historical attribution remains. |

## 7. 보유 기간 목록

| 상태 | Dataset | Current automatic retention |
|---|---|---|
| CONFIRMED | JDBC session | 8-hour inactivity timeout; expired session cleanup cron explicitly runs every minute |
| CONFIRMED | OAuth credential | until logout, account deletion, or replacement/re-authorization; no independent max retention after abandoned onboarding |
| CONFIRMED | Account/profile/consent/preferences | until account deletion; no inactive-account cleanup |
| CONFIRMED | Active Workspace state/membership/schedule/submission cache | no time-based cleanup |
| CONFIRMED | Soft-deleted Workspace | 7 days then next scheduled purge |
| CONFIRMED | Notifications/read state | 90일; 매일 03:27 cutoff 이전 record 삭제 |
| CONFIRMED | Audit events | 180일; 매일 03:27 cutoff 이전 record 삭제 |
| CONFIRMED | Sync jobs/errors | 30일; 매일 03:27 cutoff 이전 record 삭제 |
| CONFIRMED | Soft-deleted team documents/messages, archived announcements | no item-level time-based cleanup while Workspace remains active |
| CONFIRMED | GitLab files/commits/comments | controlled by GitLab/project policy; no Study-ing cleanup |
| CONFIRMED | Local DB backup script | creates full PostgreSQL dump; no deletion or encryption step in script |
| CONFIRMED policy / UNKNOWN deployment | Production backup target | backup을 사용하는 경우 암호화하고 7일 rotation한다는 운영 목표; 실제 provider/config는 UNKNOWN |
| CONFIRMED policy / UNKNOWN deployment | Nginx/Docker/host/monitoring log target | 30일 이내 보유 목표; 실제 provider/config는 UNKNOWN |

## 8. 외부 서비스와 인프라 목록

| Service | Status | Purpose | Data that may be handled | Region/country | Legal classification |
|---|---|---|---|---|---|
| GitLab at configured base URL (default `https://lab.ssafy.com`) | CONFIRMED | OAuth identity, project discovery/permission, repository read/write, commit comments | identity, OAuth credentials, project/member metadata, repository files, commits/reviews | UNKNOWN; this is not proven to be GitLab.com SaaS and self-managed GitLab storage is deployment-specific | LEGAL REVIEW REQUIRED: operator relationship, third-party provision vs necessary external service, and overseas processing |
| GitHub.com | CONFIRMED when linking/repository capability is configured | Connected Account linking, App installation verification and selected Workspace repository operations | GitHub identity/credential, installation and repository metadata/permission, requested files/commits/comments | GitHub.com processing region and the legal classification of the transfer are not determined by code | LEGAL REVIEW REQUIRED |
| PostgreSQL container/volume | CONFIRMED | primary Study-ing DB and JDBC sessions | all DB inventory above | UNKNOWN physical host/region | hosting/processing arrangement UNKNOWN |
| Nginx gateway + external Nginx Proxy Manager | CONFIRMED for sandbox template | TLS/proxy/routing/access logs | IP, request path, UA, session cookie in transit; proxy config should not log headers | UNKNOWN host/region/operator | LEGAL REVIEW REQUIRED after infrastructure owner is identified |
| Prometheus endpoint / OpenTelemetry bridge | CONFIRMED code dependency/config | metrics/tracing foundation | aggregate metrics, trace metadata depending on deployment | no external exporter/provider configured in repository | NOT APPLICABLE to third party until exporter is configured; deployment review required |
| CDN, error tracking, email, object storage, analytics/ads | CONFIRMED not present in application dependencies/config reviewed | none in current repository | none confirmed | N/A | NOT APPLICABLE on repository evidence; verify production account inventory |
| Docker Hub/npm/Maven repositories | INFERRED build-time suppliers | fetch public dependencies/images | build metadata/IP, not Study-ing end-user records by application design | provider-dependent | normally not an end-user data processor; operational review only |

### 국외 처리 표

| Service | Country/Region | Transferred data | Purpose | Legal classification | Status |
|---|---|---|---|---|---|
| `lab.ssafy.com` GitLab instance | UNKNOWN | identity, OAuth token, project/member metadata, schedules/submissions/reviews | authentication and repository operation | whether this is overseas transfer cannot be determined from code/domain alone | REVIEW REQUIRED |
| Study-ing application/DB host | UNKNOWN | all Study-ing DB data | service hosting | host contract and physical region unavailable | REVIEW REQUIRED |
| External Nginx Proxy Manager host | UNKNOWN | request metadata and traffic in transit | reverse proxy/TLS | operator/region unavailable | REVIEW REQUIRED |
| GitLab.com SaaS | not used by default config | N/A | N/A | do not import GitLab.com US-hosting statements into this service without changing provider | NOT APPLICABLE on current evidence |

GitLab's official documentation confirms that Self-Managed repository storage and backups depend on the administrator's deployment and storage configuration. It therefore does not establish the country of `lab.ssafy.com`: <https://docs.gitlab.com/administration/repository_storage_paths/> and <https://docs.gitlab.com/administration/backup_restore/backup_gitlab/>.

## 9. 실제 구현된 보안 조치

| 상태 | Measure |
|---|---|
| CONFIRMED | AES-256-GCM-equivalent configuration for OAuth tokens (32-byte AES key, random nonce, authentication tag). |
| CONFIRMED | HttpOnly session cookie, SameSite=Lax, Secure in production profile, 8-hour inactivity timeout, JDBC-backed session. |
| CONFIRMED | Session CSRF token and `X-CSRF-TOKEN` header validation. |
| CONFIRMED | OAuth state validation, 10-minute state/pending window, relative return URL allow pattern, `changeSessionId()` after OAuth completion. |
| CONFIRMED | Authenticated API boundary, Workspace role checks, active-member check, server-side GitLab repository-access revalidation. |
| CONFIRMED | Repository path normalization/restriction, last-commit conflict checks, JPA optimistic locking. |
| CONFIRMED | Security headers: nosniff, frame deny, no-referrer, restrictive Permissions Policy/API CSP, HSTS for secure requests. |
| CONFIRMED | In-process read/write rate limiting. |
| CONFIRMED | Token-bearing DTO `toString()` redaction and controlled GitLab error messages. |
| CONFIRMED | Gateway callback access-log suppression added for OAuth code/state. |
| UNKNOWN | Production HTTPS/TLS certificate and external proxy config are operational, not proven by code. |
| UNKNOWN | DB/disk encryption, backup encryption, secret-manager product, key access control/rotation, centralized log redaction, vulnerability/incident runbook execution. |

## 10. 현재 지원하는 사용자 권리

| 상태 | Capability |
|---|---|
| CONFIRMED | View/update display name, learning-record filename and timezone. |
| CONFIRMED | View/update theme and accent. |
| CONFIRMED | Reauthorize GitLab; logout revokes/deletes the local connected credential. There is no separate “disconnect while staying signed in” flow. |
| CONFIRMED | Delete Study-ing account subject to active-owner blocking rule. |
| CONFIRMED | Owner soft-delete/restore Workspace within 7 days. |
| CONFIRMED | Author soft-delete own team document; author/manager soft-delete message; manager archive announcement. |
| CONFIRMED | No account-data export/download endpoint or UI. |
| CONFIRMED | No UI/API for erasing a GitLab commit/comment through Study-ing. |
| UNKNOWN | Operational channel and procedure for access, copy, correction, deletion, suspension, objection or complaint requests. |

## 11. 동의와 version 관리 사실

| 상태 | Fact |
|---|---|
| CONFIRMED | Onboarding separately confirms minimum age, Terms, and Privacy. Backend does not infer one consent from another. |
| CONFIRMED | DB stores current Terms version/agreedAt and Privacy version/agreedAt independently, plus minimum-age confirmation time. |
| CONFIRMED | OAuth account and encrypted credential are created before profile/terms checkbox completion. Abandoned onboarding accounts have no automatic cleanup. |
| CONFIRMED | General profile settings do not write consent. Agreed timestamps change only when a newly required document version is explicitly accepted. |
| CONFIRMED | Profile response computes `requiresReconsent` by comparing accepted and required versions. Dedicated re-consent UI/route remains a follow-up. |

## 12. 현재 공개 문구와 구현의 차이

| Severity | Status | Current copy/assumption | Actual implementation |
|---|---|---|---|
| P1 | CONFIRMED/FIXED COPY | Settings account-delete copy said personal and connected-account information is deleted. | Copy now limits the deletion statement to account/OAuth information and warns that shared/operational/GitLab records may remain. Data cleanup is still a policy/code gap. |
| P1 | CONFIRMED/RESOLVED IN DRAFT | `/privacy` did not state retention periods for most DB/log/backup datasets. | Draft now states 90/30/180/7-day policies; DB cleanup is implemented. Infrastructure verification remains a launch blocker. |
| P1 | CONFIRMED/FIXED COPY | `/terms` said Workspace expiry removes service DB data without qualification. | Copy now states that linked service data is cleaned up while some audit and GitLab records may remain. Retention decisions are still open. |
| P1 | CONFIRMED/FIXED | Onboarding used one agreement value and profile edits overwrote it. | Terms, Privacy and minimum-age confirmation are separate; profile edits preserve timestamps. |
| P2 | CONFIRMED/FIXED COPY | `/privacy` exposed “향후 확정될 문의 채널”. | Internal future-TODO wording was removed; the missing operational request channel remains a launch blocker. |
| P2 | CONFIRMED | Public security copy says OAuth tokens are server-encrypted and browser auth uses HttpOnly session cookie. | correct for OAuth/authentication; browser also stores non-auth theme and demo-only document data in localStorage. |
| P1 security | CONFIRMED/FIXED IN REPO | default gateway access log could contain OAuth callback code/state. | exact callback access logging is disabled in `deploy/nginx.conf`; outer proxy still needs operator verification. |

The draft policy documents must not be promoted to `/terms` or `/privacy` until the blockers in `policy-decisions-required.md` are resolved and legal review is complete.

## 13. 미확정 또는 누락된 운영 사실

- **UNKNOWN** service operator legal name/type, address, representative, privacy officer/contact and general support channel.
- **UNKNOWN** production host/DB/proxy provider, contract party, server country/region and subprocessors.
- **UNKNOWN** whether `lab.ssafy.com` is operated under terms that permit this production use and which party controls its privacy/retention policy.
- **UNKNOWN** final lawful basis per processing purpose and classification of GitLab/hosting as processor, third-party recipient, or separate controller.
- **CONFIRMED POLICY** notification 90일, sync log 30일, audit log 180일, Workspace soft delete 7일, application log 목표 30일, encrypted backup rotation 목표 7일. Soft-deleted document/message 자체 retention은 미정이다.
- **CONFIRMED POLICY** 현재 만 14세 미만 이용 미지원; onboarding에서 만 14세 이상을 확인한다.
- **UNKNOWN** data-subject request workflow, identity verification and response contact.
- **CONFIRMED MINIMUM PROCEDURE / UNKNOWN CONTACT** 최소 incident response runbook은 존재하며 실제 담당자·연락처는 미정이다.
- **CONFIRMED POLICY** 종료 시 가능한 범위에서 화면 고지와 DB 정리 일정을 안내하고 GitLab 원본은 자동 삭제하지 않는다. 구체적 고지 시점은 법률/운영 검토 대상이다.
- **CONFIRMED POLICY / LEGAL REVIEW REQUIRED** 별도 관리자 ban system은 없으며 심각한 보안·서비스 방해에 필요한 최소 접근 제한 원칙만 둔다. 구체 사유·통지·이의절차는 법률 검토 대상이다.
- **UNKNOWN** final Terms governing law/jurisdiction and limitation-of-liability language.
