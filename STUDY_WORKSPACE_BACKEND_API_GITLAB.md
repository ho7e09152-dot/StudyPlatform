# Study-ing 백엔드·API·GitLab 연동 설계서

> 작성 기준: 2026-07-23  
> 구현 기준: Spring Boot + PostgreSQL + GitLab Self-Managed OAuth
> 문서 목적: 프론트엔드 이후 백엔드 구현에 바로 사용할 수 있는 기준 정의

---

## 1. 서비스 개요와 개발 배경

Study-ing은 팀별 GitLab 저장소를 연결해 날짜별 학습 일정, 학습 항목, 멤버별 제출 파일과 진행률을 관리하는 웹서비스다.

기존 방식은 날짜 폴더를 만들고 각 멤버가 자신의 Markdown 또는 코드 파일을 직접 커밋하는 구조다. 이 방식은 단순하지만 다음 불편이 있다.

- 매번 GitLab에서 날짜 폴더와 제출 파일을 직접 찾아야 한다.
- 하루 여러 항목 중 일부만 완료한 상태를 파악하기 어렵다.
- 문제 또는 과제가 변경되었을 때 기존 제출과 기준이 어긋날 수 있다.
- Git 사용이 익숙하지 않으면 커밋과 푸시가 부담스럽다.
- 알고리즘 외 영어, CS, 자유주제 학습을 같은 방식으로 관리하기 어렵다.
- 다른 팀은 각자의 저장소만 보아야 한다.

이 서비스는 GitLab을 대체하지 않는다. GitLab 저장소를 원본으로 유지하면서, 저장소의 파일을 읽기 쉬운 화면으로 보여주고 웹에서 입력한 내용을 사용자의 GitLab 계정으로 커밋하는 역할을 한다.

### 핵심 목표

1. GitLab 계정으로 로그인한다.
2. 팀별로 GitLab 프로젝트 하나를 연결한다.
3. 날짜별 학습 기준은 각 날짜 폴더의 `session.yml`에 저장한다.
4. 각 멤버의 제출은 `{날짜}/{memberId}.md`에 저장한다.
5. 하루 학습 항목 수는 고정하지 않는다.
6. 알고리즘, 영어, CS, 자유주제를 동일한 구조로 처리한다.
7. 사용자는 학습 항목을 하나씩 개별 제출할 수 있다.
8. 팀장 역할을 두지 않고 모든 활성 멤버가 동등하게 스터디를 관리한다.

---

## 2. 핵심 설계 원칙

### 2.1 GitLab 저장소가 원본이다

GitLab에 저장할 데이터:

- `README.md`
- `study.yml`
- 날짜별 `session.yml`
- 멤버별 제출 Markdown
- 코드 또는 텍스트 제출
- 커밋 이력

애플리케이션 DB에 저장할 데이터:

- 로그인 사용자
- 암호화된 OAuth 토큰
- Workspace와 GitLab 프로젝트 연결
- 웹서비스 멤버십
- 소프트 삭제 상태
- 감사 로그
- 선택적인 캐시 메타데이터

학습 일정과 제출물을 DB에 이중 저장하지 않는다. 대시보드 성능을 위해 파싱 결과를 잠시 캐시할 수 있지만, 언제든 GitLab에서 다시 만들 수 있는 데이터로 취급한다.

### 2.2 Workspace마다 프로젝트 하나만 연결한다

```text
Workspace A → group-a/algorithm-study
Workspace B → group-b/english-study
```

프론트는 GitLab 프로젝트 ID를 임의로 전달하지 않는다. 항상 앱의 `workspace_id`를 전달하고, 백엔드가 DB에서 연결된 `gitlab_project_id`를 조회한다.

### 2.3 팀장 없는 동등 권한

모든 활성 멤버의 앱 권한은 동일하다.

- Workspace 생성
- 프로젝트 연결
- 멤버 후보 조회 및 선택
- 일정 생성·수정·취소
- 항목 추가·교체·순서 변경
- 설정 변경
- 저장소 동기화
- 다른 멤버 제출 조회
- 본인 제출 생성·수정
- Workspace 소프트 삭제와 복구

단, 실제 GitLab 쓰기는 로그인 사용자의 GitLab 권한과 브랜치 보호 규칙을 통과해야 한다. 앱에서 동등한 권한이더라도 GitLab에서 Reporter라면 읽기만 가능하고, Developer 이상이어도 보호 브랜치 설정에 따라 직접 커밋이 거부될 수 있다.

### 2.4 위험한 작업은 권한 차등 대신 보호 장치로 제어한다

- Workspace 삭제는 즉시 영구 삭제하지 않는다.
- 삭제 후 7일 동안 기존 멤버 누구나 복구할 수 있다.
- 날짜 일정 삭제 대신 `status: cancelled`를 사용한다.
- 이미 제출된 항목 변경 시 경고와 변경 사유를 요구한다.
- 멤버 제거는 DB에서 비활성화하며 과거 제출은 보존한다.
- 모든 관리 작업은 감사 로그에 기록한다.

---

## 3. 권장 기술 스택

```text
Java 21+
Spring Boot
Spring MVC
Spring Security OAuth2 Client
Spring Data JPA
PostgreSQL
WebClient
SnakeYAML
Flyway
Redis / Spring Session (선택)
JUnit 5
Testcontainers
```

| 기술 | 역할 |
|---|---|
| Spring MVC | REST API, OAuth callback, 검증 |
| Spring Security OAuth2 Client | GitLab OAuth 로그인과 세션 |
| Spring Data JPA | 사용자, Workspace, 멤버십, 감사 로그 |
| PostgreSQL | 사용자, 토큰, Workspace, 멤버십, 감사 로그 |
| WebClient | GitLab REST API 호출 |
| SnakeYAML | `study.yml`, `session.yml` 파싱·생성 |
| JCA/JCE | OAuth access/refresh token 암호화 |
| Flyway | 데이터베이스 스키마 마이그레이션 |
| Redis | OAuth state, 짧은 캐시, 분산 락(선택) |
| JUnit·Testcontainers | 기능 및 외부 연동 테스트 |

