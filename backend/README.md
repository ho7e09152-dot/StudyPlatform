# Study Workspace Backend

Spring Boot 기반 Study Workspace 백엔드입니다. 환경변수 없이 실행되는 로컬 개발 모드와 GitLab OAuth 운영 모드를 함께 제공합니다. 일정과 제출 본문은 연결 프로젝트에 실제 커밋하고, 사용자·암호화 credential·Workspace cache와 운영 상태는 DB에 저장합니다.

## 현재 구현 범위

- `dev`/`local` 연결 스파이크에서만 서버 Personal Access Token 선택 사용
- 현재 GitLab 사용자 조회
- 서버에 고정된 GitLab 프로젝트 조회
- 기본 브랜치의 repository tree 조회
- 선택한 텍스트 파일 조회 및 Base64 디코딩
- 공통 GitLab Port의 브랜치 생성·삭제, 파일 생성·수정·삭제
- `last_commit_id`를 이용한 파일 수정·삭제 충돌 방지
- 기본 브랜치를 건드리지 않는 실제 GitLab 쓰기 스파이크
- 프로젝트 ID를 프론트 요청으로 받지 않는 단일 프로젝트 경계
- 상대 파일 경로 검증과 1MB 미리보기 제한
- GitLab 인증·권한·404·요청 제한 오류 변환
- 프론트엔드 개발 주소 CORS 허용
- GitLab 응답 없이도 실행 가능한 미설정 상태
- Workspace 목록·생성·수정·소프트 삭제·복구
- 멤버 목록·추가·비활성화·동기화 진입점
- Session 목록·상세·생성·revision 기반 수정·취소
- OAuth 사용자 권한으로 `session.yml` 생성·수정·취소 커밋
- 원격 `last_commit_id` 검증과 실제 commit SHA 저장
- 항목별 제출 생성·수정·삭제와 기존 항목 보존
- 링크·본문·커밋 메시지 서버 검증
- Dashboard·기록·1차/2차 마감 점수 계산
- Workspace 저장소 tree와 YAML·Markdown 파일 표현
- 알림 설정과 동기화 상태 저장
- JPA/Flyway 기반 Workspace/member/settings/cache 영속화와 기존 `.data/workspaces-production.json` 최초 1회 자동 이관
- GitLab Authorization Code 로그인, 일회성 `state` 검증, 토큰 교환·갱신·폐기
- OAuth access/refresh token의 AES-GCM 암호화 DB 저장
- JDBC 기반 서버 세션과 HttpOnly·SameSite 쿠키
- OAuth 사용자의 프로젝트 검색·권한 재검증·첫 Workspace 온보딩
- Spring Security 인증, CSRF, Workspace 활성 멤버 접근 경계
- Owner/Manager/Member 역할, GitLab 멤버 후보·동기화와 접근 상실 처리
- sync job, 인앱 알림, 감사 로그, 7일 삭제·복원·정리
- GitLab 최신 제출 commit comment 기반 팀 리뷰와 제출자 알림
- PostgreSQL 기반 공지·오늘/전체 메시지 피드, cursor pagination과 soft delete
- PostgreSQL 기반 Markdown 팀 문서, 작성자 전용 수정과 optimistic lock
- `.study-workspace/sessions/{연도}/{날짜}` 저장 구조와 V1 단일 commit 안전 마이그레이션
- request ID, security headers, rate limit, Prometheus metrics와 production Docker/backup runbook

GitLab OAuth Application 환경변수가 있으면 실제 사용자 승인, callback 코드 교환, 사용자와 credential 저장, 접근 가능한 프로젝트 조회를 수행합니다. 운영 모드에서는 API 실패 시 데모 데이터로 대체하지 않습니다. 데모는 프론트의 명시적인 `NEXT_PUBLIC_APP_MODE=demo`에서만 사용합니다.

## 기술 구성

- Java 21 호환 바이트코드
- Spring Boot 4.1
- Spring MVC
- WebClient
- Bean Validation
- Actuator
- Gradle Wrapper
- JUnit 5

