# Study Workspace TODO

## 업데이트 항목 1 — 오늘 페이지의 저장소 미리보기를 팀 피드로 교체

상태: `P0 완료 (2026-08-10) · P1/P2 TODO`

> 현재 저장소 미리보기는 업데이트 항목 3의 `팀 제출 리뷰` 카드로 먼저 교체되었다. 팀 피드를 구현할 때 리뷰 진입점을 없애지 않고 공지·피드 아래의 보조 영역이나 별도 탭으로 유지한다.

### 목표

오늘 페이지의 `저장소 미리보기` 영역을 제거하고, 팀원이 공지와 메시지를 공유할 수 있는 `팀 피드` 영역으로 교체한다. GitLab은 학습 일정과 제출 기록의 원본으로 유지하고, 대화성 데이터는 백엔드 데이터베이스에서 관리한다.

### 제품 방향

- 완전한 메신저보다 `공지 + 오늘 중심의 누적 팀 피드` 형태로 시작한다.
- 데이터는 계속 누적해서 보존하되, 오늘 페이지에서는 오늘 작성된 메시지를 기본으로 보여준다.
- `오늘`과 `전체` 탭을 제공한다.
  - `오늘`: 워크스페이스 시간대 기준 오늘 작성된 메시지
  - `전체`: 날짜 구분선이 포함된 누적 메시지
- 공지사항은 날짜와 무관하게 피드 상단에 고정할 수 있다.
- 공지에는 선택적으로 게시 시작일과 만료일을 설정할 수 있다.
- 과거 메시지는 날짜가 바뀌어도 삭제하지 않는다.

### 저장 원칙

- 공지와 메시지의 원본은 PostgreSQL로 한다.
- GitLab 저장소에는 공지와 메시지를 커밋하지 않는다.
- 자주 변경되는 메시지를 `workspace_metadata.state_json`에 포함하지 않는다.
- 메시지와 공지는 별도 정규화 테이블에 저장한다.
- 첨부파일 기능을 추가할 경우 파일은 객체 스토리지에 저장하고 DB에는 URL과 메타데이터만 저장한다.
- 기존 `in_app_notifications`는 새 공지와 멘션 알림 전달에 재사용하되, 피드 원본 저장소로 사용하지 않는다.

### 데이터 모델

#### `workspace_announcements`

- `id`
- `workspace_id`
- `author_user_id` — 계정 삭제 시 `SET NULL` 또는 익명화
- `title`
- `body`
- `is_pinned`
- `published_at`
- `expires_at` — nullable
- `created_at`
- `updated_at`
- `archived_at` — nullable

#### `workspace_messages`

- `id`
- `workspace_id`
- `author_user_id` — 계정 삭제 시 `SET NULL` 또는 익명화
- `context_date` — 워크스페이스 시간대 기준 작성 날짜
- `body`
- `parent_message_id` — 답글 기능 추가 시 사용, nullable
- `created_at`
- `updated_at`
- `deleted_at` — 소프트 삭제, nullable

#### `announcement_reads`

- `announcement_id`
- `user_id`
- `read_at`
- `(announcement_id, user_id)` 복합 유니크 키

### 권한

- 활성 워크스페이스 멤버는 피드를 읽을 수 있다.
- 활성 워크스페이스 멤버는 메시지를 작성할 수 있다.
- 작성자는 자신의 메시지를 수정하거나 삭제할 수 있다.
- `OWNER`와 `MANAGER`는 공지를 작성·수정·보관하고 메시지를 관리할 수 있다.
- 권한이 없거나 프로젝트 접근 권한을 잃은 사용자는 읽기·쓰기를 모두 차단한다.

### 오늘 페이지 UI

기존 오른쪽 `저장소 미리보기` 영역을 다음 순서로 교체한다.

1. 상단 고정 공지 1~2개
2. `오늘 / 전체` 탭
3. 메시지 입력창
4. 작성자, 작성 시간, 본문이 표시되는 피드
5. 이전 메시지 페이지네이션 또는 더 보기

추가 UI 규칙:

- 새 메시지 작성 후 피드에 즉시 반영한다.
- `오늘` 탭이 기본값이다.
- `전체` 탭에서는 날짜별 구분선을 표시한다.
- 공지와 일반 메시지는 시각적으로 명확히 구분한다.
- 빈 상태에는 메시지 작성 목적을 설명하는 안내를 표시한다.
- 모바일에서는 오늘의 학습 카드 아래에 전체 너비로 배치한다.

### 백엔드 API

- `GET /api/v1/workspaces/{workspaceId}/announcements`
- `POST /api/v1/workspaces/{workspaceId}/announcements`
- `PATCH /api/v1/workspaces/{workspaceId}/announcements/{announcementId}`
- `DELETE /api/v1/workspaces/{workspaceId}/announcements/{announcementId}`
- `PATCH /api/v1/workspaces/{workspaceId}/announcements/{announcementId}/read`
- `GET /api/v1/workspaces/{workspaceId}/messages?date=YYYY-MM-DD&cursor=...`
- `POST /api/v1/workspaces/{workspaceId}/messages`
- `PATCH /api/v1/workspaces/{workspaceId}/messages/{messageId}`
- `DELETE /api/v1/workspaces/{workspaceId}/messages/{messageId}`

API 목록 응답은 커서 기반 페이지네이션을 사용한다. 메시지 본문 길이 제한, 요청 빈도 제한, HTML 이스케이프와 권한 검증을 적용한다.

### 알림 연동

- 공지가 게시되면 대상 워크스페이스 멤버에게 인앱 알림을 생성한다.
- 멘션 기능을 추가할 경우 멘션된 사용자에게만 인앱 알림을 생성한다.
- 알림의 `action_path`는 오늘 페이지의 해당 공지나 메시지로 이동하도록 구성한다.
- 단순한 일반 메시지는 모든 사용자에게 알림을 발송하지 않는다.

### 단계별 구현

#### P0

- [x] 저장소 미리보기 제거
- [x] 공지/메시지 DB 마이그레이션과 엔티티 구현
- [x] 공지 및 메시지 CRUD API
- [x] 오늘/전체 피드 UI
- [x] 커서 기반 페이지네이션
- [x] 새 공지 인앱 알림
- [x] 권한, 입력 검증, 소프트 삭제 및 감사 이벤트
- [x] 10초 폴링과 수동 새로고침

구현 메모:

- 공지와 메시지는 GitLab 커밋이나 Workspace JSON 상태에 포함하지 않고 PostgreSQL 정규화 테이블에 저장한다.
- 공지는 `OWNER`와 `MANAGER`만 게시·수정·보관할 수 있다.
- 일반 메시지는 모든 활성 멤버가 작성할 수 있고 작성자 또는 관리자가 수정·소프트 삭제할 수 있다.
- 공지 등록 시 작성자를 제외한 활성 멤버에게 `WORKSPACE_ANNOUNCEMENT` 인앱 알림을 생성한다.
- 일반 메시지는 알림 피로를 막기 위해 전체 알림을 생성하지 않는다.

#### P1

- SSE 기반 새 메시지 실시간 반영
- 답글
- 사용자 멘션과 멘션 알림
- 이모지 반응
- 공지 읽음 상태 UI

#### P2

- 첨부파일과 객체 스토리지 연동
- 메시지 검색
- 보존 기간 설정
- 관리자 신고·모더레이션 기능

### 완료 조건

- 저장소 미리보기 없이 오늘의 학습 핵심 기능이 유지된다.
- 공지와 메시지가 GitLab 커밋을 생성하지 않는다.
- 오늘 메시지와 누적 메시지를 각각 조회할 수 있다.
- 날짜가 변경되어도 기존 메시지가 보존된다.
- 동시에 메시지를 작성해도 워크스페이스 전체 상태 저장 충돌이 발생하지 않는다.
- 활성 멤버 및 역할별 권한이 백엔드에서 검증된다.
- 공지 알림이 기존 알림함에 정상적으로 표시된다.
- 데스크톱과 모바일에서 피드를 사용할 수 있다.