```mermaid
flowchart LR
    U[브라우저] -->|HTTPS / HttpOnly 쿠키| FE[React Frontend]
    FE -->|REST API| BE[Spring Boot]
    BE --> DB[(PostgreSQL)]
    BE --> R[(Redis 선택)]
    BE -->|OAuth / REST API| GL[GitLab Self-Managed]
    GL --> P[(팀별 GitLab Project)]
```

---

## 4. GitLab OAuth 연동

### 4.1 OAuth Application

사내 GitLab에서 웹서비스용 OAuth Application 하나를 등록한다.

```text
Name: Study-ing
Redirect URI: https://api.example.com/api/v1/auth/gitlab/callback
Confidential: 활성화
```

개발 환경:

```text
http://localhost:8000/api/v1/auth/gitlab/callback
```

애플리케이션은 저장소마다 등록하지 않는다. 웹서비스용 Application 하나를 만들고 각 사용자가 OAuth 승인을 한다.

### 4.2 Scope

#### MVP 권장: GitLab API로 파일 쓰기

```text
api
```

이 방식은 Repository Files API와 Commits API를 사용하기 쉽지만 scope가 넓다. 백엔드는 사용자가 접근 가능한 모든 프로젝트를 임의로 사용하면 안 되고, Workspace에 연결된 프로젝트 하나만 강제로 사용해야 한다.

#### 대안: 읽기는 API, 쓰기는 Git push

```text
read_api
write_repository
```

이 방식은 API 전체 쓰기 권한을 피할 수 있지만 clone, pull, commit, push, 충돌 및 임시 저장소 관리가 필요하다.

MVP는 `api` 방식으로 구현하고 GitLab 쓰기 로직을 인터페이스로 분리해 이후 Git push 방식으로 교체 가능하게 한다.

### 4.3 로그인 흐름

```mermaid
sequenceDiagram
    participant U as 사용자
    participant F as Frontend
    participant B as Backend
    participant G as GitLab

    U->>F: GitLab으로 로그인
    F->>B: GET /auth/gitlab/login
    B->>B: OAuth state 생성
    B-->>U: GitLab authorize로 redirect
    U->>G: 로그인 및 승인
    G-->>B: callback(code, state)
    B->>B: state 검증
    B->>G: POST /oauth/token
    G-->>B: access_token, refresh_token
    B->>G: GET /api/v4/user
    G-->>B: 사용자 정보
    B->>B: 사용자 upsert + 토큰 암호화
    B-->>U: 앱 세션 쿠키 발급
```

### 4.4 토큰 보관

브라우저에는 GitLab 토큰을 저장하지 않는다.

```text
브라우저: 앱 세션 ID만 HttpOnly 쿠키
백엔드 DB: access_token, refresh_token 암호화 저장
```

쿠키:

```text
HttpOnly
Secure
SameSite=Lax
Path=/
```

토큰 만료 60초 전에는 refresh token으로 갱신한다. 같은 사용자의 동시 갱신을 막기 위해 사용자 ID 단위 락을 사용한다.

---

## 5. 사용자와 팀원 정보

### 5.1 로그인 사용자

```http
GET /api/v4/user
```

주요 필드:

```text
id
username
name
avatar_url
commit_email
```

식별자는 변경 가능한 username이 아니라 GitLab 숫자 `id`를 사용한다.

### 5.2 프로젝트 멤버 후보

```http
GET /api/v4/projects/:id/members/all
```

이 API는 직접 추가된 멤버뿐 아니라 상위 그룹을 통해 상속된 유효 멤버도 포함한다. 프로젝트 멤버 전체를 자동으로 스터디원으로 등록하지 않고 후보로 보여준 뒤 선택된 사람만 앱 DB에 저장한다.

### 5.3 멤버 동기화

- 앱에 추가해도 GitLab 프로젝트에 자동 초대하지 않는다.
- 앱에서 제거해도 GitLab 프로젝트 권한을 삭제하지 않는다.
- GitLab 접근 권한을 잃은 멤버는 앱에서 `PROJECT_ACCESS_LOST`로 표시하고 쓰기를 차단한다.

---

## 6. 저장소 표준 구조

```text
/
├── README.md
├── study.yml
│
├── 260723/
│   ├── session.yml
│   ├── member-a.md
│   ├── member-b.md
│   └── member-c.md
│
└── 260724/
    ├── session.yml
    ├── member-a.md
    └── member-b.md
```

멤버가 아직 제출하지 않았다면 멤버 파일은 없어도 된다. 최초 일정 생성 시 `session.yml`을 만들면 날짜 폴더가 함께 생성된다.

### 6.1 `study.yml`

```yaml
version: 1

study:
  id: evening-workspace
  name: 저녁 학습 모임
  timezone: Asia/Seoul
  dateFolderFormat: YYMMDD
  sessionFileName: session.yml
  defaultBranch: main

members:
  - gitlabUserId: 101
    username: gitlab-user-a
    displayName: 멤버 A
    memberId: member-a
    fileName: member-a.md
    active: true

settings:
  allowTypes: [algorithm, english, cs, free]
  allowSubmissionTypes: [link, text, code, mixed]
  requireChangeNoteWhenSubmitted: true
```

DB는 접근 권한의 기준이고, `study.yml`은 저장소 자체의 이식 가능한 설정이다.

---

## 7. 날짜별 `session.yml`

```yaml
version: 1
revision: 3

date: 2026-07-23
type: algorithm
title: 큐와 배열 집중 학습
description: 블로그에 풀이를 작성하고 링크를 제출합니다.
status: active
deadline: 2026-07-23T23:59:00+09:00
secondaryDeadline: 2026-07-24T23:59:00+09:00

createdAt: 2026-07-21T20:00:00+09:00
createdBy:
  gitlabUserId: 101
  username: gitlab-user-a

updatedAt: 2026-07-23T00:05:00+09:00
updatedBy:
  gitlabUserId: 102
  username: gitlab-user-b

change:
  changed: true
  message: 문제 2가 삼각 달팽이에서 프로세스로 변경되었습니다.
  reason: 난이도 조정

items:
  - id: item-a8f11c
    order: 1
    title: 행렬 테두리 회전하기
    source: programmers
    url: https://school.programmers.co.kr/...
    submitType: link
    required: true
    status: active

  - id: item-b712dd
    order: 2
    title: 프로세스
    source: programmers
    url: https://school.programmers.co.kr/...
    submitType: link
    required: true
    status: active
    replaces: item-old22

archivedItems:
  - id: item-old22
    title: 삼각 달팽이
    status: replaced
    replacedBy: item-b712dd
```

`secondaryDeadline`은 선택 필드다. 설정하는 경우 반드시 `deadline`보다 늦어야 하며, 설정하지 않으면 `session.yml`에서 생략한다.

### 항목 ID 정책

- 날짜 폴더 안에서 고유해야 한다.
- 다른 문제로 교체할 때 기존 ID를 재사용하지 않는다.
- 오타 수정은 같은 ID를 유지할 수 있다.
- 완전 교체는 기존 항목을 `archivedItems`로 옮기고 새 ID를 발급한다.
- 취소 항목은 삭제보다 `status: cancelled`를 사용한다.

### 학습 유형

```text
algorithm
english
cs
free
```

### 제출 방식

```text
link
text
code
mixed
```

---

## 8. 멤버 제출 파일

```markdown
---
version: 1
memberId: member-a
gitlabUserId: 101
username: gitlab-user-a
date: 260723
sessionRevision: 3
sessionType: algorithm
updatedAt: 2026-07-23T21:32:00+09:00

submissions:
  - itemId: item-a8f11c
    type: link
    value: https://blog.example.com/rotation
    submittedAt: 2026-07-23T20:10:00+09:00
    updatedAt: 2026-07-23T20:10:00+09:00

  - itemId: item-b712dd
    type: link
    value: https://blog.example.com/process
    submittedAt: 2026-07-23T21:32:00+09:00
    updatedAt: 2026-07-23T21:32:00+09:00

reflection: 큐 처리 순서를 먼저 정리하니 구현하기 쉬웠다.
---

# 큐와 배열 집중 학습

## 행렬 테두리 회전하기

https://blog.example.com/rotation

## 프로세스

https://blog.example.com/process
```

### 개별 항목 제출 병합

`item-b712dd`만 제출할 때:

1. 현재 멤버 파일 조회
2. YAML Front Matter 파싱
3. 같은 item ID가 있으면 해당 값만 수정
4. 없으면 submissions에 추가
5. 다른 항목 제출은 유지
6. Markdown 본문 재생성
7. 파일 업데이트 커밋


---

## 9. 완료율 계산 규칙

필수 활성 항목:

```text
session.items where required == true and status == active
```

멤버의 완료 항목은 제출 파일의 `submissions.itemId`와 비교한다.

```text
내 진행률 =
제출된 필수 활성 항목 수 / 전체 필수 활성 항목 수

팀 완료 인원 =
모든 필수 활성 항목을 제출한 멤버 수 / 전체 활성 멤버 수

전체 제출률 =
모든 활성 멤버의 필수 항목 제출 수 /
(활성 멤버 수 × 필수 활성 항목 수)
```

선택 항목은 기본 완료율에서 제외한다.

---

## 10. 데이터베이스 설계

```mermaid
erDiagram
    USERS ||--|| OAUTH_CREDENTIALS : has
    USERS ||--o{ WORKSPACE_MEMBERS : joins
    WORKSPACES ||--o{ WORKSPACE_MEMBERS : contains
    USERS ||--o{ AUDIT_EVENTS : performs
    WORKSPACES ||--o{ AUDIT_EVENTS : records

    USERS {
        uuid id PK
        bigint gitlab_user_id UK
        string username
        string display_name
        string avatar_url
        string commit_email
        datetime created_at
        datetime updated_at
    }

    OAUTH_CREDENTIALS {
        uuid user_id PK
        text encrypted_access_token
        text encrypted_refresh_token
        datetime expires_at
        string scopes
        datetime updated_at
    }

    WORKSPACES {
        uuid id PK
        string name
        bigint gitlab_project_id
        string gitlab_project_path
        string default_branch
        string status
        datetime deleted_at
        uuid created_by_user_id
        datetime created_at
        datetime updated_at
    }

    WORKSPACE_MEMBERS {
        uuid workspace_id PK
        uuid user_id PK
        string member_id
        string file_name
        string display_name
        string status
        int last_known_access_level
        datetime created_at
        datetime updated_at
    }

    AUDIT_EVENTS {
        uuid id PK
        uuid workspace_id
        uuid actor_user_id
        string action
        string target_type
        string target_id
        json metadata
        datetime created_at
    }
```

### 10.1 `users`

```sql
id UUID PRIMARY KEY
gitlab_user_id BIGINT UNIQUE NOT NULL
username VARCHAR(255) NOT NULL
display_name VARCHAR(255) NOT NULL
avatar_url TEXT NULL
commit_email VARCHAR(320) NULL
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL
```

### 10.2 `oauth_credentials`

```sql
user_id UUID PRIMARY KEY REFERENCES users(id)
encrypted_access_token TEXT NOT NULL
encrypted_refresh_token TEXT NOT NULL
expires_at TIMESTAMPTZ NOT NULL
scopes TEXT NOT NULL
updated_at TIMESTAMPTZ NOT NULL
```

### 10.3 `workspaces`

