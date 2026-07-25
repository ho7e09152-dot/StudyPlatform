# Study Workspace

> GitLab 저장소를 학습 기록의 원본으로 유지하면서, 팀원의 진행 상황과 일정·제출·기록을 웹에서 편하게 관리하는 스터디 플랫폼

![Study Workspace 학습 기록 화면](frontend/public/og.png)

## 프로젝트를 시작한 배경

SSAFY 입과 후 교육을 받으며 팀원들과 알고리즘 스터디를 시작했습니다. 우리 팀은 각자 블로그에 풀이 코드와 리뷰를 작성하고, 별도의 GitLab 프로젝트에도 날짜별 디렉터리를 만든 뒤 개인 파일을 하나씩 올리기로 했습니다.

처음에는 이미 블로그에 정리한 링크를 GitLab에 날짜별로 다시 모아야 하는 이유가 궁금했습니다. 팀장은 이 구조가 팀원별 학습 여부를 확인하고 스터디 진행 상황을 함께 관리하기 편하기 때문이라고 설명했습니다.

그 설명을 들으며 GitLab에 기록을 남기는 방식 자체는 유용하지만, 매번 날짜 디렉터리와 각자의 파일을 직접 열어보는 과정은 웹서비스로 더 편하게 만들 수 있겠다고 생각했습니다. 여기서 다음 아이디어가 출발했습니다.

- GitLab에 쌓인 학습 기록을 한눈에 보여주는 대시보드
- 팀원별 제출 여부와 진행률 비교
- 날짜별 학습 일정과 여러 학습 항목 관리
- 1차·2차 마감과 제출 시각을 활용한 점수 및 순위
- Git에 익숙하지 않아도 웹에서 제출하고 자신의 계정으로 커밋하는 기능
- 알고리즘뿐 아니라 영어, CS, 자유주제 스터디에도 적용할 수 있는 공통 구조

Study Workspace는 GitLab을 대체하는 서비스가 아닙니다. GitLab 저장소를 원본으로 유지하고, 사용자가 저장소의 내용을 더 쉽게 읽고 수정할 수 있는 인터페이스를 제공하는 것이 목표입니다.

## 해결하려는 문제

기존 스터디 방식에는 다음과 같은 불편이 있었습니다.

- 날짜별 디렉터리와 멤버 파일을 하나씩 열어야 전체 진행 상황을 알 수 있습니다.
- 하루에 여러 항목을 공부하면 단순 제출 여부만으로는 부분 진행 상태를 표현하기 어렵습니다.
- 문제나 과제가 변경되면 기존 제출과 현재 학습 기준이 어긋날 수 있습니다.
- 블로그 링크를 다시 GitLab 파일에 정리하고 직접 커밋해야 합니다.
- Git 사용이 익숙하지 않은 팀원에게는 반복적인 커밋과 푸시가 부담이 될 수 있습니다.
- 1차·2차 마감이 있어도 최종 제출 여부 외에는 참여 시점을 비교하기 어렵습니다.

Study Workspace는 이 과정을 `일정 생성 → 항목별 제출 → GitLab 커밋 → 진행률·점수 집계` 흐름으로 연결합니다.

## 핵심 설계 원칙

### GitLab 저장소가 원본입니다

`session.yml`, 멤버별 Markdown, 제출 코드와 커밋 이력은 GitLab에 저장합니다. 애플리케이션 DB에는 사용자, OAuth 토큰, Workspace 연결과 같은 서비스 운영 데이터만 저장합니다.

### Workspace 하나는 GitLab 프로젝트 하나와 연결됩니다

프론트엔드는 임의의 GitLab 프로젝트 ID나 파일 경로를 직접 조합하지 않습니다. Spring 백엔드가 Workspace에 연결된 프로젝트와 허용된 파일 경로를 확인한 뒤 GitLab API를 호출합니다.

### 모든 활성 멤버는 동등한 앱 권한을 가집니다

별도의 팀장 역할을 두지 않고 모든 활성 멤버가 일정과 Workspace를 함께 관리합니다. 실제 파일 읽기·쓰기는 각 사용자의 GitLab 권한과 브랜치 보호 규칙을 따릅니다.

### 충돌이 발생하면 덮어쓰지 않습니다

일정은 `revision`, GitLab 파일은 `last_commit_id`를 기준으로 최신 상태를 확인합니다. 같은 제출이나 일정이 동시에 변경되면 자동으로 덮어쓰지 않고 충돌로 처리합니다.

## 현재 구현된 기능

현재는 프론트엔드 UI와 도메인 동작을 검증하고, Spring Boot를 통한 GitLab 읽기 및 격리 브랜치 쓰기 연결 스파이크까지 구현한 단계입니다. 일정·제출·기록 데이터는 아직 메모리 기반 목업이지만 저장소 화면은 백엔드 연결 성공 시 실제 GitLab 프로젝트와 파일을 표시합니다.

| 화면 | 구현 내용 |
|---|---|
| 오늘 | 오늘의 학습 항목, 팀 진행률, 개인 진행률, 멤버 현황, 저장소 미리보기 |
| 일정 | 일정 검색·필터, 일정 생성·수정, 여러 학습 항목, 1차·2차 마감, revision 표시 |
| 제출 | 항목별 링크·텍스트·코드 제출, 커밋 메시지, GitLab 반영 대상 미리보기 |
| 기록 | 일별·월별 전환, 날짜·월 이동, 달력, 주간 제출률, 멤버별 평균 |
| 점수 | 1차 제출 10P, 2차 제출 6P, 개인 점수 카드, 카드 클릭형 멤버 순위 모달 |
| 저장소 | 날짜 폴더 탐색, 파일 검색, 폴더 접기, YAML 원문·GFM Markdown 미리보기, 커밋 정보 |
| 설정 | 프로젝트 연결 정보, 멤버와 GitLab 권한, 알림, 보안 원칙 |
| 반응형 UI | 데스크톱·태블릿·모바일 레이아웃과 모바일 전체 화면 모달 |
| GitLab 연결 스파이크 | 사용자·프로젝트·tree·파일 조회, 임시 브랜치 파일 생성·수정·삭제와 정리 검증 |

## 개발 과정

현재까지의 기획과 프론트엔드는 다음 흐름으로 발전했습니다.

1. SSAFY 알고리즘 스터디 경험에서 문제와 아이디어를 정의했습니다.
2. 사용 흐름, GitLab 저장 구조, 일정·제출·진행률 정책을 구체화했습니다.
3. Claude Design을 활용해 초기 프론트 디자인을 구성했습니다.
4. Codex CLI를 활용해 페이지 구조, 반응형 UI, 모달, 필터, 기록·점수 기능과 세부 상호작용을 보완했습니다.
5. 데스크톱과 모바일 화면을 실제 브라우저에서 반복 검증했습니다.
6. Spring Boot 공통 GitLab 클라이언트와 읽기 API를 구현했습니다.
7. 기본 브랜치와 분리된 일회성 브랜치에서 파일 생성·수정·삭제를 실제 GitLab로 검증했습니다.

AI 도구는 디자인과 구현을 구체화하는 협업 도구로 사용했습니다. 실제 스터디 경험을 바탕으로 한 문제 정의, 기능 선택, 정책 결정과 최종 검증은 프로젝트 요구사항에 맞춰 지속적으로 조정하고 있습니다.

## 기술 구성

### 현재 프론트엔드

- React 19
- Next.js 16
- TypeScript
- Vinext / Vite
- CSS
- Lucide React

### 백엔드

- Java
- Spring Boot
- Spring MVC
- Spring Security OAuth2 Client
- Spring Data JPA
- WebClient
- PostgreSQL
- Redis 또는 Spring Session
- GitLab REST API
- JUnit, Testcontainers, WireMock

## 예정 아키텍처

![Study Workspace 예정 서비스 아키텍처](docs/images/study-workspace-architecture.png)

> 편집 가능한 원본: [study-workspace-architecture.svg](docs/images/study-workspace-architecture.svg)

브라우저에는 GitLab 토큰을 저장하지 않습니다. Spring 백엔드가 암호화된 사용자 OAuth 토큰으로 Workspace에 연결된 프로젝트만 호출합니다.

## 백엔드 구현 전 GitLab 연결 검증

전체 백엔드를 만들기 전에 다음 최소 흐름부터 확인합니다.

```text
프론트
→ Spring Boot
→ GitLab 사용자 확인
→ 테스트 프로젝트 접근 확인
→ 기본 브랜치와 repository tree 조회
→ 파일 조회
→ 테스트 브랜치에 임시 파일 커밋
```

초기 읽기 연결에서는 `read_api`, 쓰기 스파이크에서는 `api` scope의 서버 환경변수 Personal Access Token을 사용합니다. 네트워크와 프로젝트 권한 검증이 끝나면 정식 OAuth 방식으로 교체할 예정입니다. 토큰은 프론트엔드 코드나 Git 저장소에 포함하지 않습니다.

## 백엔드 역할 분담

백엔드는 계층별로 나누지 않고, 각 팀원이 하나의 기능 영역을 Controller부터 GitLab 연동과 테스트까지 끝까지 구현하는 방식으로 진행합니다.

| 담당 | 영역 | 주요 책임 | 상세 문서 |
|---|---|---|---|
| 팀원 1 | 인증·Workspace | GitLab OAuth, 사용자·토큰, 프로젝트 연결, Workspace와 멤버 | [팀원 1 역할 문서](docs/backend-role-1-auth-workspace.md) |
| 팀원 2 | 일정·저장소 | Session CRUD, `session.yml`, 1·2차 마감, revision, tree·파일 조회 | [팀원 2 역할 문서](docs/backend-role-2-session-repository.md) |
| 팀원 3 | 제출·기록 | 개인 제출 병합, 커밋, 완료율, 일별·월별 기록, 점수·순위 | [팀원 3 역할 문서](docs/backend-role-3-submission-analytics.md) |

