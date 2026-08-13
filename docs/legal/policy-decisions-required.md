---
status: working-policy
updatedAt: 2026-08-13
serviceModel: personal-free-noncommercial
---

# Study-ing policy decisions and remaining launch inputs

이 문서는 개인 개발자가 운영하는 무료·비상업 토이 프로젝트 Study-ing의 현재 운영 결정을 기록한다. `DECIDED`는 현재 제품 정책이며 법정 보유기간이라는 뜻이 아니다. `LAUNCH BLOCKER`와 `LEGAL REVIEW REQUIRED`는 실제 값 입력 또는 전문 검토 전 공개 문안으로 확정할 수 없는 항목이다.

## Status definitions

- `DECIDED`: 운영자가 현재 제품 범위에서 확정한 정책이며 코드 또는 runbook에 반영했다.
- `LAUNCH BLOCKER`: 공개 전 실제 운영자가 값을 입력하거나 인프라를 확인해야 한다.
- `LEGAL REVIEW REQUIRED`: 데이터 흐름 사실은 확인했지만 법적 분류·효과는 전문 검토가 필요하다.
- `FOLLOW-UP`: 현재 출시 범위에는 필요하지 않으며 기능 추가 시 재검토한다.

## Decided policies

### LEGAL-001 — 서비스 형태와 비즈니스 모델

| Field | Value |
|---|---|
| Decision | 개인 개발자가 운영하는 무료·비상업 토이 프로젝트. 결제, 유료 구독, 광고, 마케팅 목적 이용, 개인정보 판매, 행태 기반 광고 없음. |
| Current Behavior | 코드에 결제·광고·마케팅·제3자 analytics SDK가 없다. |
| Operational Impact | 환불·구독 조항과 cookie banner를 만들지 않는다. 유료화·광고·analytics 추가 전 정책과 문서를 개정한다. |
| Legal Review | 전자상거래법 등 추가 적용 여부는 실제 거래 기능 도입 시 재검토. 현재 적용성을 단정하지 않음. |
| Status | DECIDED |

### LEGAL-002 — 이용 연령

| Field | Value |
|---|---|
| Decision | 만 14세 이상만 지원. 만 14세 미만 법정대리인 동의 flow는 제공하지 않는다. |
| Current Behavior | onboarding에서 만 14세 이상 여부를 별도 확인한다. |
| Operational Impact | 만 14세 미만 사용자를 위한 가입·동의 예외 flow를 만들지 않는다. |
| Legal Review | 공개 문구의 충분성과 예외 처리 확인 권장. |
| Status | DECIDED |

### LEGAL-003 — Terms와 Privacy 동의

| Field | Value |
|---|---|
| Decision | Terms와 Privacy를 독립적으로 동의하고 각 current version/agreedAt을 저장한다. profile 수정은 동의 시각을 변경하지 않는다. 계정 탈퇴 시 동의 record도 계정과 함께 삭제한다. |
| Current Behavior | 독립 DB column, 세 개의 onboarding checkbox, required-version 비교 `requiresReconsent` foundation이 구현됐다. |
| Operational Impact | document version 변경 시 전용 재동의 UX가 필요하다. |
| Legal Review | 각 처리 목적의 적법 근거와 동의가 필요한 범위는 별도 확인 필요. |
| Status | DECIDED / re-consent UI FOLLOW-UP |

### LEGAL-004 — Data retention

| Dataset | Decision | Implementation |
|---|---:|---|
| Account/profile/preferences/current consent | 계정 탈퇴 시까지 | account row와 함께 삭제 |
| OAuth credential | 연결 유지 또는 account 존재 기간 | 재승인 시 rotate, logout/account delete 시 삭제 |
| JDBC session | 8시간 inactivity | 매분 expired-session cleanup |
| Notification/read state | 90일 | daily cleanup |
| Sync/error operational record | 30일 | daily cleanup |
| Audit event | 180일 | daily cleanup; 탈퇴 시 actor 익명화 |
| Soft-deleted Workspace | 7일 | restore window 후 daily final purge |
| Active Workspace shared content | Workspace 운영 기간 | account delete 시 content 보존·attribution 익명화; Workspace final delete 시 cascade |
| GitLab files/commits/comments | GitLab/project 정책 | Study-ing이 account/workspace delete로 자동 삭제하지 않음 |
| Application/proxy log target | 최대 30일 | runbook 목표; 실제 infra 검증은 BLOCKER |
| Encrypted DB backup target | 최대 7일 | runbook 목표; 실제 infra 검증은 BLOCKER |

