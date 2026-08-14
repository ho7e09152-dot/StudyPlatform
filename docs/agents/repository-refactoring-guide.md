# YAML·Compose·CI 리팩터링 가이드

이 문서는 Study-ing 저장소의 YAML 설정과 운영 진입점을 정리할 때 다른 agent에게 전달하는 공통 작업 기준이다. 목표는 파일 수를 기계적으로 줄이는 것이 아니라, 현재 플랫폼과 맞지 않는 설정을 제거하고 Local·Sandbox·Production 실행 경로를 명확하게 만드는 것이다.

실제 작업 전에는 현재 branch, working tree, 원격 저장소와 참조 관계를 다시 확인한다. 이 문서의 기준선만으로 설정 파일을 삭제하거나 이동하지 않는다.

## 목표와 완료 조건

- GitHub 원격 저장소에서 실제로 동작하는 CI를 정본으로 사용한다.
- 기본 Local Compose는 현재 application에 필요한 infrastructure만 실행한다.
- Local·Sandbox·Production·GitHub App secret override의 실행 방법을 한 곳에서 찾을 수 있게 한다.
- Spring profile, OpenAPI 계약, 테스트 fixture처럼 도구가 관례적으로 찾는 YAML은 현재 위치에 유지한다.
- 설정 파일을 이동하거나 제거할 때 관련 문서, script, Make target과 예제 환경변수를 같은 변경에서 동기화한다.
- 전환이 완료되고 대체 경로가 검증된 뒤에만 기존 설정을 제거한다.

## 작업 전 공통 규칙

1. 루트와 변경 영역의 `AGENTS.md`를 확인한다.
2. `git status --short`, `git branch --show-current`, `git remote -v`로 작업 기준선을 기록한다.
3. 삭제·이동 전 `git grep`으로 Makefile, script, CI, README와 운영 문서의 참조를 확인한다.
4. API path·schema·field·enum·error code와 migration 순서는 구조 정리 과정에서 변경하지 않는다.
5. 환경변수 이름을 바꿀 때 Compose, application 설정, `.env.example`과 운영 문서를 함께 수정한다.
6. token, OAuth code, private key, Cookie와 실제 `.env` 내용을 출력하거나 commit하지 않는다.
7. 한 변경에는 아래 작업 ID 하나 또는 서로 강하게 결합된 작업만 포함한다.
8. 실행하지 않은 검사는 통과했다고 기록하지 않는다.

기준선 확인 명령:

```powershell
git status --short
git branch --show-current
git remote -v
git ls-files '*.yml' '*.yaml'
git grep -n -E 'compose\.(yml|prod\.yml|sandbox\.yml|github-app\.yml)|docker compose'
git grep -n -i 'redis'
```

## 현재 기준선

2026-08-14 점검 기준으로 Git이 추적하는 YAML은 12개다.

| 분류 | 파일 | 현재 판단 |
|---|---|---|
| CI | `.gitlab-ci.yml` | 현재 GitHub 원격과 불일치하므로 대체 후 제거 후보 |
| OpenAPI lint | `.redocly.yaml` | 도구의 표준 진입점이며 유지 |
| Spring | `backend/src/main/resources/application.yml` | 유지 |
| Spring Production | `backend/src/main/resources/application-prod.yml` | 유지 |
| Spring Test | `backend/src/test/resources/application.yml` | 유지 |
| Test fixture | `backend/src/test/resources/fixtures/repository/*.yml` | 유지 |
| Local Compose | `compose.yml` | 유지하되 미사용 Redis 정리 필요 |
| Production Compose | `compose.prod.yml` | 운영 script가 사용하므로 유지 |
| Sandbox Compose | `compose.sandbox.yml` | 독립된 배포 topology이므로 유지 |
| GitHub App override | `compose.github-app.yml` | private key mount 분리를 위해 유지 |
| API 계약 | `docs/api/openapi.yaml` | 정본이므로 유지 |

파일 수 자체는 과도하지 않다. 우선 해결할 문제는 다음 두 가지다.

- 원격은 GitHub인데 CI 설정과 운영 가이드는 GitLab 기준이다.
- application이 Redis를 사용하지 않지만 기본 Local Compose가 Redis를 함께 실행한다.

## 우선순위별 작업 목록

### P0 — 현재 플랫폼에 맞는 CI 정본 확립

#### CI-01 — GitLab CI를 GitHub Actions로 전환

- 담당 권장: `integration-implementer` 구현, `qa-reviewer` 검증
- 대상:
  - `.gitlab-ci.yml`
  - 신규 `.github/workflows/ci.yml`
  - `docs/operations/ci.md`
  - `README.md`, `AGENTS.md`, `CONTRIBUTING.md`의 CI 관련 문구
  - 필요 시 `.gitlab/merge_request_templates/Default.md`
