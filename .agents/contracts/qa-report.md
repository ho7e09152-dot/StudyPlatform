# QA 보고 계약

Claude Code는 tracked file을 수정하지 않고 아래 양식으로 한국어 결과를 반환한다. `status` 값은 `PASS`, `PASS_WITH_RISKS`, `FAIL`만 사용한다.

```markdown
# QA 보고

- status: <PASS|PASS_WITH_RISKS|FAIL>
- agent: <test-runner|qa-reviewer|security-reviewer>
- scope: <검토 범위>

## 요약
<판정 근거>

## 발견 사항
### <CRITICAL|HIGH|MEDIUM|LOW> — <제목>
- 위치: `<path:line>`
- 근거: <재현 또는 코드 흐름>
- 영향: <사용자·보안·데이터 영향>
- 권고: <수정 또는 추가 검증>

발견 사항이 없으면 `없음`으로 적는다.

## 실행한 검사
| 명령 | exit code | 결과 |
|---|---:|---|
| `<command>` | `<code>` | <핵심 결과> |

## 미실행 검사와 잔여 위험
<환경 제약, 검증하지 못한 범위, 위험 수용 조건>

## 쓰기 금지 확인
- tracked file 변경: <없음|있음>
```
