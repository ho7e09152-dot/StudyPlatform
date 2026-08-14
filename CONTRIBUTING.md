# Study-ing 기여 가이드

## 시작하기

Codex로 구현하고 Claude Code로 검증하는 작업은 [에이전트 사용 가이드](docs/agents/README.md)와 루트 `AGENTS.md`를 먼저 확인합니다.

작업 전에 [개발 환경](docs/getting-started.md), [현재 아키텍처](docs/architecture/overview.md)와 변경 영역의 문서를 읽습니다. API가 바뀌면 [OpenAPI](docs/api/openapi.yaml), UI foundation이 바뀌면 [디자인 시스템](docs/design/design-system.md)을 함께 수정합니다.

## 브랜치와 Commit

> 2인 협업과 AI 에이전트 병행 작업의 실전 절차(동시 작업 충돌 예방, 커밋 전 체크리스트 등)는 [Git 협업 가이드](docs/collaboration/git-workflow.md)를 참고합니다.

```bash
git switch master
git pull origin master
git switch -c fix/short-description
```

브랜치는 `feat/`, `fix/`, `test/`, `docs/`, `refactor/`, `chore/` 중 목적에 맞는 prefix를 사용합니다. Commit은 다음 형식을 권장합니다.

```text
type(scope): concise summary
```

한 변경은 하나의 목적에 집중하고, 기존의 관련 없는 로컬 변경을 덮어쓰거나 함께 정리하지 않습니다.

## 구현 원칙

- 기능은 Controller부터 domain, persistence/Provider adapter와 테스트까지 하나의 흐름으로 검토합니다.
- 외부 Provider 응답을 UI나 공통 domain까지 직접 노출하지 않습니다.
- Workspace role과 Repository permission을 별도로 검증합니다.
- token, Authorization header, Cookie와 private content를 로그에 남기지 않습니다.
- 오래된 revision이나 commit을 자동으로 덮어쓰지 않습니다.
- 사용자-facing 변경은 desktop, mobile, light, dark와 keyboard 접근성을 확인합니다.

## 검사

Push 전 가능한 범위에서 다음을 실행합니다.

```bash
make check
```

영역별 최소 검사:

```bash
cd frontend
npm run lint
npm run test
```

```bash
cd backend
./gradlew test
```

```bash
make api-lint
```

UI 변경은 관련 Playwright E2E를 실행하고 console error와 horizontal overflow를 확인합니다. 생성된 report, screenshot과 video는 CI artifact 또는 로컬 `artifacts/`에 두며 commit하지 않습니다.

## Pull Request

PR에는 다음을 적습니다.

- 변경 이유와 사용자 영향
- 중요한 설계·보안 판단
- 실행한 검사와 결과
- API 또는 migration 호환성
- UI 변경이라면 대표 화면

리뷰 우선순위는 데이터 손실·보안, 권한, domain/API 계약, regression test, 가독성 순입니다.

## 완료 기준

- [ ] 정상 흐름과 실패/권한 흐름을 검증했다.
- [ ] OpenAPI와 migration 호환성을 확인했다.
- [ ] 민감정보가 응답·로그·artifact에 포함되지 않는다.
- [ ] 관련 문서를 현재 동작에 맞게 갱신했다.
- [ ] `git diff --check`가 통과한다.
