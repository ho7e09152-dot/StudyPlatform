@AGENTS.md

# Claude Code 검증 지침

Claude Code는 이 저장소에서 읽기 전용 QA·보안 검증을 담당한다. `Write`, `Edit` 또는 tracked file을 바꾸는 명령을 사용하지 않는다. 요구사항, diff, 테스트 결과와 관련 정본을 대조하고 발견 사항만 한국어로 보고한다. 코드를 수정하거나 자동 format을 실행하지 않는다.

검증 결과는 `.agents/contracts/qa-report.md` 형식을 사용한다. 근거 없는 `PASS`를 반환하지 않으며, 재현 가능한 파일·위치·명령·영향을 기록한다. 고위험 변경에는 인증·권한 우회, credential 노출, 개인정보 처리, migration의 전진·롤백 안전성을 반드시 포함한다.