## 업데이트 항목 2 — 기존 GitLab 저장소 가져오기와 안전한 초기화

상태: `P0 완료 · 저장 구조 V2와 안전 마이그레이션 완료 · P1/P2 TODO`

### 배경

현재 Workspace 생성 후 저장소를 동기화하지만, 서비스가 인식하는 `YYMMDD/session.yml`과 `YYMMDD/{member-file}.md` 형식만 가져온다. 기존에 GitLab에서 직접 관리하던 Markdown, 코드, 임의 폴더 구조는 삭제하거나 덮어쓰지 않지만 일정과 제출 데이터로도 인식되지 않는다.

빈 프로젝트뿐 아니라 이미 운영 중인 GitLab 프로젝트에도 서비스를 안전하게 도입할 수 있도록 `기존 저장소 가져오기` 온보딩 흐름을 추가한다.

### 핵심 원칙

- 프로젝트를 선택한 직후에는 읽기 전용 분석만 수행한다.
- 사용자가 최종 확인하기 전에는 GitLab에 파일이나 커밋을 생성하지 않는다.
- 기존 파일을 자동으로 수정하거나 덮어쓰지 않는다.
- 가져오기 결과, 무시되는 파일, 충돌 가능 파일과 생성 예정 파일을 커밋 전에 보여준다.
- 임의 형식의 기존 자료를 불확실하게 자동 변환하지 않는다.
- 기존 저장소의 HEAD가 분석 시점 이후 변경되면 초기화를 중단하고 다시 분석한다.
- 초기화가 실패한 Workspace는 일반 사용 화면에 진입시키지 않고 재시도하거나 안전하게 정리할 수 있게 한다.

### 저장소 분석 결과 분류

프로젝트 선택 후 저장소를 다음 상태 중 하나로 분류한다.

1. `EMPTY`
   - 커밋 또는 파일이 없는 저장소
   - 새 Workspace 형식으로 바로 시작할 수 있다.
2. `COMPATIBLE`
   - 서비스 형식의 `session.yml`과 제출 Markdown이 존재한다.
   - 기존 데이터 개수와 검증 결과를 보여주고 읽기 전용으로 가져온다.
3. `LEGACY`
   - 일반 파일은 존재하지만 서비스 형식 데이터는 없다.
   - 기존 파일을 유지하면서 전용 경로에서 앞으로의 일정만 관리하거나, 지원 가능한 파일을 선택해 변환한다.
4. `PARTIALLY_COMPATIBLE`
   - 정상 파일과 잘못된 서비스 형식 파일이 함께 존재한다.
   - 정상 데이터, 변환 가능 데이터, 오류 데이터를 나눠 미리 보여준다.
5. `CONFLICTED`
   - 서비스가 생성할 경로와 기존 파일이 충돌한다.
   - 사용자가 경로를 변경하거나 충돌을 해결하기 전에는 초기화하지 않는다.

### 온보딩 UI

GitLab 프로젝트 선택 뒤 `저장소 분석` 단계를 추가한다.

1. 프로젝트와 기본 브랜치 확인
2. 읽기 전용 저장소 분석
3. 분석 결과 요약
   - 기존 파일 수
   - 인식 가능한 일정과 제출 수
   - 변환 가능 파일 수
   - 무시되는 파일 수
   - 오류와 경로 충돌
4. 시작 방식 선택
   - `기존 Workspace 데이터 가져오기`
   - `기존 자료는 유지하고 앞으로의 일정만 관리하기`
   - `연결할 프로젝트 다시 선택`
5. 멤버 파일과 GitLab 사용자 매핑 확인
6. 생성·변환될 파일과 커밋 메시지 미리보기
7. 최종 확인 후 Workspace 활성화

기존 자료의 날짜, 마감, 일정 유형, 제출 항목을 확실하게 추론할 수 없는 경우 사용자에게 매핑 입력을 요구한다. 오류가 있는 파일은 경로와 해결 방법을 쉬운 문장으로 표시한다.

### 저장소 격리 구조

