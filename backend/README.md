# Study Workspace Backend

Spring Boot 기반 Study Workspace 백엔드입니다. 현재는 전체 도메인 구현에 앞서 SSAFY GitLab과의 네트워크·토큰·프로젝트 읽기 권한 및 임시 브랜치 쓰기 권한을 검증하는 연결 스파이크가 구현되어 있습니다.

## 현재 구현 범위

- 서버 환경변수에서만 GitLab Personal Access Token 사용
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

브라우저에 공개하는 파일 쓰기 API와 OAuth 로그인은 아직 구현하지 않았습니다. 공통 클라이언트의 쓰기 능력만 일회성 통합 테스트로 검증했으며, 실제 Session·Submission 저장 정책은 각 기능 담당자가 구현합니다.

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
FRONTEND_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
SERVER_PORT=8080
```

- 읽기 연결 검증만 할 때는 `read_api`, 수동 쓰기 스파이크를 실행할 때는 `api` scope가 필요합니다.
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
| `GET` | `/api/v1/gitlab/connection` | 사용자·프로젝트·저장소 트리 연결 확인 |
| `GET` | `/api/v1/gitlab/repository/file?path=...` | 연결 프로젝트의 텍스트 파일 조회 |

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

## 다음 구현 순서

1. ~~실제 SSAFY GitLab에서 `CONNECTED` 확인~~
2. ~~프로젝트 루트 tree와 파일 미리보기 확인~~
3. ~~격리된 테스트 브랜치에서 임시 파일 생성·수정·정리 검증~~
4. PAT 방식을 GitLab OAuth로 교체
5. Workspace DB 연결 후 프로젝트를 환경변수 대신 Workspace에서 조회
6. 역할별 Session, Submission, Records API 구현

## 상세 역할 문서

- [팀원 1 — 인증·Workspace](../docs/backend-role-1-auth-workspace.md)
- [팀원 2 — 일정·저장소](../docs/backend-role-2-session-repository.md)
- [팀원 3 — 제출·기록](../docs/backend-role-3-submission-analytics.md)