```sql
id UUID PRIMARY KEY
name VARCHAR(120) NOT NULL
gitlab_project_id BIGINT NOT NULL
gitlab_project_path VARCHAR(512) NOT NULL
default_branch VARCHAR(255) NOT NULL
status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE'
deleted_at TIMESTAMPTZ NULL
created_by_user_id UUID NOT NULL REFERENCES users(id)
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL
```

같은 GitLab 프로젝트에 활성 Workspace가 중복되지 않게 제약을 둔다.

### 10.4 `workspace_members`

```sql
workspace_id UUID REFERENCES workspaces(id)
user_id UUID REFERENCES users(id)
member_id VARCHAR(80) NOT NULL
file_name VARCHAR(255) NOT NULL
display_name VARCHAR(255) NOT NULL
status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE'
last_known_access_level INTEGER NULL
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL

PRIMARY KEY(workspace_id, user_id)
UNIQUE(workspace_id, member_id)
UNIQUE(workspace_id, file_name)
```

### 10.5 감사 이벤트

```text
WORKSPACE_CREATED
WORKSPACE_UPDATED
WORKSPACE_DELETED
WORKSPACE_RESTORED
MEMBER_ADDED
MEMBER_DEACTIVATED
MEMBER_REACTIVATED
SESSION_CREATED
SESSION_UPDATED
SESSION_CANCELLED
SESSION_ITEM_REPLACED
SUBMISSION_CREATED
SUBMISSION_UPDATED
SUBMISSION_REMOVED
REPOSITORY_SYNCED
```

GitLab 커밋 SHA와 파일 경로를 metadata에 기록한다.

---

## 11. API 공통 규칙

### Base URL

```text
/api/v1
```

### 인증

```http
Cookie: sid=<application-session-id>
```

GitLab 토큰은 프론트엔드에 반환하지 않는다.

### 응답

```json
{
  "data": {}
}
```