Spring Boot 4.1은 Java 17부터 26까지 지원합니다. 로컬 빌드는 현재 설치된 JDK를 사용하고 결과물은 Java 21 호환으로 컴파일합니다.

## 환경변수

예시 파일을 로컬 설정으로 복사합니다.

```bash
cd backend
cp .env.example .env
```

`.env`에 다음 값을 입력합니다.

```dotenv
GITLAB_BASE_URL=https://lab.ssafy.com
GITLAB_ACCESS_TOKEN=발급받은_토큰
GITLAB_PROJECT_ID=그룹명/프로젝트명
GITLAB_DEFAULT_REF=
GITLAB_OAUTH_CLIENT_ID=GitLab_Application_ID
GITLAB_OAUTH_CLIENT_SECRET=GitLab_Application_Secret
GITLAB_OAUTH_REDIRECT_URI=http://localhost:8080/api/v1/auth/gitlab/callback
OAUTH_TOKEN_ENCRYPTION_KEY=Base64로_인코딩한_32바이트_키
DATABASE_URL=jdbc:postgresql://localhost:5432/study_workspace
DATABASE_USERNAME=study
DATABASE_PASSWORD=안전한_비밀번호
FRONTEND_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
SERVER_PORT=8080
```

- 일반 사용자는 PAT 없이 GitLab OAuth `api` scope로 프로젝트를 연결합니다.
- PAT 환경변수는 `dev`/`local` 프로필의 수동 연결 스파이크에서만 사용합니다.
- `GITLAB_PROJECT_ID`는 숫자 Project ID 또는 URL 인코딩하지 않은 `group/project` 경로를 사용할 수 있습니다.
- `GITLAB_DEFAULT_REF`가 비어 있으면 프로젝트의 기본 브랜치를 사용합니다.
- 실제 토큰이 들어 있는 `.env`는 Git에 포함되지 않습니다.

## 실행

macOS 또는 Linux:

```bash
cd backend
set -a
source .env
set +a
./gradlew bootRun
```

GitLab 설정 없이 실행해도 서버는 정상적으로 시작하며 연결 API가 `NOT_CONFIGURED`를 반환합니다.

```bash
curl http://localhost:8080/actuator/health
curl http://localhost:8080/api/v1/gitlab/connection
```

연결 성공 후 파일 조회:

```bash
curl --get \
  --data-urlencode "path=README.md" \
  http://localhost:8080/api/v1/gitlab/repository/file
```

## API

| Method | Endpoint | 설명 |
|---|---|---|
| `GET` | `/actuator/health` | 백엔드 상태 확인 |
| `GET` | `/api/v1/auth/csrf` | 변경 요청용 CSRF token 준비 |
| `GET` | `/api/v1/gitlab/projects` | OAuth 사용자의 접근 가능 프로젝트 검색 |
| `GET` | `/api/v1/gitlab/projects/{projectId}/connection-check` | 선택 프로젝트 접근 권한 재검증 |
| `GET` | `/api/v1/gitlab/connection` | dev/local PAT 연결 스파이크 |
| `GET/POST` | `/api/v1/workspaces` | Workspace 목록·생성 |
| `GET/PATCH/DELETE` | `/api/v1/workspaces/{workspaceId}` | 상세·설정 변경·소프트 삭제 |
| `POST` | `/api/v1/workspaces/{workspaceId}/restore` | Workspace 복구 |
| `GET/POST/DELETE` | `/api/v1/workspaces/{workspaceId}/members...` | 멤버 조회·추가·비활성화·동기화 |
| `GET/POST/PUT/DELETE` | `/api/v1/workspaces/{workspaceId}/sessions...` | 일정 조회·생성·수정·취소 |
| `GET/PUT/DELETE` | `/api/v1/workspaces/{workspaceId}/sessions/.../submission` | 항목별 제출 조회·저장·삭제 |
| `GET` | `/api/v1/workspaces/{workspaceId}/dashboard` | 선택 날짜 진행률 |
| `GET` | `/api/v1/workspaces/{workspaceId}/records` | 기간별 기록 |
| `GET` | `/api/v1/workspaces/{workspaceId}/scores` | 기간별 점수와 순위 |
| `GET` | `/api/v1/workspaces/{workspaceId}/repository/tree` | Workspace 파일 tree |
| `GET` | `/api/v1/workspaces/{workspaceId}/repository/file?path=...` | 생성된 YAML·Markdown 파일 |
| `GET/POST` | `/api/v1/workspaces/{workspaceId}/sessions/{date}/members/{memberId}/reviews` | GitLab 제출 commit 리뷰 |
| `GET/POST/PATCH/DELETE` | `/api/v1/workspaces/{workspaceId}/announcements...` | 팀 공지와 읽음 상태 |
| `GET/POST/PATCH/DELETE` | `/api/v1/workspaces/{workspaceId}/messages...` | 오늘/전체 팀 메시지 |
| `GET/POST/PATCH/DELETE` | `/api/v1/workspaces/{workspaceId}/documents...` | Markdown 팀 문서 |
| `GET/POST` | `/api/v1/workspaces/{workspaceId}/repository-schema/...` | V1→V2 미리보기와 실행 |

