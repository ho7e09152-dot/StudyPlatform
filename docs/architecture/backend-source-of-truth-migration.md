# Backend source of truth 전환 계획

Updated: 2026-09-13

## 목표 경계

전환이 끝난 Workspace에서는 PostgreSQL이 Study-ing 데이터의 유일한 정본입니다. GitLab/GitHub Repository에는 사용자가 제출한 **원본 파일의 bytes**와 Provider가 본래 생성하는 commit/blob history만 남깁니다.

| 데이터 | 전환 후 정본 |
|---|---|
| Workspace 이름·상태·설정·멤버·역할 | PostgreSQL |
| 일정·학습 항목·마감·변경 사유 | PostgreSQL |
| 제출 상태·제출 시각·작성자·언어·점수·진행률 | PostgreSQL |
| 화면에서 직접 입력한 텍스트·링크·회고 | PostgreSQL |
| 리뷰·알림·감사 이벤트 | PostgreSQL |
| 제출 파일의 원본 bytes | 연결된 GitLab/GitHub Repository |
| 파일명·MIME·크기·SHA-256·Repository path·commit SHA·업로드 상태 | PostgreSQL |

`session.yml`, 멤버별 submission Markdown, review commit comment와 Repository config는 신규 쓰기 대상에서 제외합니다. 기존 파일은 검증과 복구를 위해 보존하며 전환 과정에서 자동 삭제하거나 덮어쓰지 않습니다.

Repository 파일 자체에는 path, commit author/message, commit time처럼 Git이 원래 보유하는 정보가 존재합니다. Study-ing 일정, 마감, 항목 정의, 제출 상태, 점수와 리뷰를 별도 manifest 또는 commit message에 넣지 않습니다.

## Workspace별 전환 상태

`workspace_metadata.storage_mode`가 런타임 선택의 기준입니다.

| 상태 | 읽기/쓰기 정본 | 의미 |
|---|---|---|
| `REPOSITORY_PRIMARY` | 기존 Repository + `state_json` 호환 경로 | 아직 backfill 전인 기존 Workspace |
| `MIGRATING` | 읽기는 기존 경로, 변경은 일시 제한 | 최종 delta import와 검증 중 |
| `DATABASE_PRIMARY` | 정규화된 PostgreSQL 테이블 | Repository에는 제출 파일 bytes만 저장 |

모드는 Workspace 단위로 전환합니다. 전체 서비스에 한 번에 적용하지 않습니다. `DATABASE_PRIMARY` 전환 후 Repository 장애나 개인 Provider 재인증은 일정, 항목, 텍스트/링크 제출, 기록 조회를 막지 않아야 합니다. 파일 업로드·다운로드만 영향을 받을 수 있습니다.

## 단계별 작업

### 1. Additive DB foundation

- `V14__backend_content_source_foundation.sql`로 전환 상태와 정규화 테이블을 추가합니다.
- 기존 row는 모두 `REPOSITORY_PRIMARY`로 시작합니다.
- 기존 `state_json`, Repository 파일과 API 동작은 유지합니다.
- 이 단계는 schema 배포와 rollback 가능성을 검증한 뒤 별도 release로 먼저 배포합니다.

### 2. Legacy importer와 검증기

- 기존 `session.yml`, 멤버 submission Markdown과 review comment를 읽어 정규화 테이블에 idempotent upsert합니다.
- 사용자와 연결 가능한 작성자는 같은 migration transaction에서 콘텐츠보다 먼저 `workspace_memberships`에 backfill하고, 콘텐츠의 `member_id`는 username이나 Provider ID가 아닌 Workspace-local opaque ID를 사용합니다.
- Review 작성자 식별정보는 현재 Workspace의 Study-ing 계정과 연결된 경우에만 저장합니다. 연결되지 않은 Provider 작성자는 본문만 보존하고 작성자 프로필은 익명화해, 계정 삭제 후 재이관으로 식별정보가 복원되지 않게 합니다.
- 최초 snapshot commit을 기록한 뒤 짧은 `MIGRATING` 구간에서 delta를 다시 반영합니다.
- 세션/항목/제출/리뷰 건수, 필수 필드, 작성자 mapping과 content hash를 비교합니다.
- 검증 결과는 `workspace_content_migration_reports`에 기록하고 review import가 남아 있는 동안 `reviews_pending`을 유지합니다.
- Owner용 `POST /api/v1/workspaces/{workspaceId}/content-migration/prepare`는 Repository sync, DB backfill과 현재 제출 commit review import를 반복해 두 번 연속 같은 fingerprint가 확인되어야 성공합니다. 이 API는 정본을 전환하지 않습니다.
- 검증이 모두 성공한 Workspace만 한 DB transaction에서 `DATABASE_PRIMARY`로 전환합니다.
- 실패하면 `REPOSITORY_PRIMARY`를 유지하고 Repository 원본과 기존 서비스 동작을 보존합니다.

### 3. 일정·항목·앱 데이터 DB 전환

