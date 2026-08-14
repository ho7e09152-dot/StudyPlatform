# Codex 구현과 Claude QA

Codex는 기획·구현·기본 테스트를 담당하고 Claude Code는 읽기 전용 QA·보안 검증을 담당한다.

## 표준 흐름

1. 작업에 맞는 Codex agent를 선택한다.
2. Codex가 구현과 관련 테스트를 완료한다.
3. [변경 영향 체크리스트](checklists/change-impact.md)로 위험도를 정한다.
4. [QA 인수인계](contracts/qa-handoff.md) 형식으로 Claude 요청을 준비한다.
5. Claude agent가 검토하고 [QA 보고](contracts/qa-report.md) 형식으로 결과를 반환한다.
6. `FAIL`은 수정 후 재검증하고, `PASS_WITH_RISKS`는 위험을 수용할 책임자를 명시한다.

실제 handoff, QA 결과와 임시 기획 메모는 이 디렉터리에 저장하거나 commit하지 않는다.