`/connection` 응답 상태:

- `CONNECTED`: 사용자, 프로젝트, 저장소 트리 조회 성공
- `NOT_CONFIGURED`: 토큰 또는 프로젝트 환경변수 미설정
- HTTP `502`: GitLab 인증, 권한, 네트워크 또는 upstream 오류

## 검증

```bash
cd backend
./gradlew test
./gradlew build
```

기본 테스트는 실제 GitLab 토큰을 사용하지 않습니다. 로컬 가짜 HTTP 서버를 통해 토큰 헤더, URL 인코딩, 사용자·프로젝트·tree·파일 응답과 쓰기 요청 매핑을 검증합니다.

실제 GitLab 쓰기 스파이크는 명시적으로 활성화할 때만 실행됩니다.

```bash
cd backend
set -a
source .env
set +a
GITLAB_WRITE_SPIKE_ENABLED=true \
  ./gradlew test \
  --tests com.studyworkspace.gitlab.client.GitLabWriteSpikeTests \
  --rerun-tasks
```

이 테스트는 다음 안전장치를 가집니다.

- 실행 시각이 포함된 `codex-write-spike-*` 임시 브랜치만 사용
- `.study-workspace-spike/write-check.md` 경로만 사용
- 기본 브랜치에는 쓰지 않음
- 생성 → 조회 → `last_commit_id` 기반 수정 → 재조회 → 삭제 순서 검증
- 성공·실패와 무관하게 `finally`에서 임시 브랜치 삭제 시도

## 현재 패키지 구조

```text
src/main/java/com/studyworkspace/
├── common/
│   ├── api/                 # 공통 오류 응답
│   ├── config/              # CORS
│   └── exception/           # GitLab·경로 오류 변환
└── gitlab/
    ├── client/              # WebClient 기반 GitLab REST API
    ├── config/              # 환경변수와 WebClient 설정
    ├── controller/          # 프론트에 공개하는 읽기 API
    ├── dto/                 # GitLab 및 앱 응답 모델
    ├── port/                # 기능 영역이 공유할 GitLab 경계
    └── service/             # 연결 확인, ref 선택, 파일 검증·디코딩
```

## 운영 전 추가 설정

사용자, 암호화 credential과 Workspace 운영 상태는 JPA/Flyway DB에 저장하고 세션은 Spring Session JDBC로 유지합니다. 로컬 기본값은 H2 파일 DB이며 `prod` 프로필은 PostgreSQL과 HTTPS secure cookie를 요구합니다. 운영 전에는 고유한 32바이트 암호화 키를 Secret Manager에서 주입하고 [production runbook](../docs/production-runbook.md)의 callback·TLS·backup 설정을 완료해야 합니다.

## 상세 역할 문서

- [팀원 1 — 인증·Workspace](../docs/backend-role-1-auth-workspace.md)
- [팀원 2 — 일정·저장소](../docs/backend-role-2-session-repository.md)
- [팀원 3 — 제출·기록](../docs/backend-role-3-submission-analytics.md)