세 영역이 공통으로 사용하는 GitLab HTTP 통신은 `GitLabRepositoryPort`와 하나의 클라이언트 구현으로 통합합니다. 각 기능에서 WebClient 호출을 중복 구현하지 않습니다.

## 추천 개발 순서

### 1단계 — 프론트엔드와 도메인 검증

- 주요 페이지와 반응형 UI 구현
- 일정·제출·기록·점수 정책 검증
- 메모리 목업을 이용한 전체 사용자 흐름 확인

### 2단계 — GitLab 연결 스파이크

- 테스트 GitLab 프로젝트 준비
- Spring Boot에서 사용자·프로젝트·브랜치 조회
- repository tree와 파일 조회
- 테스트 브랜치 파일 생성·수정
- 공통 GitLab 클라이언트와 오류 형식 확정

### 3단계 — 역할별 백엔드 구현

- 팀원별 기능 영역을 독립적으로 구현
- OpenAPI 명세와 테스트를 기능 단위로 작성
- 기능 담당자가 아닌 팀원이 Pull Request 리뷰

### 4단계 — 프론트엔드 통합

- `WorkspaceProvider`의 메모리 액션을 실제 API 호출로 교체
- 로딩·빈 상태·권한 오류·GitLab 장애·충돌 UI 연결
- 실제 커밋 결과와 진행률·점수 재계산 확인

### 5단계 — 운영 준비

- OAuth token refresh
- 보호 브랜치 및 권한 테스트
- 로그에서 토큰과 민감정보 마스킹
- 캐시 무효화와 GitLab API 요청 제한 대응
- 배포 환경 구성과 E2E 테스트

## 프로젝트 구조

```text
study_platform/
├── frontend/                              # 현재 구현된 프론트엔드
│   └── lib/api/                           # Spring API 연동 계층
├── backend/                               # Spring Boot 패키지 골격
│   └── src/
│       ├── main/java/com/studyworkspace/  # 기능별 백엔드 패키지
│       ├── main/resources/db/migration/   # Flyway 마이그레이션
│       └── test/                          # 기능별 테스트와 fixture
├── docs/                                  # 역할 분담과 개발 문서
├── output/playwright/                     # 브라우저 UI 검증 결과
├── README.md                              # 프로젝트 소개
└── STUDY_WORKSPACE_BACKEND_API_GITLAB.md  # 백엔드·API·GitLab 상세 설계
```

`backend/`에는 Spring Boot 실행 구조와 GitLab 읽기 연결 스파이크가 구현되어 있습니다. 실제 토큰과 프로젝트는 Git에 넣지 않고 로컬 환경변수로 설정합니다.

## 프론트엔드 실행

Node.js 22.13 이상이 필요합니다.

```bash
cd frontend
npm install
npm run dev
```

기본 개발 주소:

```text
http://localhost:3000
```

## 백엔드 실행

실제 GitLab 연결 값은 [백엔드 실행 문서](backend/README.md)를 참고해 `backend/.env`에 입력합니다.

```bash
cd backend
cp .env.example .env
# .env에 GitLab 주소, read_api 토큰, 프로젝트 ID 입력
set -a
source .env
set +a
./gradlew bootRun
```

기본 API 주소는 `http://localhost:8080`입니다. 환경변수가 없으면 서버는 실행되지만 GitLab 연결 상태는 `NOT_CONFIGURED`로 표시됩니다.

검증:

```bash
cd frontend
npm run build
npm run lint
npm test
```

## 관련 문서

- [백엔드·API·GitLab 전체 설계서](STUDY_WORKSPACE_BACKEND_API_GITLAB.md)
- [OpenAPI 실행 계약](docs/openapi.yaml)
- [API 공통 오류 계약](docs/api-error-catalog.md)
- [GitLab CI 사용 가이드](docs/ci-guide.md)
- [로컬 개발환경 가이드](docs/development-environment.md)
- [협업 및 Merge Request 가이드](CONTRIBUTING.md)
- [Spring 백엔드 디렉터리 구조](backend/README.md)
- [프론트엔드 실행 및 구조](frontend/README.md)
- [프론트 API 연동 구조](frontend/lib/api/README.md)
- [팀원 1 — 인증·Workspace](docs/backend-role-1-auth-workspace.md)
- [팀원 2 — 일정·저장소](docs/backend-role-2-session-repository.md)
- [팀원 3 — 제출·기록](docs/backend-role-3-submission-analytics.md)

## 프로젝트 목표

이 프로젝트의 목표는 완성된 기능을 빠르게 조립하는 것만이 아닙니다. 실제 스터디에서 경험한 문제를 서비스 요구사항으로 정리하고, 팀원 각자가 Spring 백엔드의 설계·구현·GitLab 연동·테스트를 직접 경험하는 것을 중요하게 생각합니다.

최종적으로는 GitLab의 투명한 기록과 웹서비스의 편리한 사용성을 함께 제공하는 학습 관리 플랫폼을 만드는 것을 목표로 합니다.
