# Study Workspace TODO

## 업데이트 항목 1 — 오늘 페이지의 저장소 미리보기를 팀 피드로 교체

상태: `TODO`

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

- 저장소 미리보기 제거
- 공지/메시지 DB 마이그레이션과 엔티티 구현
- 공지 및 메시지 CRUD API
- 오늘/전체 피드 UI
- 커서 기반 페이지네이션
- 새 공지 인앱 알림
- 권한, 입력 검증, 소프트 삭제 및 감사 이벤트
- 5~10초 폴링 또는 수동 새로고침

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
