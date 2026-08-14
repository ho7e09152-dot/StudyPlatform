# Codex 기획·구현 가이드

## Codex 앱·IDE

1. 이 저장소 루트를 workspace로 연다.
2. 루트 `AGENTS.md`와 작업 영역의 하위 `AGENTS.md`가 적용됐는지 확인한다.
3. 작업 성격에 맞는 agent를 명시한다.
   - `feature-planner`: 요구사항·영향 범위 분석
   - `backend-implementer`: Backend·API·DB·Provider 구현
   - `frontend-implementer`: Frontend·UI 구현
   - `integration-implementer`: Frontend와 Backend 종단 간 구현
4. 구현과 관련 검사를 마친다.
5. `.agents/contracts/qa-handoff.md` 형식으로 Claude QA 요청을 만든다.

요청 예시:

```text
integration-implementer를 사용해 이 기능을 구현해 주세요. OpenAPI 호환성과 Workspace 권한을 확인하고 Frontend·Backend 관련 테스트를 실행한 뒤, qa-reviewer용 인수인계를 한국어로 작성해 주세요.
```

## Codex CLI

공식 OpenAI 문서의 현재 설치 방법을 따른다. macOS/Linux standalone installer 또는 지원되는 Windows/npm 설치 경로는 [Codex CLI 공식 문서](https://learn.chatgpt.com/docs/codex/cli)에서 확인한다. 설치 후 다음 명령으로 확인한다.

```powershell
codex --version
```

현재 프로젝트 환경에는 Codex CLI가 설치되어 있지 않으므로 Codex 앱·IDE를 기본 실행 경로로 사용한다. CLI를 설치한 경우 저장소 루트에서 `codex`를 실행하고 앱·IDE와 같은 agent 이름과 프롬프트를 사용한다. CLI의 `/agent`에서 agent thread를 확인할 수 있다.

## 완료와 인수인계

실행하지 않은 테스트는 `NOT_RUN`으로 적고 이유를 남긴다. 인증·권한·credential·개인정보·migration·배포 변경은 `security-reviewer`를 포함한다. 실제 handoff와 임시 기획 메모는 commit하지 않는다.
