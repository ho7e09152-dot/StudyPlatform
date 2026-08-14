# 저장소 구조·에이전트 지침 리팩터링 가이드

이 문서는 Study-ing 저장소 구조와 AI agent 지침을 정리할 때 다른 agent에게 전달할 공통 작업 기준이다. 일회성 작업 계획이나 QA 결과가 아니므로 `docs/agents/`에서 관리한다. 실제 작업 전에는 현재 working tree와 참조 관계를 다시 확인하며, 이 문서의 수치만 근거로 파일을 삭제하지 않는다.

## 목표와 완료 조건

- 사용 중인 코드·설정·운영 도구는 보존하고, 불필요하거나 오해를 만드는 placeholder만 제거한다.
- Codex와 Claude Code가 중복 없이 같은 프로젝트 불변조건을 적용한다.
- 읽기 전용 QA 역할은 문구뿐 아니라 가능한 범위에서 tool permission과 검증 절차로 보호한다.
- 위험도, 요청 agent, QA 결과와 위험 수용 책임이 하나의 계약으로 연결된다.
- 변경 후 관련 Frontend·Backend·문서·운영 검사를 실제로 실행하고 결과를 보고한다.

## 작업 전 공통 규칙

1. 루트와 변경 영역의 `AGENTS.md`를 먼저 확인한다.
2. `git status --short`로 기존 변경을 기록하고 다른 사람의 변경을 덮어쓰지 않는다.
3. 삭제 전 `git grep`, build 설정, Compose, CI, Makefile과 운영 문서에서 참조를 확인한다.
4. 자동 생성물과 Git 추적 파일을 구분한다. `node_modules/`, `dist/`, `.wrangler/`, `build/`는 로컬 존재만으로 삭제 대상 코드로 판단하지 않는다.
5. 한 작업에서는 아래 작업 ID 하나 또는 서로 강하게 결합된 작업만 처리한다.
6. migration 번호, API path·field·enum·error code와 optimistic locking 필드는 구조 정리 과정에서 바꾸지 않는다.
7. 삭제는 명시적인 파일 목록으로 수행하고, 재귀 wildcard 삭제는 사용하지 않는다.

## 현재 기준선

2026-08-14 점검 기준이며 작업 시작 시 다시 측정한다.

- Backend 아래 `.gitkeep`: 43개
  - 같은 디렉터리에 실제 파일이 있어 불필요한 항목: 17개
  - 빈 패키지를 유지하는 placeholder: 26개
- main과 test가 모두 비어 있는 Backend 영역: `dashboard`, `records`, `repository`, `session`, `submission`
- 프로젝트 명령·문서에서 참조되지 않은 수동 QA script 후보: 3개
- application에서 사용하지 않고 Local Compose에서 선택적으로 실행되는 Redis service: 1개
- Agent 관련 파일은 현재 working tree에서 untracked 상태이므로 공유 전 추적 여부를 별도로 확인해야 한다.

기준선 확인 명령:

```powershell
git status --short
git ls-files 'backend/src/**/.gitkeep'
git grep -n -e 'qa-login-routing.mjs' -e 'qa-public-pages-interactions.mjs' -e 'qa-records-responsive.mjs'
git grep -n -e 'REDIS_' -e 'redis:'
```

## 우선순위별 작업 목록

### P0 — Agent 지침의 적용 가능성

#### AGT-01 — Agent 파일 공유 상태 확정

- 담당 권장: Codex main agent
- 대상: `AGENTS.md`, `CLAUDE.md`, 하위 지침, `.agents/`, `.claude/`, `.codex/`, `docs/agents/`
- 작업:
  - 각 파일이 팀 공통 설정인지 로컬 전용인지 분류한다.
  - 팀 공통 파일만 Git 추적 대상으로 제안한다.
  - 실제 handoff, QA 결과, 임시 계획은 `.agents/`에 저장하거나 commit하지 않는다.
- 완료 조건:
  - 팀 공통 지침이 새 checkout에서도 발견된다.
  - 비밀정보와 개인 환경 경로가 포함되지 않는다.

#### AGT-02 — Claude Code 실행 가이드 수정

- 담당 권장: Codex main agent
- 대상: `docs/agents/claude-validation.md`
- 작업:
  - custom agent 목록 확인 용도로 적힌 `claude agents` 안내를 제거한다. 해당 명령은 설치 버전에 따라 background agent 관리 명령이다.
  - `claude --version`, `/context`, `claude --agent <name>` 등 현재 설치 버전에서 검증한 절차만 남긴다.
  - 특정 버전 동작을 영구 사실처럼 단정하지 않는다.
- 완료 조건:
  - 문서의 모든 명령이 `claude --help` 결과와 일치한다.

#### AGT-03 — 하위 Claude 지침 중복 제거

