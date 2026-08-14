# 개발 환경과 실행

## 요구사항

| 도구 | 버전 |
|---|---:|
| Node.js | 22.13 이상 |
| JDK | 21 |
| Docker + Compose | 최신 안정 버전 |
| Git | 최신 안정 버전 |

현재 CI도 Node 22와 JDK 21을 사용합니다. Node 18에서는 frontend build를 지원하지 않습니다.

## 저장소와 환경변수

```bash
git clone https://github.com/ho7e09152-dot/StudyPlatform.git
cd StudyPlatform
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

`.env`, OAuth client secret, token과 암호화 key는 commit하지 않습니다.

주요 설정:

| 영역 | 환경변수 | 용도 |
|---|---|---|
| Frontend | `NEXT_PUBLIC_API_BASE_URL` | Backend API의 공개 origin. 동일 origin 배포를 권장 |
| GitLab OAuth | `GITLAB_OAUTH_*` | 로그인, 프로젝트 연결과 Repository 작업 |
| GitHub App user authorization | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_REDIRECT_URI` | Settings의 Connected Account linking |
| GitHub App authentication | `GITHUB_APP_ID`, `GITHUB_PRIVATE_KEY_PATH` | 향후 installation/repository 인증 foundation |
| Credential | `OAUTH_TOKEN_ENCRYPTION_KEY` | Provider credential AES-GCM 암호화 |
| Database | `DATABASE_URL`, `DATABASE_USERNAME`, `DATABASE_PASSWORD` | 설정하지 않으면 로컬 H2 file DB |
| Browser | `FRONTEND_URL`, `FRONTEND_ORIGINS` | redirect와 CORS 허용 주소 |

데모는 빌드 모드가 아니다. 랜딩 또는 로그인 화면의 `데모 Workspace 둘러보기`가 `/demo`를 거쳐 현재 브라우저 탭의 `sessionStorage`에만 데모 세션을 활성화한다. 일반 보호 경로는 항상 실제 인증 세션과 API를 사용한다.

GitHub 설정과 기능 플래그는 분리됩니다. 현재 `GITHUB_ACCOUNT_LINKING_ENABLED`만 사용할 수 있으며 GitHub 로그인과 Repository Provider는 아직 capability에 노출되지 않습니다. 자세한 값과 secret mount 방식은 [GitHub App configuration](architecture/providers/github-app-configuration.md)을 따릅니다.

## 로컬 인프라

```bash
docker compose up -d
docker compose ps
```

Local Compose는 PostgreSQL과 선택적 Redis를 실행합니다. 현재 application session source는 Spring Session JDBC입니다.

중지:

```bash
docker compose down
```

`docker compose down -v`는 로컬 DB volume까지 삭제하므로 데이터가 필요 없을 때만 사용합니다.

## Backend 실행

```bash
cd backend
./gradlew bootRun
```

`bootRun`은 `backend/.env`가 있으면 유효한 key를 읽습니다. 기본 주소는 `http://localhost:8080`입니다.

```bash
curl http://localhost:8080/actuator/health/readiness
```

환경변수 없이 실행하면 H2 file DB `backend/.data/study-platform`을 사용합니다. Flyway V1~V13이 적용되며 실제 OAuth/Provider 기능은 설정 상태에 따라 비활성화됩니다.

Backend 주요 package:

```text
com.studyworkspace/
├── auth/          # OAuth, session, ProviderAccount와 account lifecycle
├── provider/      # normalized Provider identity/credential capability
├── github/        # GitHub account-link adapter
├── gitlab/        # GitLab API adapter
├── workspace/     # Workspace, discovery, membership와 repository connection
├── session/       # 일정과 repository-backed session
├── submission/    # 제출과 저장소 write
├── dashboard/     # Today dashboard 집계
├── records/       # 기간 analytics와 점수
├── repository/    # 저장 구조와 repository service
└── common,policy/ # security, errors, retention과 shared configuration
```

## Frontend 실행

```bash
cd frontend
npm ci
npm run dev
```

기본 주소는 `http://localhost:3000`입니다.

주요 디렉터리:

```text
frontend/
├── app/                   # route와 metadata
├── components/
│   ├── providers/         # session/workspace state와 API mutation
│   ├── shell/             # App Shell, navigation, provider status
│   ├── schedule/          # 일정 목록·상세·편집
│   ├── today/             # 오늘 학습과 제출
│   ├── library/           # 세션 archive와 팀 문서
│   ├── records/           # 기간 analytics
│   ├── settings/          # profile, account, repository와 member 설정
│   └── ui/                # 공통 component
├── lib/api/               # API client, DTO와 error normalization
├── lib/domain/            # UI domain과 계산/format helper
├── tests/                 # node 기반 contract/unit test
└── e2e/                   # Playwright user journey
```

Frontend는 Provider token을 브라우저 저장소나 public 환경변수로 다루지 않습니다. 인증은 HttpOnly session cookie를 사용합니다.

## 검사

전체 검사:

```bash
make check
```

개별 검사:

```bash
make api-lint
cd frontend && npm run lint && npm run test
cd backend && ./gradlew test
```

Playwright browser가 없다면 최초 한 번 설치합니다.

```bash
cd frontend
npx playwright install chromium
npm run test:e2e
```

## 자주 발생하는 문제

### Port 충돌

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
lsof -nP -iTCP:8080 -sTCP:LISTEN
```

현재 프로젝트가 실행한 process인지 확인한 뒤 종료합니다.

### PostgreSQL 연결 실패

```bash
docker compose ps
docker compose logs postgres
```

### GitLab 401/403

- 401: credential 만료, 재승인 또는 OAuth 설정을 확인합니다.
- 403: 현재 사용자의 project permission과 branch protection을 확인합니다.
- token 값을 로그에 출력해 진단하지 않습니다.

### Gradle 실행 권한

```bash
chmod +x backend/gradlew
```

## 작업 시작 체크리스트

1. `git pull --ff-only origin master`
2. 환경변수와 container 상태 확인
3. 작은 범위의 branch 생성
4. 변경 전 관련 테스트 확인
5. 변경 후 코드·OpenAPI·문서를 함께 갱신
