# Study-ing 에이전트 작업 지침

## 프로젝트와 기술 스택

Study-ing은 연결된 GitLab 또는 GitHub Repository를 학습 기록의 원본으로 사용하는 Workspace 서비스다. `frontend/`는 React 19·Next.js 16·Vinext/Vite·TypeScript, `backend/`는 Java 21·Spring Boot 4.1·Spring Security·JPA·Flyway, 운영 환경은 PostgreSQL·Docker Compose·Nginx·GitLab CI로 구성된다.

## 정본 우선순위

충돌할 때는 실행 코드와 migration 및 테스트, `docs/api/openapi.yaml`, 영역별 아키텍처 문서, 기획 문서 순으로 판단한다. 문서가 구현과 다르면 구현을 임의로 바꾸지 말고 차이를 기록한 뒤 요청 범위 안에서 동기화한다. 하위 `AGENTS.md`는 이 파일을 상속하며 해당 디렉터리의 추가 규칙만 정의한다.

## 불변조건

- API path, `operationId`, schema, field, enum, error code를 문서 번역이나 UI 편의를 위해 바꾸지 않는다.
- Workspace role과 Repository permission을 별도로 검증한다. 클라이언트의 capability 표시는 서버 권한 검사를 대신하지 않는다.
- GitLab과 GitHub의 Login, Connected Account linking과 Repository 기능은 서버 capability와 Provider 설정으로 각각 제한한다.
- 일정·제출의 원본은 Workspace에 연결된 Repository이며 DB는 계정, Workspace, 설정, 알림과 조회용 상태를 보관한다.
- optimistic locking의 `expectedRevision`·`lastCommitId`와 기존 migration 순서를 보존한다.

## 보안과 개인정보

- token, OAuth code, Authorization header, Cookie, session ID, 암호화 키, private content를 코드·문서·로그·artifact에 남기지 않는다.
- 비밀정보는 환경변수로 주입하고 `.env*`는 예제 파일을 제외하고 commit하지 않는다.
- 인증·권한·credential·개인정보·migration 변경은 고위험으로 분류한다. 최소 권한, 입력 검증, 출력 인코딩, 로그 마스킹과 실패 경로를 확인한다.
- `status: draft` 법무 문서는 승인 전 공개하지 않으며 보유 기간과 법적 상태를 추정하지 않는다.

## 구현과 검증 절차

1. 요구사항, 영향 범위, 계약과 회귀 위험을 먼저 확인한다.
2. 가장 작은 일관된 변경을 구현하고 관련 테스트를 함께 갱신한다.
3. API 변경은 OpenAPI, DB 변경은 새 Flyway migration, 사용자 동작 변경은 관련 문서를 같은 변경에서 동기화한다.
4. 영역별 검사 후 가능하면 `make api-lint`, Frontend·Backend 테스트, `git diff --check`를 실행한다.
5. 실제로 실행하지 않은 검사를 통과했다고 보고하지 않는다.

## 한국어 문서 정책

에이전트 지침, 기획서, 운영 가이드, README, 이슈·MR 템플릿, OpenAPI 설명은 한국어를 기본으로 한다. 파일명은 영문 kebab-case를 유지한다. 코드 식별자, 경로, API 계약 값, 환경변수, CLI 명령, 제품·프로토콜 고유명, frontmatter key와 status 값은 번역하지 않는다.

## 위험도와 Claude 검증

- 낮음: 문구·격리된 UI·테스트 보강. Codex 자체 검증으로 마칠 수 있다.
- 중간: API client, 여러 계층, Provider adapter, 운영 설정. `qa-reviewer` 검증을 권장한다.
- 높음: 인증·권한·credential·개인정보·migration·삭제·복구·배포. `qa-reviewer`와 `security-reviewer` 검증이 필요하다.

Codex는 기획·구현·기본 테스트를 담당한다. Claude Code는 tracked file을 수정하지 않는 읽기 전용 검증자다. 구현 후 [QA 인수인계 계약](.agents/contracts/qa-handoff.md)에 맞춰 한국어 handoff를 작성하고, Claude 결과는 [QA 보고 계약](.agents/contracts/qa-report.md)의 `PASS`, `PASS_WITH_RISKS`, `FAIL` 중 하나로 받는다. 실제 QA 결과나 임시 메모는 commit하지 않는다.