- 담당 권장: Codex main agent
- 대상: `backend/CLAUDE.md`, `frontend/CLAUDE.md`, `docs/CLAUDE.md`, `deploy/CLAUDE.md`, `ops/CLAUDE.md`
- 작업:
  - Claude Code가 상위 `CLAUDE.md`를 계층적으로 읽는 것을 전제로 `@../CLAUDE.md` 중복 import를 제거한다.
  - Claude Code가 직접 읽지 않는 영역별 `AGENTS.md` import와 영역 고유 검토 항목은 유지한다.
- 완료 조건:
  - 루트 불변조건이 한 번만 주입된다.
  - 각 영역의 추가 검토 항목은 유지된다.

#### AGT-04 — 읽기 전용 QA의 강제 경계 보강

- 담당 권장: Codex main agent 구현, `security-reviewer` 검증
- 대상: `.claude/agents/*.md`, 필요 시 project Claude settings 또는 hook
- 작업:
  - `Write`, `Edit` 금지만으로는 `Bash` 쓰기를 막지 못한다는 점을 반영한다.
  - `qa-reviewer`와 `security-reviewer`에는 필요한 최소 tool만 허용한다.
  - `test-runner`는 build artifact 생성이 가능하므로 역할을 “tracked source 불변 검증”으로 정의한다.
  - 모든 QA agent가 실행 전후 `git status --short`를 비교하고 working tree 변경을 보고하게 한다.
- 금지:
  - 검토 편의를 이유로 permission bypass를 기본값으로 설정하지 않는다.
  - test, formatter 또는 dependency 설치가 tracked file을 바꾼 상태에서 `PASS`를 반환하지 않는다.
- 완료 조건:
  - 지침과 실제 tool permission의 차이가 문서화된다.
  - 수정 agent와 검증 agent의 책임이 분리된다.

#### AGT-05 — QA 계약 일관성 보완

- 담당 권장: Codex main agent 구현, `qa-reviewer` 검증
- 대상: `.agents/checklists/change-impact.md`, `.agents/contracts/qa-handoff.md`, `.agents/contracts/qa-report.md`
- 작업:
  - 고위험 변경에서 `qa-reviewer`, `security-reviewer`를 함께 요청할 수 있도록 복수 agent 필드를 지원한다.
  - 낮은 위험은 Claude 검증 없이 종료할 수 있다는 루트 정책과 checklist 문구를 맞춘다.
  - `PASS_WITH_RISKS`에 위험 수용 책임자, 수용 근거, 재검토 조건 또는 기한을 추가한다.
- 완료 조건:
  - 낮음·중간·높음 위험도 각각에 모순 없는 handoff 예시를 만들 수 있다.

### P1 — 저장소 구조 정리

#### STR-01 — 불필요한 `.gitkeep` 제거

- 담당 권장: `backend-implementer`
- 즉시 제거 가능 조건:
  - `.gitkeep`과 같은 디렉터리에 이미 Git 추적 파일이 존재한다.
- 별도 판단 필요 조건:
  - `.gitkeep`이 유일한 파일이며 디렉터리가 미래 설계만 표현한다.
- 작업:
  - 실제 파일이 있는 디렉터리의 불필요한 `.gitkeep`부터 작은 변경으로 제거한다.
  - `dashboard`, `records`, `repository`, `session`, `submission` 빈 패키지는 현재 구현 위치와 문서를 확인한 후 별도 변경으로 다룬다.
- 완료 조건:
  - Java package tree가 실제 package 선언과 일치한다.
  - Backend compile과 test 결과가 정리 전후 동일하다.

#### STR-02 — 빈 Backend 도메인 패키지 결정

- 담당 권장: `feature-planner` 분석 후 `backend-implementer` 구현
- 선택지:
  1. 가까운 시일 내 구현 계획과 담당자가 있으면 유지 근거를 문서화한다.
  2. 실제 기능이 `workspace` 등 다른 package에 구현됐다면 빈 package와 관련 `.gitkeep`을 제거한다.
  3. package 경계 자체가 잘못됐다면 이번 정리와 분리해 별도 refactoring으로 계획한다.
- 금지:
  - 빈 디렉터리를 채우기 위해 기존 클래스를 기계적으로 이동하지 않는다.
  - package 이동과 API·DB 동작 변경을 한 변경에 섞지 않는다.

#### QA-01 — 수동 QA script 통합 또는 제거

- 담당 권장: `frontend-implementer`, `test-runner` 검증
- 대상:
  - `scripts/qa-login-routing.mjs`
  - `scripts/qa-public-pages-interactions.mjs`
  - `scripts/qa-records-responsive.mjs`
- 작업:
  - 유지 가치가 있는 assertion은 `frontend/e2e/`의 Playwright test로 이동한다.
  - `/home/roro/...`와 같은 개인 `executablePath` 기본값을 제거한다.
  - 실제 sandbox URL을 기본값으로 호출하지 않고 명시적인 환경변수를 요구한다.
  - 통합 후 원본 script가 완전히 대체됐을 때만 삭제한다.