목록:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "perPage": 20,
    "total": 100
  }
}
```

오류:

```json
{
  "error": {
    "code": "SUBMISSION_CONFLICT",
    "message": "다른 요청이 파일을 먼저 수정했습니다.",
    "details": {
      "filePath": "260723/member-a.md"
    },
    "requestId": "req_01..."
  }
}
```

### 날짜

- API 날짜: `YYYY-MM-DD`
- 저장소 폴더: `YYMMDD`
- 시각: ISO 8601 + timezone

---

## 12. 인증 API

### 로그인 시작

```http
GET /api/v1/auth/gitlab/login?returnUrl=/today
```

GitLab authorize URL로 redirect한다.

### callback

```http
GET /api/v1/auth/gitlab/callback?code=...&state=...
```

### 현재 사용자

```http
GET /api/v1/auth/me
```

```json
{
  "data": {
    "id": "user-uuid",
    "gitlabUserId": 101,
    "username": "gitlab-user-a",
    "displayName": "멤버 A",
    "avatarUrl": "https://gitlab.example.com/...",
    "workspaces": [
      {
        "id": "workspace-uuid",
        "name": "저녁 학습 모임"
      }
    ]
  }
}
```

### 로그아웃

```http
POST /api/v1/auth/logout
```

---

## 13. GitLab 프로젝트 API

### 접근 가능한 프로젝트

```http
GET /api/v1/gitlab/projects?search=&page=1&perPage=20
```

내부 GitLab 호출:

```http
GET /api/v4/projects?membership=true&simple=true
```

응답:

```json
{
  "data": [
    {
      "id": 1234,
      "name": "algorithm-study",
      "pathWithNamespace": "study-group/algorithm-study",
      "defaultBranch": "main",
      "visibility": "private",
      "webUrl": "https://gitlab.example.com/study-group/algorithm-study",
      "effectiveAccessLevel": 30
    }
  ]
}
```

### 연결 검사

```http
GET /api/v1/gitlab/projects/{project_id}/connection-check
```

검사 항목:

- 프로젝트 접근 가능
- 기본 브랜치 존재
- 현재 사용자 프로젝트 멤버
- Repository Files API 읽기 가능
- 브랜치 쓰기 가능
- `study.yml` 존재 여부
- 이미 활성 Workspace에 연결되었는지

---

## 14. Workspace API

### 내 Workspace 목록

```http
GET /api/v1/workspaces
```

### Workspace 생성

모든 로그인 사용자가 가능하다.

```http
POST /api/v1/workspaces
```

```json
{
  "name": "저녁 학습 모임",
  "gitlabProjectId": 1234,
  "defaultBranch": "main",
  "selectedGitlabUserIds": [101, 102, 103],
  "initializeRepository": true
}
```

처리 순서:

1. 프로젝트 접근 및 쓰기 권한 확인
2. 프로젝트 유효 멤버 조회
3. 선택한 GitLab 사용자 ID 검증
4. 중복 Workspace 확인
5. Workspace와 멤버십 DB 생성
6. 저장소에 `study.yml` 생성 또는 검증
7. 감사 로그 기록

### Workspace 상세

```http
GET /api/v1/workspaces/{workspace_id}
```

### 설정 수정

```http
PATCH /api/v1/workspaces/{workspace_id}
```

모든 활성 멤버가 가능하다.

### 소프트 삭제

```http
DELETE /api/v1/workspaces/{workspace_id}
```

```json
{
  "confirmationName": "저녁 학습 모임"
}
```

DB 상태만 `SOFT_DELETED`로 바꾸며 GitLab 프로젝트나 파일은 삭제하지 않는다.

### 복원

```http
POST /api/v1/workspaces/{workspace_id}/restore
```

삭제 후 7일 동안 기존 멤버 누구나 복구할 수 있다.

---

## 15. 멤버 API

### 프로젝트 멤버 후보

```http
GET /api/v1/workspaces/{workspace_id}/member-candidates
```

내부:

```http
GET /api/v4/projects/:id/members/all
```

### Workspace 멤버

```http
GET /api/v1/workspaces/{workspace_id}/members
```

### 멤버 추가

```http
POST /api/v1/workspaces/{workspace_id}/members
```

```json
{
  "gitlabUserId": 104,
  "memberId": "member-d",
  "fileName": "member-d.md",
  "displayName": "멤버 D"
}
```

추가 전 현재 GitLab 프로젝트의 유효 멤버인지 확인한다.

### 멤버 비활성화

```http
DELETE /api/v1/workspaces/{workspace_id}/members/{user_id}
```

과거 제출은 유지한다.

### GitLab 멤버 동기화

```http
POST /api/v1/workspaces/{workspace_id}/members/sync
```

```json
{
  "data": {
    "active": 3,
    "lostProjectAccess": 1,
    "newCandidates": 2
  }
}
```

---

## 16. Session API

### 목록

```http
GET /api/v1/workspaces/{workspace_id}/sessions
```

Query:

```text
from=2026-07-01
to=2026-07-31
type=algorithm
status=active
```

루트 repository tree에서 날짜 패턴 폴더를 찾고 각 폴더의 `session.yml`을 파싱한다.

### 특정 날짜 조회

```http
GET /api/v1/workspaces/{workspace_id}/sessions/2026-07-23
```

```json
{
  "data": {
    "date": "2026-07-23",
    "folder": "260723",
    "revision": 3,
    "type": "algorithm",
    "title": "큐와 배열 집중 학습",
    "deadline": "2026-07-23T23:59:00+09:00",
    "secondaryDeadline": "2026-07-24T23:59:00+09:00",
    "items": [],
    "gitlab": {
      "filePath": "260723/session.yml",
      "lastCommitId": "abc123"
    }
  }
}
```

### 생성

```http
POST /api/v1/workspaces/{workspace_id}/sessions
```

```json
{
  "date": "2026-07-23",
  "type": "algorithm",
  "title": "큐와 배열 집중 학습",
  "description": "블로그 풀이 링크를 제출합니다.",
  "deadline": "2026-07-23T23:59:00+09:00",
  "secondaryDeadline": "2026-07-24T23:59:00+09:00",
  "items": [
    {
      "title": "행렬 테두리 회전하기",
      "source": "programmers",
      "url": "https://...",
      "submitType": "link",
      "required": true
    }
  ]
}
```

백엔드가 item ID, revision, 생성자 정보를 추가해 `{YYMMDD}/session.yml`을 커밋한다.

커밋 메시지:

```text
study: create session 260723
```

### 수정

```http
PUT /api/v1/workspaces/{workspace_id}/sessions/{date}
```

```json
{
  "expectedRevision": 3,
  "lastCommitId": "abc123",
  "title": "큐와 배열 집중 학습",
  "changeReason": "문제 난이도 조정",
  "items": []
}
```

- revision 검사
- 파일 last commit 검사
- 기존 제출 존재 여부 검사
- item 교체 정책 적용
- revision 증가
- `session.yml` 업데이트

### 취소

```http
DELETE /api/v1/workspaces/{workspace_id}/sessions/{date}
```

파일 삭제 대신 `status: cancelled`로 수정한다.


---

## 17. Dashboard API

프론트가 여러 GitLab 파일 API를 직접 조합하지 않도록 집계 API를 제공한다.

```http
GET /api/v1/workspaces/{workspace_id}/sessions/{date}/dashboard
```

```json
{
  "data": {
    "session": {
      "date": "2026-07-23",
      "type": "algorithm",
      "title": "큐와 배열 집중 학습",
      "itemCount": 2,
      "requiredItemCount": 2,
      "deadline": "2026-07-23T23:59:00+09:00"
    },
    "metrics": {
      "completedMembers": 2,
      "totalMembers": 3,
      "memberCompletionRate": 66.7,
      "submittedItems": 5,
      "totalRequiredSubmissions": 6,
      "submissionRate": 83.3
    },
    "me": {
      "completedItems": 1,
      "requiredItems": 2,
      "completionRate": 50,
      "nextPendingItemId": "item-b712dd"
    },
    "members": [
      {
        "memberId": "member-a",
        "displayName": "멤버 A",
        "filePath": "260723/member-a.md",
        "completedItems": 1,
        "requiredItems": 2,
        "status": "PARTIAL",
        "lastSubmittedAt": "2026-07-23T20:10:00+09:00"
      }
    ]
  }
}
```

집계 순서:

1. `session.yml` 조회 및 파싱
2. 활성 멤버 목록 조회
3. 날짜 폴더 tree 조회
4. 존재하는 멤버 파일을 제한된 동시성으로 병렬 조회
5. Front Matter 파싱
6. item ID 기준 완료율 계산
7. 15~30초 캐시

---

## 18. 개별 Submission API

### 내 항목 제출 조회

```http
GET /api/v1/workspaces/{workspace_id}/sessions/{date}/items/{item_id}/submission
```

### 항목 하나 제출 또는 수정

```http
PUT /api/v1/workspaces/{workspace_id}/sessions/{date}/items/{item_id}/submission
```

링크:

```json
{
  "type": "link",
  "value": "https://blog.example.com/process",
  "expectedFileCommitId": "file-last-commit-id"
}
```

텍스트:

```json
{
  "type": "text",
  "value": "TCP는 연결 지향이며..."
}
```

코드:

```json
{
  "type": "code",
  "language": "java",
  "value": "class Solution { ... }"
}
```

처리 흐름:

```mermaid
sequenceDiagram
    participant F as Frontend
    participant B as Backend
    participant G as GitLab

    F->>B: PUT item submission
    B->>B: 앱 멤버십 검증
    B->>G: 프로젝트 멤버·권한 재확인
    B->>G: session.yml 조회
    B->>B: item과 submitType 검증
    B->>G: 내 멤버 파일 조회
    alt 파일 없음
        B->>B: 새 Markdown 생성
        B->>G: POST Repository File
    else 파일 존재
        B->>B: 해당 item만 병합
        B->>G: PUT Repository File + last_commit_id
    end
    G-->>B: commit 결과
    B->>B: 감사 로그 + 캐시 무효화
    B-->>F: 갱신된 진행률
```

응답:

```json
{
  "data": {
    "itemId": "item-b712dd",
    "status": "SUBMITTED",
    "filePath": "260723/member-a.md",
    "commitId": "def456",
    "dashboard": {
      "myCompletedItems": 2,
      "myRequiredItems": 2,
      "teamSubmissionRate": 100
    }
  }
}
```

### 제출 제거

```http
DELETE /api/v1/workspaces/{workspace_id}/sessions/{date}/items/{item_id}/submission
```

파일 자체를 삭제하지 않고 해당 item entry만 제거한다.

### 다른 멤버 제출 조회

```http
GET /api/v1/workspaces/{workspace_id}/sessions/{date}/members/{member_id}/submission
```

읽기 전용이며 GitLab 파일 URL과 마지막 커밋 정보를 포함한다.

---

## 19. Repository API

### Tree

```http
GET /api/v1/workspaces/{workspace_id}/repository/tree?path=&ref=main
```

### 파일 조회

```http
GET /api/v1/workspaces/{workspace_id}/repository/file?path=260723/session.yml&ref=main
```

```json
{
  "data": {
    "path": "260723/session.yml",
    "type": "yaml",
    "rawContent": "...",
    "parsedContent": {},
    "lastCommitId": "abc123",
    "webUrl": "https://gitlab.example.com/..."
  }
}
```

미리보기 허용 확장자 예시:

```text
.yml .yaml .md .txt .java .py .cpp .js .ts
```

권장 파일 미리보기 크기 제한:

```text
1 MB
```

Markdown은 raw HTML을 기본 비활성화하고 sanitize 후 렌더링한다.

---

## 20. GitLab API 매핑

| 앱 기능 | GitLab API |
|---|---|
| 현재 사용자 | `GET /api/v4/user` |
| 프로젝트 목록 | `GET /api/v4/projects?membership=true` |
| 프로젝트 상세 | `GET /api/v4/projects/:id` |
| 전체 유효 멤버 | `GET /api/v4/projects/:id/members/all` |
| 특정 멤버 확인 | `GET /api/v4/projects/:id/members/all/:user_id` |
| 저장소 tree | `GET /api/v4/projects/:id/repository/tree` |
| 파일 조회 | `GET /api/v4/projects/:id/repository/files/:path` |
| raw 파일 | `GET /api/v4/projects/:id/repository/files/:path/raw` |
| 파일 생성 | `POST /api/v4/projects/:id/repository/files/:path` |
| 파일 수정 | `PUT /api/v4/projects/:id/repository/files/:path` |
| 다중 파일 커밋 | `POST /api/v4/projects/:id/repository/commits` |

파일 생성과 수정:

```text
GET file
├── 404 → POST create
└── 200 → PUT update
```

커밋 작성자에는 로그인 사용자의 `/user` 응답에서 `name`, `commit_email`을 사용하고 API 호출도 그 사용자의 OAuth 토큰으로 수행한다.

커밋 메시지 규칙:

```text
study: create session 260723
study: update session 260723
submit: member-a 260723 item-b712dd
update: member-a 260723 item-b712dd
remove: member-a 260723 item-b712dd
config: update study members
```

Workspace 초기화 시 `README.md`와 `study.yml` 등 여러 파일을 한 번에 만들 필요가 있으면 Commits API의 여러 `actions`를 사용한다.

---

## 21. 동시성 및 충돌

### 제출 충돌

한 사용자가 여러 탭에서 같은 파일을 수정할 수 있으므로 Repository Files Update의 `last_commit_id`를 사용한다.

항목 A를 제출하는 동안 다른 요청이 항목 B를 수정했다면:

1. 첫 업데이트 실패
2. 최신 파일 재조회
3. 항목 A가 다른 요청에서 바뀌지 않았는지 확인
4. 최신 파일에 항목 A만 다시 병합
5. 한 번 재시도

같은 item이 동시에 변경되었다면 자동 덮어쓰기하지 않고 `409 SUBMISSION_CONFLICT`를 반환한다.

### 일정 충돌

`session.yml`은 `revision`과 `lastCommitId`를 모두 검사한다.

```text
expectedRevision != currentRevision
→ 409 SESSION_REVISION_CONFLICT
```

프론트는 최신 내용을 다시 불러온 뒤 변경점을 사용자에게 보여준다.

---

## 22. 경로 권한

### 일반 멤버가 쓸 수 있는 파일

```text
{YYMMDD}/{자신에게 매핑된 file_name}
```

### 모든 활성 멤버가 관리 목적으로 쓸 수 있는 파일

```text
study.yml
{YYMMDD}/session.yml
```

### 금지

```text
../
절대 경로
다른 멤버 제출 파일
.git/
바이너리 및 실행 파일
Workspace와 연결되지 않은 프로젝트
```

프론트가 보낸 `project_id`나 임의 파일 경로를 그대로 사용하지 않는다.

---

## 23. 보안

### OAuth 및 세션

- OAuth `state` 필수 검증
- state TTL 5~10분
- Redirect URI 고정
- `returnUrl`은 내부 경로만 허용
- 토큰과 Client Secret 로그 금지
- 토큰은 AES-GCM 또는 검증된 암호화 도구로 저장
- 상태 변경 요청은 CSRF 토큰 또는 엄격한 Origin 검증 적용

### SSRF

GitLab 주소는 환경변수로 고정한다.

```env
GITLAB_BASE_URL=https://gitlab.company.example
```

사용자가 임의 GitLab 서버 주소를 입력하게 하지 않는다.

### 제출 콘텐츠

- URL은 `http`, `https`만 허용
- Markdown raw HTML 비활성화 또는 sanitize
- 제출 코드는 저장·조회만 하고 실행하지 않음
- 파일 크기와 텍스트 길이 제한
- audit log에 원문 토큰이나 민감정보 저장 금지

---

## 24. 오류 코드

| HTTP | Code | 의미 |
|---:|---|---|
| 400 | `INVALID_REQUEST` | 요청 형식 오류 |
| 400 | `INVALID_SESSION_FILE` | YAML 파싱 실패 |
| 401 | `AUTH_REQUIRED` | 로그인 필요 |
| 401 | `GITLAB_TOKEN_REFRESH_FAILED` | 토큰 갱신 실패 |
| 403 | `WORKSPACE_ACCESS_DENIED` | Workspace 미가입 |
| 403 | `GITLAB_PROJECT_ACCESS_DENIED` | GitLab 프로젝트 접근 불가 |
| 403 | `GITLAB_WRITE_PERMISSION_REQUIRED` | 쓰기 권한 없음 |
| 403 | `FILE_PATH_NOT_ALLOWED` | 허용되지 않은 경로 |
| 404 | `WORKSPACE_NOT_FOUND` | Workspace 없음 |
| 404 | `SESSION_NOT_FOUND` | session 없음 |
| 404 | `ITEM_NOT_FOUND` | 학습 항목 없음 |
| 409 | `WORKSPACE_ALREADY_CONNECTED` | 프로젝트가 이미 연결됨 |
| 409 | `SESSION_ALREADY_EXISTS` | 날짜 session 존재 |
| 409 | `SESSION_REVISION_CONFLICT` | 일정 수정 충돌 |
| 409 | `SUBMISSION_CONFLICT` | 같은 제출 동시 수정 |
| 422 | `SUBMISSION_TYPE_MISMATCH` | 제출 방식 불일치 |
| 502 | `GITLAB_API_ERROR` | GitLab 응답 오류 |
| 503 | `GITLAB_UNREACHABLE` | GitLab 네트워크 접속 불가 |

---

## 25. 캐시와 성능

| 데이터 | 권장 TTL |
|---|---:|
| 프로젝트 목록 | 60초 |
| 프로젝트 멤버 목록 | 60초 |
| Repository tree | 30초 |
| session.yml 파싱 | 30초 |
| Dashboard | 15~30초 |

쓰기 성공 시 관련 캐시는 즉시 무효화한다.

멤버 파일 병렬 조회는 `asyncio.gather`와 semaphore를 사용해 GitLab 동시 요청 수를 5~10 정도로 제한한다.

GitLab이 `429`를 반환하면 `Retry-After`를 존중하고 지수 백오프를 사용한다. 자동 무한 재시도는 하지 않는다.

---

## 26. 백엔드 폴더 구조

```text
backend/
├── app/
│   ├── main.py
│   ├── config.py
│   ├── dependencies.py
│   │
│   ├── api/v1/
│   │   ├── auth.py
│   │   ├── gitlab.py
│   │   ├── workspaces.py
│   │   ├── members.py
│   │   ├── sessions.py
│   │   ├── submissions.py
│   │   └── repository.py
│   │
│   ├── domain/
│   │   ├── workspace.py
│   │   ├── study_session.py
│   │   ├── submission.py
│   │   └── errors.py
│   │
│   ├── schemas/
│   ├── services/
│   │   ├── auth_service.py
│   │   ├── workspace_service.py
│   │   ├── membership_service.py
│   │   ├── session_service.py
│   │   ├── submission_service.py
│   │   ├── dashboard_service.py
│   │   └── repository_service.py
│   │
│   ├── integrations/gitlab/
│   │   ├── client.py
│   │   ├── oauth.py
│   │   ├── projects.py
│   │   ├── members.py
│   │   ├── repository.py
│   │   └── commits.py
│   │
│   ├── persistence/
│   │   ├── db.py
│   │   ├── models/
│   │   └── repositories/
│   │
│   ├── security/
│   │   ├── encryption.py
│   │   ├── sessions.py
│   │   └── csrf.py
│   │
│   └── utils/
│       ├── dates.py
│       ├── markdown.py
│       ├── yaml.py
│       └── paths.py
│
├── alembic/
├── tests/
├── pyproject.toml
├── .env.example
└── Dockerfile
```

---

## 27. 환경변수

```env
APP_ENV=development
APP_BASE_URL=http://localhost:8000
FRONTEND_BASE_URL=http://localhost:5173

DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/study_workspace
REDIS_URL=redis://localhost:6379/0

SESSION_SECRET=change-me
TOKEN_ENCRYPTION_KEY=change-me
CSRF_SECRET=change-me

GITLAB_BASE_URL=https://gitlab.company.example
GITLAB_API_BASE_URL=https://gitlab.company.example/api/v4
GITLAB_CLIENT_ID=
GITLAB_CLIENT_SECRET=
GITLAB_REDIRECT_URI=http://localhost:8000/api/v1/auth/gitlab/callback
GITLAB_SCOPES=api
GITLAB_WRITE_MODE=api
GITLAB_REQUEST_TIMEOUT_SECONDS=10
GITLAB_MAX_CONCURRENCY=8

CACHE_DASHBOARD_TTL_SECONDS=20
CACHE_REPOSITORY_TTL_SECONDS=30
SOFT_DELETE_RETENTION_DAYS=7
MAX_PREVIEW_FILE_SIZE_BYTES=1048576
```

`.env`는 Git에 커밋하지 않는다.

---

## 28. 개발 단계

### Phase 1: OAuth와 프로젝트 연결

- GitLab 로그인
- 토큰 암호화 저장과 refresh
- 프로젝트 목록
- 프로젝트 연결 검사
- 프로젝트 멤버 후보
- Workspace와 멤버십 생성

완료 기준:

```text
로그인 → 프로젝트 선택 → 멤버 선택 → Workspace 생성
```

### Phase 2: 저장소 읽기와 Dashboard

- Repository tree
- 파일 조회
- YAML/Markdown 파싱
- Session 목록
- 날짜 Dashboard 집계
- 저장소 미리보기

### Phase 3: 일정 관리

- `session.yml` 생성·수정
- 가변 항목 수
- 영어·CS·자유주제
- 항목 교체와 변경 사유
- revision 충돌

### Phase 4: 항목별 제출

- 내 멤버 파일 생성
- item 단위 병합
- 링크·텍스트·코드 검증
- 파일 미리보기
- 사용자 계정 커밋
- 진행률 즉시 갱신

### Phase 5: 안정화

- 감사 로그
- 소프트 삭제
- 캐시
- 네트워크 장애 처리
- 충돌 자동 재시도
- 통합 및 E2E 테스트

---

## 29. 테스트 전략

### 단위 테스트

- 날짜와 폴더 변환
- YAML 직렬화·역직렬화
- Markdown Front Matter 파싱
- item 하나 병합
- 완료율 계산
- 경로 검증
- 제출 방식 검증
- 토큰 암호화

### 서비스 테스트

- Workspace 비회원 접근 거부
- Reporter 쓰기 거부
- Developer 일정 생성
- 다른 멤버 파일 수정 거부
- 한 item 제출 시 기존 item 유지
- 문제 교체 시 새 item ID
- revision 충돌 시 409
- OAuth token refresh

### GitLab 통합 테스트

테스트용 프로젝트에서 다음을 확인한다.

- 프로젝트 조회
- 멤버 조회
- tree 조회
- 파일 create/update
- `last_commit_id` 충돌
- OAuth refresh
- 보호 브랜치 오류

### E2E 예시

```text
사용자 A 로그인
→ 프로젝트와 멤버 선택
→ Workspace 생성
→ 260723/session.yml 생성

