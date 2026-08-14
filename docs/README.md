# Study-ing 문서

이 디렉터리는 현재 코드와 함께 유지해야 하는 문서만 보관합니다. 처음 참여한 개발자는 아래 순서로 읽으면 됩니다.

1. [개발 환경과 실행](getting-started.md)
2. [현재 아키텍처](architecture/overview.md)
3. [OpenAPI 계약](api/openapi.yaml)과 [오류 계약](api/errors.md)
4. 작업 영역에 해당하는 아키텍처 문서
5. 배포 작업이라면 [운영 문서](operations/production.md)
6. AI 작업이라면 [Codex 구현·Claude QA 가이드](agents/README.md)

## 문서 구조

```text
docs/
├── README.md
├── getting-started.md
├── architecture/
│   ├── overview.md
│   ├── workspaces.md
│   ├── repository-storage.md
│   ├── records.md
│   └── providers/
├── api/
│   ├── openapi.yaml
│   └── errors.md
├── design/
│   └── design-system.md
├── collaboration/
│   └── git-workflow.md
├── operations/
│   ├── ci.md
│   ├── staging-e2e.md
│   ├── production.md
│   ├── launch-checklist.md
│   └── incident-response.md
└── legal/
```

## 아키텍처

| 문서 | 기준으로 삼는 내용 |
|---|---|
| [현재 아키텍처](architecture/overview.md) | 시스템 경계, 저장 위치, 주요 사용자 흐름과 권한 |
| [Workspace](architecture/workspaces.md) | 멤버십, Discovery/Join, 권한 재검증과 삭제 |
| [Repository 저장 구조](architecture/repository-storage.md) | `.study-workspace` 파일 구조와 V1 호환 |
| [Records](architecture/records.md) | 기간, 완료율과 점수 계산 정의 |
| [Provider identity](architecture/providers/identity.md) | Study-ing 사용자와 외부 계정의 관계 |
| [Repository Provider](architecture/providers/repository.md) | 정규화된 Repository 연결과 credential 해석 |
| [Provider capability](architecture/providers/capabilities.md) | 실제 노출 가능한 Provider 기능의 source of truth |
| [GitHub account linking](architecture/providers/github-account-linking.md) | 현재 구현된 GitHub 연결 범위와 보안 경계 |
| [GitHub App configuration](architecture/providers/github-app-configuration.md) | user authorization, App JWT, PEM과 capability 설정 |
| [GitHub Repository Adapter](architecture/providers/github-repository-adapter.md) | App 설치, 저장소 권한, read/write와 rollout 경계 |
| [Multi-provider migration](architecture/providers/migration.md) | V11 migration과 운영 검증 |

## 협업

- [Git 협업 가이드](collaboration/git-workflow.md)는 브랜치 전략, commit 규칙과 AI 에이전트 병행 작업 시 지키는 절차를 다룹니다.

## 개발 계약

- [OpenAPI](api/openapi.yaml)는 공개 HTTP 요청·응답 계약입니다.
- [오류 계약](api/errors.md)은 HTTP 상태, 오류 코드와 UI 처리 기준입니다.
- [디자인 시스템](design/design-system.md)은 token, component, responsive와 motion 기준입니다.
- Controller, DTO 또는 공통 UI 계약을 바꾸면 관련 문서와 테스트를 같은 변경에서 갱신합니다.

## 운영

| 문서 | 사용 시점 |
|---|---|
| [CI](operations/ci.md) | 로컬 검사와 pipeline 실패 분석 |
| [Staging E2E](operations/staging-e2e.md) | 실제 GitLab 계정으로 출시 전 검증 |
| [Production](operations/production.md) | 환경변수, 배포, 백업, 복구와 key rotation |
| [Launch checklist](operations/launch-checklist.md) | 공개 전에 운영자가 확정할 항목 |
| [Incident response](operations/incident-response.md) | credential 또는 개인정보 사고 대응 |

## 법무 초안

`legal/`은 구현 사실, 데이터 inventory, 정책 결정과 공개 전 초안을 분리합니다. `privacy-policy-draft.md`와 `terms-of-service-draft.md`는 `status: draft`인 동안 사용자 화면에 게시하지 않습니다.

## 유지 규칙

에이전트 기반 작업은 [에이전트 사용 가이드](agents/README.md)와 저장소 루트의 `AGENTS.md`를 따른다.

- 완료된 QA 보고서, 작업 계획, 역할 분담 문서와 생성된 screenshot artifact는 Git에 보관하지 않습니다.
- 재현 가능한 검증은 문서보다 자동 테스트나 `scripts/`로 남깁니다.
- 현재 코드와 다른 계획 문서는 고치는 대신 제거하거나 명시적으로 `Future` 범위로 구분합니다.
- 비밀값, OAuth token, 실제 session 값과 비공개 Repository 정보는 문서·이미지에 넣지 않습니다.