- 일정 create/update/cancel, 설정, 상태와 조회 API를 DB repository/service로 교체합니다.
- 해당 요청에서 Provider credential 및 Repository permission 의존성을 제거합니다.
- `sync`는 `REPOSITORY_PRIMARY` Workspace의 legacy import 용도로만 허용합니다.
- optimistic locking과 audit event는 DB transaction 경계 안에서 처리합니다.

### 4. 제출 record와 파일 artifact 분리

- 텍스트·링크·회고·리뷰·제출 상태는 DB transaction으로 저장합니다.
- 파일 제출만 artifact adapter를 통해 Repository에 기록합니다.
- DB artifact row는 `PENDING`, `AVAILABLE`, `FAILED` 상태와 SHA-256, 크기, MIME, path, commit SHA를 가집니다.
- 업로드는 bytes를 DB나 log에 남기지 않고 크기·확장자·MIME·path를 검증합니다.
- Provider 성공 후 DB 갱신 실패나 반대 상황은 idempotency key와 reconciliation job으로 복구합니다.

### 5. API·Frontend와 운영 전환

- artifact upload/download API와 progress/error UI를 추가합니다.
- Provider outage에서는 파일 작업만 실패하고 나머지 화면은 DB 데이터로 정상 동작하게 회귀 테스트합니다.
- OpenAPI, 개인정보 inventory, 보유/삭제 정책, staging runbook과 incident runbook을 실제 구현에 맞게 갱신합니다.

### 6. Legacy 경로 종료

- 모든 활성 Workspace의 전환과 관찰 기간이 끝난 뒤 Repository schedule/submission sync 쓰기를 제거합니다.
- `state_json`은 최소 한 release 동안 read-only 복구 자료로 둔 뒤 별도 migration으로 제거합니다.
- 기존 Repository metadata 파일 정리는 자동 실행하지 않습니다. 삭제가 필요하면 Owner의 명시적 요청과 별도 backup/복구 절차를 요구합니다.

## 안전 조건

- DB migration은 additive이며 V13 이하 migration을 수정하지 않습니다.
- `DATABASE_PRIMARY` 전환 전에 기존 파일을 삭제하지 않습니다.
- 전환 후 새 DB 데이터를 legacy Repository 형식으로 자동 역변환하지 않으므로, 단순 feature flag rollback으로 `REPOSITORY_PRIMARY`로 되돌리지 않습니다. 장애 시 쓰기를 중단하고 DB backup/point-in-time recovery 절차를 사용합니다.
- Workspace role은 모든 앱 데이터 API에서 검사합니다. Repository permission은 artifact 파일 작업에서만 추가 검사합니다.
- private submission body, artifact bytes, OAuth token과 session 정보는 application/proxy log에 남기지 않습니다.
- account/workspace 삭제, 작성자 익명화와 shared content 보존 규칙은 정규화 테이블에도 동일하게 적용한 뒤 전환합니다.
- 멤버 비활성화는 membership row를 삭제하지 않고 상태를 변경해 과거 콘텐츠 FK를 보존합니다. 실제 row 삭제가 필요한 경우에는 작성자 익명화를 먼저 수행합니다.

## 완료 기준

- 일정·항목 CRUD가 Provider 연결을 끊은 상태에서도 성공합니다.
- 텍스트·링크 제출, 회고, 리뷰와 Records 조회가 Provider 장애 중에도 성공합니다.
- 파일 제출의 bytes만 Repository에서 확인되고, DB에는 bytes가 아닌 검증 가능한 pointer만 존재합니다.
- 신규 Repository commit/tree에 `session.yml`, 멤버 Markdown, 일정/점수/review metadata가 생성되지 않습니다.
- 기존 Workspace import 결과의 건수와 content hash가 일치하며 재실행해도 중복 row가 생기지 않습니다.
- Provider 성공/DB 실패 및 DB 성공/Provider 실패 시나리오가 자동 복구됩니다.
- 전체 Backend/Frontend test, migration test, staging smoke, 보안·개인정보 검토가 통과합니다.

## 현재 진행 상태

- [x] 목표 저장 경계와 단계 확정
- [x] V14 additive schema foundation 작성
- [x] 기존 Workspace 기본 모드를 `REPOSITORY_PRIMARY`로 유지
- [x] 정규화 콘텐츠의 account deletion attribution 익명화 경로와 회귀 테스트 추가
- [x] H2 PostgreSQL mode 및 임시 PostgreSQL 16에서 V14·FK·cascade·익명화 검증
- [x] 일정·항목·텍스트/링크 제출·회고 snapshot importer 및 count/hash 검증 report
- [x] 현재 제출 commit의 Repository review comment importer
- [x] 두 번 연속 fingerprint를 확인하는 Owner용 snapshot 준비 API
- [ ] 과거 제출 commit review history import 범위 확정
- [ ] 일정·항목 DB read/write 전환
- [ ] 제출 record와 artifact API 분리
- [ ] Workspace별 production migration
- [ ] Legacy write/sync 제거