- 작업:
  1. 기존 GitLab job의 명령, cache, artifact와 실패 보고 방식을 목록화한다.
  2. 아래 검사를 GitHub Actions job으로 동등하게 옮긴다.
     - OpenAPI lint
     - repository secret·hygiene 검사
     - Frontend lint, audit, test, E2E
     - Backend test
  3. pull request와 기본 branch push trigger를 명시한다.
  4. GitHub Actions에서 필요한 권한은 최소값으로 선언한다.
  5. 실제 workflow 성공을 확인한 뒤 CI 문서와 저장소 설명을 GitHub 기준으로 동기화한다.
  6. 대체 workflow가 검증된 마지막 변경에서 `.gitlab-ci.yml`을 제거한다.
- 금지:
  - GitHub Actions가 준비되기 전에 `.gitlab-ci.yml`부터 삭제하지 않는다.
  - CI 이관 과정에서 검사 범위를 조용히 축소하지 않는다.
  - 실제 secret 값을 workflow나 문서에 기록하지 않는다.
- 완료 조건:
  - pull request에서 기존 CI와 동등한 검사가 실행된다.
  - 실패 artifact와 test report를 GitHub UI에서 확인할 수 있다.
  - 문서에 GitLab Pipeline·Runner를 현재 운영 경로로 안내하는 문구가 남지 않는다.

#### CI-02 — GitHub 협업 파일 정합성 정리

- 담당 권장: Codex main agent
- 선행 조건: `CI-01`
- 작업:
  - GitLab Merge Request template이 계속 필요한지 확인한다.
  - GitHub를 유일한 협업 플랫폼으로 사용한다면 내용을 `.github/PULL_REQUEST_TEMPLATE.md`로 이관한다.
  - 이관 후 GitLab 전용 template과 중복 문서를 제거한다.
- 완료 조건:
  - 새 pull request에서 팀 checklist를 바로 사용할 수 있다.
  - 현재 사용하지 않는 플랫폼의 template이 정본처럼 보이지 않는다.

### P1 — Local Compose 최소화

#### OPS-01 — 미사용 Redis 제거 또는 profile 격리

- 담당 권장: `integration-implementer`, `qa-reviewer` 검증
- 대상:
  - `compose.yml`
  - `.env.example`
  - `Makefile`
  - `README.md`
  - `docs/getting-started.md`
- 현재 사실:
  - application session source는 Spring Session JDBC다.
  - Backend build에는 Redis application dependency가 없다.
  - Production Compose는 Redis를 실행하지 않는다.
- 기본 권장안:
  - 가까운 도입 계획이 없다면 Local Redis service, volume, `REDIS_*` 예제 변수와 관련 문구를 함께 제거한다.
- 대안:
  - 분산 rate limit 등 확정된 후속 계획이 있다면 Redis를 Compose profile로 격리하고 기본 `docker compose up`에서는 실행하지 않는다.
- 완료 조건:
  - 기본 Local Compose가 PostgreSQL 등 현재 필요한 infrastructure만 실행한다.
  - `Makefile`과 시작 문서가 실제 동작을 정확히 설명한다.
  - Redis를 유지하는 경우 활성화 명령과 사용 목적이 문서화된다.

#### OPS-02 — Compose 실행 진입점 표준화

- 담당 권장: `integration-implementer`
- 대상:
  - `Makefile`
  - `docs/getting-started.md`
  - `docs/operations/production.md`
  - `docs/architecture/providers/github-app-configuration.md`
- 작업:
  - 반복되는 Compose 명령을 목적이 드러나는 Make target으로 제공한다.
  - 최소한 Local, Sandbox, Sandbox + GitHub App key, Production config 검증 경로를 구분한다.
  - 사용자 문서에 환경별 파일 조합과 필요한 env file을 표로 정리한다.
- 권장 target 예시:

```text
make infra-up
make infra-down
make sandbox-up
make sandbox-github-up
make prod-config
make prod-up
```

- 완료 조건:
  - 사용자가 Compose 파일 조합을 외우지 않고 표준 명령으로 실행할 수 있다.
  - 문서의 명령과 Make target이 같은 Compose 파일을 참조한다.

### P2 — 설정 위치와 명명 정리

#### CFG-01 — Compose 파일은 우선 루트에 유지

현재 단계에서는 Compose 파일을 `deploy/compose/` 같은 하위 디렉터리로 이동하지 않는다.

- 근거:
  - `compose.yml`은 Docker Compose의 기본 파일명이다.
  - 상대 build context, bind mount와 env file 기준 경로가 바뀔 수 있다.
  - backup·restore script와 운영 문서가 `compose.prod.yml`을 직접 참조한다.
  - 디렉터리 이동은 외관 개선에 비해 회귀 범위가 크다.
- 재검토 조건:
  - Compose variant가 더 늘어나 루트 파일만으로 환경 관계를 설명하기 어려워진 경우
  - 배포 도구 전환으로 기존 상대경로 계약을 함께 재설계하는 경우
  - 모든 Local·Sandbox·Production 경로를 자동 검증할 수 있는 경우

#### CFG-02 — GitHub App override의 분리 유지

`compose.github-app.yml`은 private key bind mount와 container UID/GID override만 담당한다. 이를 `compose.sandbox.yml`에 무조건 합치지 않는다.

- GitHub App key가 필요하지 않은 환경은 secret mount 없이 실행되어야 한다.
- 파일명을 바꿀 경우 `.env.example`, Provider 설정 문서와 운영 명령을 같은 변경에서 수정한다.
- optional override라는 의미가 문서에서 충분히 드러나면 단순한 외관 개선을 위한 rename은 보류한다.

### P3 — 대형 YAML 분할은 보류

#### API-01 — OpenAPI modularization 판단

`docs/api/openapi.yaml`은 크지만 API 계약 정본이다. 파일 크기만으로 `$ref` 기반 다중 파일 구조로 나누지 않는다.

- 별도 작업으로 검토할 조건:
  - domain별 병렬 변경에서 충돌이 반복적으로 발생한다.
  - Redocly lint, 문서 생성과 Backend 계약 검사가 다중 파일 구조를 지원한다.
  - bundle artifact 생성과 배포 경로를 CI에서 검증할 수 있다.
- 금지:
  - 경로, `operationId`, schema, enum과 error code를 분할 과정에서 변경하지 않는다.

## 삭제·유지 판단표

| 대상 | 기본 판단 | 변경 조건 |
|---|---|---|
| `.gitlab-ci.yml` | 대체 후 제거 | GitHub Actions 동등 검사가 실제 성공함 |
| `.gitlab/merge_request_templates/Default.md` | 이관 후 제거 후보 | GitHub PR template으로 이관됨 |
| Local Redis service·volume | 제거 권장 | 현재 application 사용처와 확정된 도입 계획이 없음 |
| `REDIS_*` 예제 변수 | Redis와 함께 제거 | 다른 script·문서 사용처가 없음 |
| `.redocly.yaml` | 유지 | OpenAPI lint가 참조함 |
| Spring `application*.yml` | 유지 | Spring profile의 표준 설정 진입점임 |
| 테스트 fixture YAML | 유지 | 테스트가 읽는 입력 데이터임 |
| Compose 4종 | 루트 유지 | 역할이 서로 다르고 운영 참조가 존재함 |
| `docs/api/openapi.yaml` | 유지 | API 계약 정본임 |

## 작업 순서와 commit 경계

권장 순서는 다음과 같다.

1. `CI-01`: GitHub Actions 추가와 문서 전환
2. GitHub Actions 성공 확인 후 GitLab CI 제거
3. `CI-02`: 협업 template 정리
4. `OPS-01`: Local Redis 정리
5. `OPS-02`: Make target과 Compose 사용 문서 정리

CI 추가와 기존 CI 제거는 검증 가능한 경우 하나의 pull request에서 처리할 수 있지만, commit은 복구하기 쉽도록 분리한다. Redis 정리와 CI 이관은 서로 독립된 변경으로 유지한다.

권장 commit 예시:

```text
ci(github): add repository validation workflow
docs(ci): migrate pipeline guide to github actions
ci(gitlab): remove replaced pipeline configuration
refactor(compose): remove unused local redis service
docs(compose): document environment entrypoints
```

## 작업 단위별 검증

| 변경 | 최소 검사 |
|---|---|
| GitHub Actions | workflow 문법 검사, 각 job 실제 실행 결과 확인 |
| OpenAPI job | `make api-lint` 또는 동일한 Redocly 명령 |
| Frontend CI | `npm run lint`, `npm run test`, 관련 E2E |
| Backend CI | `gradlew.bat test` 또는 `./gradlew test` |
| Compose·Redis | 각 조합의 `docker compose ... config`, Local 시작 문서 대조 |
| Make target | target이 참조하는 Compose 명령 dry run 또는 config 확인 |
| 문서 전용 변경 | local link·명령·파일명 확인, `git diff --check` |

고위험 secret mount나 운영 배포 경로를 변경하면 [QA 인수인계 계약](../../.agents/contracts/qa-handoff.md)에 따라 `qa-reviewer`와 `security-reviewer` 검증을 요청한다. 실제 QA 결과와 임시 handoff는 commit하지 않는다.

## Agent 인수인계 예시

```text
<작업 ID>만 수행해 주세요.
현재 working tree 변경을 보존하고, 삭제 전 git grep으로 모든 참조를 확인해 주세요.
설정 파일과 함께 Makefile, script, README, 운영 문서와 .env.example의 정합성을 확인해 주세요.
가장 작은 일관된 변경으로 구현하고 이 문서의 최소 검사를 실제 실행해 주세요.
실행하지 못한 검사는 NOT_RUN과 이유를 남겨 주세요.
운영 secret·배포 경로 변경이면 qa-reviewer와 security-reviewer에게 읽기 전용 검증을 요청해 주세요.
```

## 완료 보고 형식

- 작업 ID:
- 변경·제거한 파일:
- 유지한 후보와 근거:
- 동기화한 문서·script·환경변수:
- 실행한 검사와 결과:
- 실행하지 못한 검사:
- QA status:
- 남은 위험과 후속 작업:
