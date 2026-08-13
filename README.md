# Study-ing

> GitLab 저장소를 학습 기록의 원본으로 유지하면서 일정, 제출, 리뷰와 팀 진행 상황을 한곳에서 관리하는 학습 Workspace 플랫폼

![Study-ing](frontend/public/og.png)

## 무엇을 제공하나요?

- GitLab OAuth 로그인과 접근 가능한 프로젝트 기반 Workspace 생성
- Repository 권한 기반 Workspace 발견 및 명시적 참여
- 여러 학습 항목과 1·2차 마감을 포함한 일정 관리
- 링크·텍스트·코드 제출과 사용자 계정 기반 GitLab commit
- 팀원 제출 열람, review, Activity와 알림
- 학습 세션·팀 문서를 모아보는 학습 라이브러리
- 기간별 완료율, 점수와 팀 학습 기록
- Owner·Manager·Member 역할과 Repository 권한을 분리한 접근 제어

Study-ing은 GitLab을 대체하지 않습니다. 일정과 제출 원본은 연결된 Repository에 기록하고, 애플리케이션 DB에는 계정·Workspace·설정·알림과 화면 조회에 필요한 동기화 데이터를 저장합니다.

## 기술 구성

| 영역 | 기술 |
|---|---|
| Frontend | React 19, Next.js 16, Vinext/Vite, TypeScript, CSS, Playwright |
| Backend | Java 21, Spring Boot 4.1, Spring Security, Spring Data JPA, Flyway |
| Data | PostgreSQL, Spring Session JDBC, GitLab Repository |
| Integration | GitLab OAuth/API, capability-gated GitHub Connected Account linking |
| Operations | Docker Compose, Nginx, GitLab CI |

GitHub는 현재 로그인이나 Repository Provider가 아닙니다. 설정에서 계정을 연결하는 기반만 capability로 제한해 제공하며, 실제 인증 및 Repository 기능은 GitLab만 지원합니다.

## 빠른 시작

필수 버전은 Node.js 22.13 이상과 JDK 21입니다.

```bash
git clone https://github.com/ho7e09152-dot/StudyPlatform.git
cd StudyPlatform
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
docker compose up -d
```

백엔드:

```bash
cd backend
./gradlew bootRun
```

프론트엔드:

```bash
cd frontend
npm ci
npm run dev
```

- Frontend: <http://localhost:3000>
- Backend readiness: <http://localhost:8080/actuator/health/readiness>

GitLab OAuth, GitHub linking과 Production 설정은 비밀값이 필요합니다. 환경변수와 로컬 실행 절차는 [개발 환경 가이드](docs/getting-started.md)를 확인하세요.

## 검증

```bash
make check
```

개별 검사:

```bash
make api-lint
make test
make e2e
```

## 프로젝트 구조

```text
study_platform/
├── frontend/       # App Router UI, 공통 컴포넌트, API client와 E2E
├── backend/        # Spring Boot API, Provider adapter, Flyway와 테스트
├── docs/           # 현재 개발·아키텍처·운영·법무 문서
├── deploy/         # Reverse proxy 설정
├── ops/            # Backup/restore 스크립트
├── scripts/        # CI와 반복 가능한 QA 도구
└── compose*.yml    # Local, sandbox, production 구성
```

## 문서

- [문서 인덱스](docs/README.md)
- [개발 환경과 실행](docs/getting-started.md)
- [현재 아키텍처](docs/architecture/overview.md)
- [OpenAPI 계약](docs/api/openapi.yaml)
- [디자인 시스템](docs/design/design-system.md)
- [Production runbook](docs/operations/production.md)
- [기여 가이드](CONTRIBUTING.md)

현재 동작을 이해할 때는 오래된 설계 메모 대신 위 문서와 실제 코드·테스트·OpenAPI를 기준으로 판단합니다.