`90/30/180/7일`은 개인정보 최소화와 토이 프로젝트 운영을 위한 Product Policy이며 법정 보유기간으로 설명하지 않는다.

### LEGAL-005 — Account delete

| Field | Value |
|---|---|
| Decision | Study-ing이 직접 통제하는 계정, OAuth credential, profile/preferences/consent, notification, current session을 삭제한다. 공동 콘텐츠는 유지하되 작성자와 cached submission identity를 `탈퇴한 사용자`로 익명화한다. |
| Current Behavior | 명시적 transactional cleanup service가 notification 삭제, shared attribution 익명화, audit actor 제거, account/credential 삭제를 수행한다. 로그인 session을 account principal로 index하고 탈퇴 시 해당 account session을 모두 삭제한다. |
| Operational Impact | active Workspace 소유자는 orphan 방지를 위해 먼저 Workspace를 삭제하거나 소유권을 정리해야 한다. |
| Legal Review | 공동 기록 보존 범위와 정보주체 삭제 요청 충돌 가능성 검토 권장. |
| Status | DECIDED |

### LEGAL-006 — GitLab data after deletion

| Field | Value |
|---|---|
| Decision | Study-ing Account/Workspace 삭제로 GitLab repository 파일, commit/history, author information, comment/review를 자동 삭제하지 않는다. 사용자는 project 권한과 GitLab 정책에 따라 직접 처리한다. |
| Current Behavior | Study-ing 삭제 flow에서 GitLab repository delete API를 호출하지 않는다. |
| Operational Impact | Terms와 Privacy에 DB/GitLab boundary를 명시한다. |
| Legal Review | Study-ing·GitLab·project 관리자의 법적 역할 분류는 별도 검토. |
| Status | DECIDED / LEGAL REVIEW REQUIRED |

### LEGAL-007 — Workspace delete

| Field | Value |
|---|---|
| Decision | Day 0 soft delete, 7일간 Owner restore, 이후 Study-ing DB Workspace와 연결 데이터를 final purge. GitLab repository는 유지. Audit은 생성일로부터 최대 180일 별도 보유. |
| Current Behavior | soft-delete expiry와 daily purge가 중앙 보유정책을 사용한다. |
| Status | DECIDED |

### LEGAL-008 — Logging and backup targets

| Field | Value |
|---|---|
| Decision | application/proxy aggregation log는 최대 30일 목표. backup을 사용하면 암호화하고 최대 7일 rotation. OAuth code/state/token/Authorization/session cookie/private submission body는 log 금지. |
| Current Behavior | repository gateway는 OAuth callback access log를 끈다. runbook에 모든 proxy layer 검증과 retention target이 있다. 실제 외부 인프라는 미확정이다. |
| Status | DECIDED POLICY / DEPLOYMENT BLOCKER |

### LEGAL-009 — Security incident minimum

| Field | Value |
|---|---|
| Decision | 확인 → 영향 범위 → credential revoke/rotation → 노출 차단 → 필요한 로그 보존 → 사용자 안내 판단 → 재발 방지의 최소 절차를 사용한다. |
| Current Behavior | `docs/operations/incident-response.md`에 절차가 있다. |
| Status | DECIDED; 실제 연락 담당자는 BLOCKER |

### LEGAL-010 — User content rights

| Field | Value |
|---|---|
| Decision | submission, team document, review의 권리는 사용자 또는 기존 권리자에게 유지된다. Study-ing은 서비스 제공에 필요한 범위에서만 처리한다. |
| Operational Impact | 운영자가 콘텐츠 소유권을 포괄적으로 양도받는 조항을 넣지 않는다. |
| Legal Review | 상세 이용허락 범위와 권리침해 대응 절차 검토 권장. |
| Status | DECIDED / LEGAL REVIEW REQUIRED |