- 완료 조건:
  - CI 또는 `package.json`에서 재현 가능한 명령으로 실행된다.
  - screenshot과 결과 파일은 ignored artifact 경로에만 생성된다.

#### OPS-01 — Redis 기본 실행 여부 결정

- 담당 권장: `integration-implementer`, `qa-reviewer` 검증
- 대상: `compose.yml`, `.env.example`, `Makefile`, `docs/getting-started.md`
- 현재 사실:
  - application session source는 Spring Session JDBC다.
  - 현재 Backend build에는 Redis application dependency가 없다.
- 선택지:
  1. 사용 계획이 없으면 Redis service와 관련 변수·문구를 함께 제거한다.
  2. 분산 rate limit 계획 때문에 보존한다면 Compose profile로 격리한다.
- 완료 조건:
  - 기본 `docker compose up`이 필요한 infrastructure만 실행한다.
  - Makefile과 시작 문서가 실제 Compose 동작과 일치한다.

### P2 — 문서와 낮은 위험 설정 정리

#### DOC-01 — 환경 의존 문구 제거

- 담당 권장: Codex main agent
- 대상: `docs/agents/codex-implementation.md`
- 작업:
  - “현재 환경에는 Codex CLI가 설치되어 있지 않다” 같은 개인 환경 사실을 조건형 안내로 바꾼다.
  - 설치 여부와 버전은 사용자가 실행 시 확인하게 한다.

#### DOC-02 — 한국어 문서 정책 준수

- 담당 권장: Codex main agent, `qa-reviewer` 검증
- 대상: 특히 `docs/operations/production.md`의 영문 설명
- 작업:
  - 설명 문장은 한국어로 동기화한다.
  - 환경변수, CLI, API path, protocol 이름과 계약 값은 번역하지 않는다.

#### CFG-01 — 빈 `next.config.ts` 유지 여부

- 담당 권장: `frontend-implementer`
- 작업:
  - Next.js·Vinext build가 파일을 암묵적으로 소비하는지 현재 버전에서 확인한다.
  - 제거 전 `npm run build`, `npm run test`, 관련 E2E를 비교한다.
- 판단:
  - 빈 파일이라는 이유만으로 즉시 제거하지 않는다.

## 삭제 판단표

| 대상 | 기본 판단 | 삭제 조건 |
|---|---|---|
| 실제 파일과 같은 디렉터리의 `.gitkeep` | 제거 권장 | Git 추적 payload가 존재함 |
| 빈 Backend package placeholder | 조건부 제거 | 확정된 구현 계획·참조·생성 규칙이 없음 |
| `scripts/qa-*.mjs` 3개 | 통합 후 제거 | Playwright 또는 다른 반복 가능한 검사로 완전히 대체됨 |
| Local Redis service | 조건부 제거 또는 profile 격리 | 현재 application dependency와 운영 사용처가 없음 |
| `frontend/next.config.ts` | 보류 | build와 Vinext 동작에 영향이 없음을 검증함 |
| `deploy/`, `ops/`, `.openai/`, `worker/` | 유지 | 현재 Compose·문서·Vite 구성에서 참조됨 |
| ignored build directory | Git 대상 아님 | 필요하면 로컬에서만 안전하게 정리 |

## 작업 단위별 검증

| 변경 | 최소 검사 |
|---|---|
| Agent Markdown/TOML | local link 확인, 현재 CLI help 대조, `git diff --check` |
| Backend `.gitkeep`·package | `gradlew.bat test` 또는 `./gradlew test` |
| Frontend QA 통합 | `npm run lint`, `npm run test`, 관련 `npm run test:e2e` |
| Compose·Redis | `docker compose config`, 시작 문서 대조 |
| 운영·보안 지침 | `qa-reviewer`, 고위험이면 `security-reviewer` |

실행하지 못한 검사는 성공으로 기록하지 않고 `NOT_RUN`과 이유를 남긴다.

## Agent 인수인계 예시

```text
feature-planner를 사용해 <작업 ID>의 실제 참조와 영향 범위를 분석해 주세요.
기존 working tree 변경을 보존하고 삭제 후보를 사용 중·미사용·판단 보류로 분류해 주세요.
분석 후 담당 implementer가 가장 작은 변경으로 구현하고 관련 검사를 실행해 주세요.
중간 이상 위험이면 .agents/contracts/qa-handoff.md 형식으로 qa-reviewer에게 전달하고,
인증·권한·credential·개인정보·migration·삭제·복구·배포가 포함되면 security-reviewer도 요청해 주세요.
```

## 완료 보고 형식

- 작업 ID:
- 변경 또는 제거한 파일:
- 유지한 후보와 근거:
- 실행한 검사와 결과:
- 실행하지 못한 검사:
- QA status:
- 남은 위험과 후속 작업:
