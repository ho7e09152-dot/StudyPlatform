# Claude Code 읽기 전용 검증 가이드

## 사전 확인

저장소 루트에서 Claude Code 버전과 project agent를 확인한다.

```powershell
claude --version
claude agents
```

Claude Code의 `/memory`에서 루트 `CLAUDE.md`, import된 `AGENTS.md`, 작업 영역의 하위 지침이 적용됐는지 확인한다. `claude agents`에는 `test-runner`, `qa-reviewer`, `security-reviewer`가 보여야 한다.

## 실행

일반 QA:

```powershell
claude --agent qa-reviewer
```

고위험 보안 검증:

```powershell
claude --agent security-reviewer
```

테스트 중심 검증:

```powershell
claude --agent test-runner
```

Codex가 작성한 `.agents/contracts/qa-handoff.md` 형식의 내용을 prompt로 전달한다. 결과는 `.agents/contracts/qa-report.md` 형식과 `PASS`, `PASS_WITH_RISKS`, `FAIL` 중 하나여야 한다.

## 읽기 전용 확인

검증 전후 다음 명령의 결과를 비교한다.

```powershell
git status --short
git diff --stat
```

Claude agent는 `Write`, `Edit`가 금지되어 있으며 자동 format, snapshot 갱신, dependency 설치나 source 생성 명령을 실행하지 않는다. 테스트가 artifact를 생성할 수 있으면 무시 경로인지 확인하고 tracked file 변경이 생기면 결과를 신뢰하지 말고 원인을 조사한다.