기존 프로젝트 파일과 서비스 관리 파일의 충돌을 피하기 위해 Workspace별 `repositoryBasePath`를 지원한다.

```text
기존 프로젝트 파일/
src/
README.md
docs/

.study-workspace/
  config.yml
  sessions/
    2026/
      2026-08-10/
        session.yml
        submissions/
          사용자-지정-이름.md
```

- 신규 또는 기존 일반 저장소의 기본 데이터 경로는 `.study-workspace/sessions/{YYYY}/{YYYY-MM-DD}`로 한다.
- 현재 루트 경로 형식으로 연결된 기존 Workspace는 `repositoryBasePath=""`로 유지해 호환성을 보장한다.
- 세션, 제출, 저장소 조회, 경로 정책과 동기화 로직이 모두 `repositoryBasePath`를 사용하도록 변경한다.
- `.study-workspace/config.yml`에는 스키마 버전과 데이터 루트만 저장하고 OAuth 토큰이나 사용자 비밀정보는 저장하지 않는다.
- 기존 V1 파일은 Owner가 설정에서 명시적으로 실행할 때만 GitLab 단일 커밋으로 V2에 이동한다.
- 실행 전 tree fingerprint, 대상 경로 충돌, 미지원 파일을 다시 검사하고 저장소가 바뀌었으면 중단한다.

### 데이터 모델

Workspace 연결 정보에 다음 필드를 추가한다.

- `repository_base_path` — 기존 Workspace는 빈 문자열
- `repository_schema_version`
- `onboarding_status` — `ANALYZING`, `READY`, `INITIALIZING`, `ACTIVE`, `FAILED`
- `initial_head_commit_id` — 분석과 초기화 사이 변경 감지
- `import_mode` — `EMPTY`, `COMPATIBLE`, `LEGACY`, `PARTIAL`
- `initialized_at` — nullable

분석 결과는 짧은 만료 시간을 둔 별도 import draft로 저장한다.

#### `workspace_import_drafts`

- `id`
- `user_id`
- `gitlab_project_id`
- `default_branch`
- `head_commit_id`
- `classification`
- `repository_base_path`
- `analysis_json`
- `expires_at`
- `created_at`

### 백엔드 API

- `POST /api/v1/gitlab/projects/{projectId}/import-analysis`
  - 저장소를 변경하지 않고 구조, 호환 파일, 오류와 충돌을 분석한다.
- `GET /api/v1/workspace-imports/{importId}`
  - 분석 결과와 만료 여부를 조회한다.
- `POST /api/v1/workspace-imports/{importId}/preview`
  - 선택한 모드와 멤버 매핑을 기준으로 생성 예정 파일을 반환한다.
- `POST /api/v1/workspace-imports/{importId}/initialize`
  - HEAD를 재검증하고 Workspace 생성 및 초기 커밋을 수행한다.
- `POST /api/v1/workspace-imports/{importId}/retry`
  - 실패한 초기화를 동일한 입력으로 안전하게 재시도한다.

분석 API는 OAuth 사용자의 프로젝트 접근 권한을 검증하고 파일 개수, 전체 읽기 크기와 처리 시간을 제한한다. 심볼릭 링크, 비정상 경로, 과도하게 큰 YAML·Markdown과 YAML alias 공격을 차단한다.

### 가져오기 동작

#### 기존 서비스 형식

- GitLab 파일을 원본으로 유지하고 DB에 파싱한 읽기 모델을 저장한다.
- 가져오기만으로 GitLab 커밋을 생성하지 않는다.
- 먼저 프로젝트 멤버를 동기화한 뒤 제출 파일과 사용자를 매핑한다.
- 매핑되지 않은 제출 파일은 버리지 않고 사용자에게 별도 표시한다.

#### 일반 수동 관리 형식

- 기존 파일은 그대로 보존한다.
- 기본적으로 `.study-workspace` 아래에서 신규 일정부터 관리한다.
- 자동 감지가 확실한 날짜 폴더와 Markdown만 변환 후보로 제시한다.
- 변환은 반드시 미리보기와 사용자 확인 후 별도 커밋으로 수행한다.
- 대량 변환은 기본 브랜치 직접 커밋 대신 별도 브랜치와 Merge Request 생성을 우선한다.

