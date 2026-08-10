# Study Workspace 문서 안내

이 디렉터리는 현재 실행 계약, 개발 방법, 저장 구조, 운영 절차와 과거 설계 자료를 함께 보관한다. 처음 보는 사람은 아래 순서로 읽는다.

## 빠른 시작

1. [프로젝트 README](../README.md) — 제품 목표와 구현 기능
2. [현재 시스템 상태](current-system-status.md) — 실제 구현 범위, 데이터 저장 위치, 남은 출시 조건
3. [로컬 개발환경](development-environment.md) — 프론트·백엔드·DB 실행과 테스트
4. [API 계약](openapi.yaml) — 현재 HTTP 요청·응답의 기준

## 기능과 데이터 구조

| 문서 | 내용 |
|---|---|
| [저장소 구조 V2](repository-schema-v2.md) | `.study-workspace` 경로, V1 호환과 안전 마이그레이션 |
| [API 오류 계약](api-error-catalog.md) | 공통 오류 코드와 프론트 처리 원칙 |
| [팀 구현 로드맵](team-implementation-roadmap.md) | 기능 영역별 구현 순서와 협업 기준 |
| [TODO](../todo.md) | P0/P1/P2 상태와 다음 제품 작업 |

## 테스트와 출시

| 문서 | 사용 시점 |
|---|---|
| [GitLab CI 가이드](ci-guide.md) | Merge Request와 로컬 전체 검사 |
| [스테이징 OAuth E2E](staging-e2e-checklist.md) | 실제 GitLab 두 계정 출시 승인 |
| [Production runbook](production-runbook.md) | HTTPS, PostgreSQL, Secret, 백업과 장애 대응 |

## 팀원별 백엔드 학습 자료

- [인증·Workspace 역할](backend-role-1-auth-workspace.md) / [구현 핸드북](guides/member-1-auth-workspace-handbook.md)
- [일정·저장소 역할](backend-role-2-session-repository.md) / [구현 핸드북](guides/member-2-session-repository-handbook.md)
- [제출·기록 역할](backend-role-3-submission-analytics.md) / [구현 핸드북](guides/member-3-submission-analytics-handbook.md)

## 문서 기준

- API가 다르면 `openapi.yaml`과 실제 Controller를 함께 수정한다.
- 구현 완료 상태가 바뀌면 `todo.md`와 `current-system-status.md`를 갱신한다.
- 배포 방법이 바뀌면 `production-runbook.md`와 환경변수 예제를 함께 수정한다.
- `docs/audits/`는 작성 당시의 진단 기록이다. 현재 상태 판단에는 이 문서와 `todo.md`를 우선한다.
- 비밀값, OAuth token, 실제 Client Secret과 개인 이메일은 문서나 캡처에 넣지 않는다.
