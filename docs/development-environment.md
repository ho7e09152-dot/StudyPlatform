# 초심자를 위한 로컬 개발환경 가이드

이 문서는 저장소를 처음 받은 팀원이 프론트엔드, Spring Boot, PostgreSQL, Redis를 실행하고 테스트하는 과정을 설명합니다.

## 1. 필요한 프로그램

| 도구 | 권장 버전 | 확인 명령 |
|---|---:|---|
| Git | 최신 안정 버전 | `git --version` |
| JDK | 21 | `java -version` |
| Node.js | 22 LTS | `node --version` |
| npm | Node 22 포함 버전 | `npm --version` |
| Docker Desktop | 최신 안정 버전 | `docker --version` |

GitLab API 연결을 하지 않아도 프론트 목업과 대부분의 백엔드 테스트는 실행할 수 있습니다.

## 2. 저장소 받기

```bash
git clone https://lab.ssafy.com/lhc0688/saffy_study_platform.git
cd saffy_study_platform
```

이미 저장소가 있다면:

```bash
git switch master
git pull gitlab master
```

remote 이름이 `origin`이라면 `gitlab` 대신 `origin`을 사용합니다.

```bash
git remote -v
```

## 3. 환경변수 파일 만들기

루트 Compose 설정:

```bash
cp .env.example .env
```

백엔드 설정:

```bash
cp backend/.env.example backend/.env
```

프론트 설정:

```bash
cp frontend/.env.example frontend/.env
```

`.env`는 개인 컴퓨터에서만 사용합니다. 다음 명령 결과에 `.env`가 보이면 commit하지 않습니다.

```bash
git status
```

### 환경변수 그룹

| 그룹 | 변수 | 지금 필요한 시점 |
|---|---|---|
| GitLab 읽기 | `GITLAB_BASE_URL`, `GITLAB_ACCESS_TOKEN`, `GITLAB_PROJECT_ID` | 연결 스파이크 |
| OAuth | `GITLAB_OAUTH_CLIENT_ID`, `GITLAB_OAUTH_CLIENT_SECRET` | 팀원 1 구현 |
| DB | `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` | 팀원 1 구현 |
| Redis | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` | 세션·캐시 구현 |
| Frontend | `NEXT_PUBLIC_API_BASE_URL` | 항상 |

토큰이나 client secret 값을 채팅, 화면 캡처, GitLab Issue에 올리지 않습니다.

## 4. PostgreSQL과 Redis 실행

Docker Desktop을 먼저 실행한 뒤:

```bash
docker compose up -d
```

상태 확인:

```bash
docker compose ps
```

`postgres`와 `redis`의 STATUS에 `healthy`가 보이면 준비된 상태입니다.

로그 확인:

```bash
docker compose logs postgres
docker compose logs redis
```

중지:

```bash
docker compose down
```

데이터까지 완전히 지우고 다시 시작할 때만 다음 명령을 사용합니다.

```bash
docker compose down -v
```

`-v`는 로컬 DB 데이터를 삭제하는 옵션입니다. 필요한 데이터가 없는지 확인한 뒤 사용합니다.

## 5. 프론트엔드 실행

처음 한 번 의존성을 설치합니다.

```bash
cd frontend
npm ci
```

개발 서버:

```bash
npm run dev
```

브라우저:

```text
http://localhost:3000
```

검사:

```bash
npm run lint
npm run test
```

`npm ci`는 `package-lock.json`에 고정된 버전을 설치합니다. 팀 프로젝트에서는 임의로 의존성 버전이 달라지는 것을 줄이기 위해 `npm install`보다 `npm ci`를 검증에 사용합니다.

## 6. 백엔드 실행

새 터미널을 열고:

```bash
cd backend
set -a
source .env
set +a
./gradlew bootRun
```

상태 확인:

```bash
curl http://localhost:8080/actuator/health
```

예상 응답:

```json
{"status":"UP"}
```

GitLab 연결 확인:

```bash
curl http://localhost:8080/api/v1/gitlab/connection
```

백엔드 테스트:

```bash
./gradlew test
```

특정 클래스만 실행:

```bash
./gradlew test --tests '*RepositoryPathPolicyTests'
```

## 7. 한 명령으로 검사하기

루트에서:

```bash
make check
```

순서:

1. 비밀 파일 추적 검사
2. OpenAPI 검사
3. 프론트 ESLint
4. 프론트 빌드와 라우트 테스트
5. 백엔드 테스트

개별 명령은 `make help`에서 확인합니다.

```bash
make help
```

## 8. 현재는 DB 연결이 자동으로 되지 않는 이유

Compose는 공통 인프라만 먼저 준비한 상태입니다. 아직 Spring Data JPA와 Redis Session 기능은 팀원 1의 학습 범위로 남겨두었습니다.

따라서 현재 `docker compose up -d`를 해도 기존 GitLab 연결 스파이크는 DB를 사용하지 않습니다. 팀원 1이 다음을 구현하면서 연결합니다.

```text
spring-boot-starter-data-jpa
PostgreSQL driver
Flyway
Spring Security OAuth2 Client
Spring Session Redis
```

공통 환경을 먼저 준비하고 실제 Entity·Repository·Security 설정은 담당자가 직접 구현하는 구조입니다.

## 9. 테스트 Fixture 사용법

공통 fixture 위치:

```text
backend/src/test/resources/fixtures/gitlab/
backend/src/test/resources/fixtures/repository/
```

테스트에서 읽는 예:

```java
String json = new ClassPathResource(
    "fixtures/gitlab/project.json"
).getContentAsString(StandardCharsets.UTF_8);
```

fixture를 수정할 때는 실제 token, 사용자 이메일, 비공개 URL을 넣지 않습니다.

## 10. 자주 발생하는 오류

### `Port 3000 is already in use`

기존 프론트 개발 서버가 실행 중입니다.

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
```