### 단계별 구현

#### P0

- [x] 읽기 전용 저장소 분석 API
- [x] `EMPTY`, `COMPATIBLE`, `LEGACY`, `PARTIALLY_COMPATIBLE`, `CONFLICTED` 분류
- [x] 온보딩 분석 결과 및 시작 방식 선택 UI
- [x] `repositoryBasePath` DB 필드와 전체 GitLab 경로 처리 적용
- [x] 기존 서비스 형식 데이터의 무커밋 가져오기
- [x] 프로젝트 멤버 선동기화 후 제출 파일 매핑
- [x] repository tree fingerprint 기반 동시 변경 검사
- [x] `.study-workspace/config.yml` 명시적 초기화, 실패 롤백과 idempotent 재시도 처리

#### P1

- 기존 날짜 폴더와 Markdown 변환 후보 자동 감지
- 날짜, 멤버, 일정, 제출 항목 매핑 UI
- 생성 파일과 변경 diff 미리보기
- `.study-workspace` 초기화 커밋
- 별도 브랜치와 Merge Request 방식 초기화
- 매핑되지 않은 파일 관리 화면

#### P2

- 저장소별 사용자 정의 import adapter
- 대규모 저장소 비동기 분석과 진행 상태 표시
- 가져오기 보고서 다운로드
- 관리자가 승인하는 조직 단위 일괄 도입

### 완료 조건

- 빈 저장소와 기존 저장소가 온보딩에서 명확히 구분된다.
- 분석 단계에서는 GitLab 저장소가 변경되지 않는다.
- 기존 프로젝트 파일이 삭제되거나 덮어써지지 않는다.
- 호환되는 기존 일정과 제출을 커밋 없이 가져올 수 있다.
- 일반 저장소는 기존 파일을 유지한 채 전용 경로에서 서비스를 시작할 수 있다.
- 사용자는 커밋 전에 생성·변환될 파일과 충돌을 확인할 수 있다.
- 분석 이후 저장소가 변경되면 오래된 결과로 초기화할 수 없다.
- 기존 루트 경로 Workspace의 동작이 깨지지 않는다.
- 가져오기 실패 후 중복 Workspace나 중복 커밋 없이 재시도할 수 있다.

## 업데이트 항목 3 — GitLab 커밋 기반 팀 제출 리뷰

상태: `P0 완료`

### 구현 원칙

- 리뷰 원본은 별도 로컬 JSON이 아니라 멤버 제출 파일의 최신 GitLab commit comment로 관리한다.
- 활성 Workspace 멤버만 댓글을 읽거나 작성할 수 있다.
- 댓글 작성은 로그인 사용자의 OAuth 토큰을 사용하므로 GitLab에도 실제 작성자 계정으로 남는다.
- 제출 파일이 갱신되면 새 commit SHA가 현재 리뷰 대상이 된다. 이전 댓글은 이전 커밋 이력에 보존된다.
- 댓글을 등록하면 제출자에게 인앱 알림을 만들고 감사 로그에 `SUBMISSION_REVIEW_CREATED`를 기록한다.

### 완료된 UI

- 오늘 페이지의 저장소 미리보기를 `팀 제출 리뷰` 카드로 교체
- 멤버 제출 상세에 댓글 목록, 작성자, 작성 시각, 입력창 추가
- 일정 상세에서 모든 멤버의 제출 리뷰 진입 가능
- 기록 페이지의 날짜별 멤버 행에서 과거 제출 리뷰 진입 가능
- 코드 제출은 리뷰 모달에서도 줄바꿈과 들여쓰기를 유지해 표시

### API

- `GET /api/v1/workspaces/{workspaceId}/sessions/{date}/members/{memberId}/reviews`
- `POST /api/v1/workspaces/{workspaceId}/sessions/{date}/members/{memberId}/reviews`

### 다음 단계

