# Study Workspace Backend

Spring Boot 백엔드 구현을 위한 디렉터리 골격입니다. 현재는 역할 분담과 패키지 경계만 구성했으며, Spring Initializr 빌드 파일과 실제 구현 코드는 아직 추가하지 않았습니다.

## 예정 기술

- Java
- Spring Boot
- Spring MVC
- Spring Security OAuth2 Client
- Spring Data JPA
- WebClient
- PostgreSQL
- Redis 또는 Spring Session
- Flyway
- JUnit, Testcontainers, WireMock

## 디렉터리 구조

```text
backend/
├── src/
│   ├── main/
│   │   ├── java/com/studyworkspace/
│   │   │   ├── common/
│   │   │   │   ├── api/             # 공통 응답 형식
│   │   │   │   ├── config/          # Spring 공통 설정
│   │   │   │   ├── exception/       # 공통 예외와 오류 코드
│   │   │   │   └── security/        # 현재 사용자와 인가 기반
│   │   │   ├── auth/                # GitLab OAuth와 로그인 세션
│   │   │   ├── workspace/           # 프로젝트 연결과 멤버십
│   │   │   ├── gitlab/
│   │   │   │   ├── client/          # WebClient 기반 GitLab 호출
│   │   │   │   ├── config/          # GitLab 환경변수와 설정
│   │   │   │   ├── dto/             # GitLab 요청·응답 모델
│   │   │   │   └── port/            # 공통 GitLab 인터페이스
│   │   │   ├── session/             # 일정과 session.yml
│   │   │   ├── repository/          # tree와 파일 조회
│   │   │   ├── submission/          # 개인 제출 파일 병합
│   │   │   ├── dashboard/           # 오늘의 진행률
│   │   │   └── records/             # 일별·월별 기록과 점수
│   │   └── resources/
│   │       └── db/migration/         # Flyway SQL
│   └── test/
│       ├── java/com/studyworkspace/  # 기능 영역별 테스트
│       └── resources/fixtures/
│           ├── gitlab/               # GitLab API 응답 fixture
│           └── repository/           # YAML·Markdown fixture
└── README.md
```

## 패키지 내부 기준

기능 영역은 필요에 따라 다음 하위 구조를 사용합니다.

```text
feature/
├── controller/       # HTTP 요청·응답
├── service/          # 유스케이스와 트랜잭션
├── domain/           # 핵심 모델과 정책
└── infrastructure/   # JPA, YAML, Markdown 등 외부 구현
```

모든 패키지에 동일한 하위 디렉터리를 강제하지 않습니다. 단순 조회 기능인 `repository`, `dashboard`는 필요한 구조만 사용합니다.

## 역할별 소유 영역

| 담당 | 주요 패키지 |
|---|---|
| 팀원 1 | `auth`, `workspace`, `common/security` |
| 팀원 2 | `session`, `repository`, `session/infrastructure/yaml` |
| 팀원 3 | `submission`, `dashboard`, `records` |
| 공동 | `common`, `gitlab` |

공동 `gitlab` 패키지는 첫 연결 스파이크에서 인터페이스와 오류 처리 규칙을 함께 확정합니다. 이후 기능 담당자는 GitLab HTTP 요청을 직접 중복 구현하지 않고 공통 port를 사용합니다.

## 구현 시작 시 추가할 파일

Spring Initializr로 프로젝트를 시작할 때 다음 파일을 이 디렉터리에 추가합니다.

```text
build.gradle
settings.gradle
gradlew
gradlew.bat
gradle/wrapper/
src/main/java/com/studyworkspace/StudyWorkspaceApplication.java
src/main/resources/application.yml
src/test/resources/application-test.yml
```

환경변수 원문은 Git에 포함하지 않고 `.env.example` 또는 문서에는 변수 이름만 기록합니다.

## 상세 역할 문서

- [팀원 1 — 인증·Workspace](../docs/backend-role-1-auth-workspace.md)
- [팀원 2 — 일정·저장소](../docs/backend-role-2-session-repository.md)
- [팀원 3 — 제출·기록](../docs/backend-role-3-submission-analytics.md)