사용자 B 로그인
→ 가입 Workspace 표시
→ item-1 제출
→ 260723/member-b.md 생성
→ Dashboard 1/N 반영

사용자 C가 문제 교체
→ 기존 제출 경고
→ 변경 사유 입력
→ 새 item ID 생성
→ 변경 배너 표시
```

---

## 30. 운영 전 확인

- [ ] 외부 백엔드에서 사내 GitLab HTTPS 접근 가능
- [ ] 인증서 체인 정상
- [ ] `/api/v4/user` 호출 가능
- [ ] 프로젝트 멤버 API 호출 가능
- [ ] Repository Files API 쓰기 가능
- [ ] 기본 브랜치 보호 규칙 확인
- [ ] 사용자 `commit_email` 확인
- [ ] OAuth 토큰 외부 서비스 보관이 사내 정책상 허용됨
- [ ] Client Secret과 토큰 로그 마스킹
- [ ] DB 백업
- [ ] Workspace 복구 정책
- [ ] GitLab 장애 시 사용자 안내

---

## 31. MVP 최종 범위

### 반드시 포함

- GitLab OAuth 로그인
- 프로젝트 선택
- Workspace 생성
- 모든 활성 멤버 동등 권한
- 프로젝트 멤버 후보 조회·선택
- 날짜별 `session.yml`
- 알고리즘·영어·CS·자유주제
- 날짜별 가변 항목 수
- 항목 하나씩 개별 제출
- 각 사용자 GitLab 계정 커밋
- Dashboard 집계
- 저장소 tree와 파일 조회
- 일정 변경 표시
- 충돌 방지

### 이후 확장

- Merge Request 기반 제출
- 알림
- 랜덤 리뷰 배정
- 주간 통계
- Webhook 실시간 동기화
- GitLab CI 제출 검증
- 여러 GitLab 인스턴스 지원

---

## 32. 구현 요약

```text
인증:
GitLab OAuth + 서버 세션

팀 분리:
Workspace마다 GitLab project_id 하나

권한:
팀장 없음
모든 ACTIVE 멤버 동등 권한
실제 작업은 GitLab access level과 브랜치 권한 재검증

원본 데이터:
GitLab 저장소

DB:
사용자, OAuth 토큰, Workspace, 멤버십, 감사 로그

날짜 데이터:
{YYMMDD}/session.yml

제출 데이터:
{YYMMDD}/{memberId}.md

제출 단위:
item 하나씩

쓰기 방식:
MVP는 Repository Files API

동시성:
last_commit_id + session revision + 409 Conflict

삭제:
영구 삭제보다 soft delete와 cancelled 상태 우선
```

---

## 33. GitLab 공식 문서

실제 구현 전 사내 GitLab 버전에서 endpoint와 기능 지원 여부를 다시 확인한다.

- [OAuth 2.0 identity provider 설정](https://docs.gitlab.com/integration/oauth_provider/)
- [OAuth 2.0 API](https://docs.gitlab.com/api/oauth2/)
- [REST API 인증](https://docs.gitlab.com/api/rest/authentication/)
- [Users API](https://docs.gitlab.com/api/users/)
- [Projects Members API](https://docs.gitlab.com/api/project_members/)
- [Repositories API](https://docs.gitlab.com/api/repositories/)
- [Repository Files API](https://docs.gitlab.com/api/repository_files/)
- [Commits API](https://docs.gitlab.com/api/commits/)
- [Access Token Scopes](https://docs.gitlab.com/security/tokens/access_token_scopes/)

GitLab 공식 문서 기준으로 OAuth Application은 사용자·그룹·인스턴스 단위로 만들 수 있으며, OAuth 토큰은 사용자를 대신해 API를 호출한다. `members/all`은 직접 및 상속된 유효 프로젝트 멤버를 반환하며, Repository Files API는 파일 생성·수정과 `last_commit_id` 기반 충돌 검증에 사용할 수 있다. Commits API는 여러 파일 작업을 한 커밋으로 묶을 때 사용한다.