### LEGAL-011 — Service availability and termination

| Field | Value |
|---|---|
| Decision | 개인 프로젝트 특성, 유지보수, GitLab 장애/API 제한/권한 변경, 운영 사정에 따라 기능이 변경·중단될 수 있다. 종료 시 가능한 범위에서 화면으로 사전 안내하고 Study-ing DB 정리 일정을 알린다. GitLab 원본은 자동 삭제하지 않는다. |
| Current Behavior | 별도 SLA나 export 기능은 없다. |
| Legal Review | 구체적 고지 기간, 책임 제한과 종료 절차는 공개 전 검토. |
| Status | DECIDED DEFAULT / LEGAL REVIEW REQUIRED |

### LEGAL-012 — User rights channel

| Field | Value |
|---|---|
| Decision | profile 수정과 account 탈퇴는 앱에서 제공한다. 그 밖의 열람·정정·삭제·처리정지 요청은 개인정보 문의 이메일로 접수한다. 자동 export 기능은 약속하지 않는다. |
| Current Behavior | 앱 내 profile/account delete 존재; 별도 export 없음. |
| Contact | `ho7e09152@gmail.com` |
| Status | DECIDED / EMAIL RECEIPT TEST REQUIRED |

## Remaining launch blockers

### LEGAL-101 — 운영자와 연락처

| Field | Value |
|---|---|
| Decision | 운영자: 이호철 / 서비스·개인정보 문의: `ho7e09152@gmail.com` |
| Why Needed | 약관 당사자, 개인정보처리자, 고충·권리행사 접수자를 특정해야 한다. |
| Status | DECIDED / EMAIL RECEIPT TEST REQUIRED |

### LEGAL-102 — Production infrastructure

| Field | Value |
|---|---|
| Required Input | `{{PRODUCTION_HOSTING_PROVIDER}}`, `{{PRODUCTION_SERVER_REGION}}`, `{{PRODUCTION_DB_PROVIDER}}`, `{{PRODUCTION_DB_REGION}}`, `{{GITLAB_INSTANCE_TYPE_OR_OPERATOR}}` |
| Why Needed | 실제 외부 처리자, server region, log/backup 통제 범위를 확정해야 한다. |
| Status | LAUNCH BLOCKER |

### LEGAL-103 — 국외 이전 및 외부 서비스 법적 분류

| Field | Value |
|---|---|
| Current Fact | GitLab과 Study-ing 사이 데이터 흐름은 확인됐지만 GitLab instance 운영자·지역과 production host가 미확정이다. |
| Decision Needed | 국외 이전 해당 여부와 GitLab/hosting의 위탁·제3자 제공·독립 처리자 분류. |
| Status | LAUNCH BLOCKER — INFRA DECISION / LEGAL REVIEW REQUIRED |

### LEGAL-104 — 최종 약관 법률 문구

| Field | Value |
|---|---|
| Review Needed | 개인정보 처리 적법 근거, 책임 범위, 이용 제한 절차, 준거법·관할, 미성년 정책 문구, 약관 변경·재동의 기준. |
| Status | LEGAL REVIEW REQUIRED |

## Follow-up triggers

다음 기능을 추가하기 전 이 문서와 Terms/Privacy를 재검토한다.

- GitHub provider 또는 복수 provider account
- Study-ing Managed Storage와 invite membership
- 결제, 유료 구독 또는 거래 기능
- 광고, 마케팅 활용 또는 제3자 analytics
- 이메일·문자 알림
- 만 14세 미만 사용자와 법정대리인 동의
- 자동 data export
- Terms/Privacy version 변경에 대한 실제 re-consent 화면

## Publication gate

Draft를 `/terms`, `/privacy`에 반영하기 전에 다음을 모두 충족한다.

1. LEGAL-101과 LEGAL-102의 실제 값을 입력한다.
2. 실제 infrastructure에서 30일 log, 7일 encrypted backup rotation과 OAuth callback redaction을 검증한다.
3. LEGAL-103과 LEGAL-104를 검토한다.
4. document metadata의 `status`를 `published`로 변경하고 시행일을 입력한다.
5. onboarding required version constant와 게시 문서 version이 일치하는지 test한다.