표시된 프로세스가 이 프로젝트의 이전 개발 서버인지 확인한 뒤 종료합니다.

### `Port 8080 is already in use`

```bash
lsof -nP -iTCP:8080 -sTCP:LISTEN
```

Spring Boot가 이미 실행 중인지 확인합니다.

### `Connection refused: localhost:5432`

```bash
docker compose ps
docker compose logs postgres
```

PostgreSQL 컨테이너가 healthy인지 확인합니다.

### GitLab `401`

- token이 만료되지 않았는지 확인합니다.
- `.env`를 수정한 뒤 백엔드를 다시 시작합니다.
- token을 로그에 출력해 확인하지 않습니다.

### GitLab `403`

- 프로젝트 멤버 권한을 확인합니다.
- 읽기만 할 때는 `read_api`, Repository Files API 쓰기에는 `api` scope가 필요합니다.
- 기본 브랜치 보호 규칙을 우회하지 않습니다.

### Gradle 실행 권한 오류

```bash
chmod +x backend/gradlew
```

### Node 실행 시 동적 라이브러리 오류

컴퓨터에 여러 Node 설치가 섞였을 수 있습니다.

```bash
which -a node
which -a npm
node --version
```

NVM을 사용한다면:

```bash
nvm use 22
```

## 11. 하루 작업 시작 체크리스트

- [ ] `git switch master`
- [ ] `git pull gitlab master`
- [ ] 내 기능 브랜치 생성
- [ ] `docker compose up -d`
- [ ] 관련 역할 문서 다시 읽기
- [ ] 구현 전 실패 테스트 한 개 작성

작업 종료 체크리스트:

- [ ] token과 `.env`가 Git에 포함되지 않았는지 확인
- [ ] 관련 테스트 실행
- [ ] `git diff --check`
- [ ] 작은 단위로 commit
- [ ] 기능 브랜치 push
- [ ] Merge Request 설명 작성
