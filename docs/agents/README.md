# 에이전트 사용 가이드

이 문서는 Study-ing에서 Codex 구현과 Claude Code 검증을 함께 사용하는 진입점이다.

- [Codex 기획·구현 가이드](codex-implementation.md)
- [Claude Code 읽기 전용 검증 가이드](claude-validation.md)
- [저장소 구조·에이전트 지침 리팩터링 가이드](repository-refactoring-guide.md)
- [공통 체크리스트와 계약](../../.agents/README.md)

## 역할 경계

Codex는 요구사항 분석, 코드·문서 구현과 기본 테스트를 담당한다. Claude Code는 구현 diff와 테스트 근거를 읽기 전용으로 검증한다. Claude 검증 결과는 구현을 대신하지 않으며, `FAIL` 또는 미해결 고위험 사항이 있으면 Codex가 수정한 뒤 다시 검증한다.

모든 요청과 보고는 한국어로 작성하되 코드 식별자, 경로, API 계약 값, 환경변수와 CLI 명령은 원문을 유지한다.