- P1: 댓글 답글과 해결 상태가 필요하면 GitLab Discussions API 기반 thread로 확장
- P1: 리뷰 요청, 미확인 리뷰 수, 리뷰 완료 상태 집계
- P2: 코드 줄 단위 diff comment와 Merge Request 기반 승인 흐름

## 업데이트 항목 4 — 학습 라이브러리 팀 문서

상태: `MVP 완료 (2026-08-10)`

### 구현 원칙

- 세션 일정과 제출 파일의 GitLab 원본 구조와 분리한다.
- 잦은 편집에서 불필요한 GitLab 커밋이 쌓이지 않도록 문서 원본은 PostgreSQL에 저장한다.
- 활성 Workspace 멤버는 모든 팀 문서를 읽을 수 있다.
- 문서를 만든 사람만 해당 문서를 수정하거나 삭제할 수 있다.
- Owner와 Manager도 다른 작성자의 문서 내용을 대신 수정하지 않는다.
- 수정 요청은 `expectedVersion`으로 낙관적 잠금을 적용해 오래된 화면의 덮어쓰기를 차단한다.
- 삭제는 즉시 물리 삭제하지 않고 `deleted_at`을 기록하는 소프트 삭제로 처리한다.

### 완료된 UI

- 학습 라이브러리의 `세션 아카이브 / 팀 문서` 탭
- 제목·본문·작성자 검색
- 카드형 팀 문서 목록과 Markdown 문서 상세
- Markdown 소제목, 굵게, 목록, 할 일, 인용, 코드 블록 도구
- 편집/미리보기 전환
- 작성자에게만 편집·삭제 버튼 표시
- 버전 충돌 오류와 최신 목록 다시 불러오기
- 데스크톱·모바일 반응형 문서 편집 화면

### API와 저장 구조

- `workspace_documents` 테이블과 수정일 인덱스
- `GET /api/v1/workspaces/{workspaceId}/documents`
- `POST /api/v1/workspaces/{workspaceId}/documents`
- `GET /api/v1/workspaces/{workspaceId}/documents/{documentId}`
- `PATCH /api/v1/workspaces/{workspaceId}/documents/{documentId}`
- `DELETE /api/v1/workspaces/{workspaceId}/documents/{documentId}`
- 문서 생성 시 다른 활성 멤버에게 인앱 알림 생성
- 생성·수정·삭제 감사 이벤트 기록

### 다음 단계

- P1: 블록 단위 순서 변경과 드래그 앤 드롭
- P1: 문서 댓글, 즐겨찾기, 태그와 문서 간 링크
- P1: 변경 이력 조회와 이전 버전 복원
- P2: 공동 실시간 편집과 presence
- P2: 첨부파일과 이미지 업로드

## 업데이트 항목 5 — 릴리스 안정화와 실제 OAuth 승인

상태: `자동 검증 완료 · 외부 스테이징 승인 TODO`

### 완료

- [x] 백엔드 전체 테스트와 프론트 lint/build/render 테스트
- [x] OpenAPI lint와 비밀정보 기본 검사
- [x] 오늘 제출·팀 피드·활동함 브라우저 E2E
- [x] 팀 문서 생성·작성자 권한 브라우저 E2E
- [x] 일정 검색·설정 데모 격리 브라우저 E2E
- [x] GitLab CI에 Chromium E2E job과 실패 trace/artifact 추가
- [x] 스테이징 URL·readiness·401·OAuth redirect 사전 점검 스크립트

### 외부 환경에서 남은 승인

- [ ] public HTTPS 도메인과 GitLab Redirect URI 등록
- [ ] managed PostgreSQL과 운영 Secret 주입
- [ ] 실제 GitLab 사용자 A/B 가입·제출·리뷰·문서 권한 E2E
- [ ] OAuth 철회·재연결과 백엔드 재시작 세션 유지 검증
- [ ] 외부 commit 충돌과 GitLab 429/5xx 복구 검증
- [ ] PostgreSQL backup/restore 리허설

실행 절차는 `docs/staging-e2e-checklist.md`를 기준으로 한다.
