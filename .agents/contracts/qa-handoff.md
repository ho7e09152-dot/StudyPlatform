# QA 인수인계 계약

아래 양식을 복사해 한국어로 작성한다. 실제 handoff는 commit하지 않는다.

```markdown
# QA 인수인계

- 작업: <이슈 또는 요구사항>
- 위험도: <낮음|중간|높음>
- 요청 agent: <test-runner|qa-reviewer|security-reviewer>

## 완료 조건
<검증할 사용자 동작과 계약>

## 변경 범위
<파일과 핵심 변경. API path·field·error code는 원문 유지>

## 정본과 불변조건
<OpenAPI, migration, 권한, Provider, Workspace 규칙>

## Codex 검증
| 명령 | 결과 | 비고 |
|---|---|---|
| `<command>` | `<PASS|FAIL|NOT_RUN>` | <근거> |

## 집중 검토 영역
<회귀·보안·테스트 위험>

## 제외 범위와 남은 위험
<의도적으로 바꾸지 않은 내용과 미검증 사항>
```
