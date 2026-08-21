# Storage Follow-ups

Storage Layout의 블록, Format, `session.yml`, Member submission 및 Reverse Parsing 계약은 실제 GitLab Provider E2E 결과를 기준으로 freeze 상태입니다. 아래 항목은 현재 안전한 동작을 바꾸지 않고 별도 설계나 운영 준비가 필요한 후속 작업만 기록합니다.

## P2

### Repository Tree Fingerprint 부분 재검증

- **Status:** TODO
- **배경:** Repository 분석 이후 전체 tree fingerprint가 달라지면 `409 REPOSITORY_CHANGED`로 Workspace 생성을 중단하고 전체 재분석을 요구합니다.
- **현재 상태:** README처럼 Storage Layout과 무관한 파일 변경도 감지하는 strict 정책을 사용합니다. 보수적이지만 안전합니다.
- **지금 하지 않는 이유:** 관련 경로만 재검증하려면 Provider별 tree semantics와 충돌 판정을 먼저 안정화해야 합니다. 이번 hardening은 frozen Storage 계약을 변경하지 않습니다.
- **구현 방향:** revision 변경 시 Base Path, system config path, parent file collision, final target collision, reserved path와 foreign file collision만 다시 검증합니다. 관련 충돌이 없으면 생성을 계속하고 실제 충돌에만 재분석을 요구합니다.
- **영향 범위:** Workspace 연결 분석, GitLab tree 조회, collision validator, `REPOSITORY_CHANGED` 오류 처리.
- **완료 조건:** 무관한 파일 변경은 연결을 막지 않고, Storage 관련 경로 충돌과 reserved path 변경은 기존과 동일하게 차단하는 Provider integration test가 통과합니다.

### Real Provider E2E 자동화

- **Status:** TODO
- **배경:** Storage Golden 계약은 실제 GitLab Repository에서 검증했지만 현재 실행은 전용 Repository와 수동 절차에 의존합니다.
- **현재 상태:** Workspace 생성, session/submission write, update, sync, restart recovery와 cleanup을 수동 E2E 문서로 검증했습니다.
- **지금 하지 않는 이유:** 외부 Provider credential, rate limit, branch protection과 테스트 데이터 보존 정책 없이 일반 CI에 넣으면 운영 위험이 큽니다.
- **구현 방향:** 전용 Private Repository와 격리 credential을 사용하고 run별 prefix, create/update/sync/cleanup 및 tree artifact 수집을 자동화합니다. 일반 PR CI가 아니라 승인된 주기 작업을 우선 검토합니다.
- **영향 범위:** E2E runner, GitLab credential 관리, CI secret, 테스트 artifact와 cleanup.
- **완료 조건:** 실패를 mock 성공으로 처리하지 않고 실제 commit SHA와 tree 결과를 남기며, 중간 실패에도 다른 run의 파일을 건드리지 않습니다.

### GitHub Provider Storage Parity

- **Status:** TODO — GitHub Repository Phase 이후
- **배경:** Storage Layout Golden 계약은 GitLab에서 실 Provider 검증을 마쳤지만 GitHub Repository Adapter는 같은 수준의 저장 계약 검증이 필요합니다.
- **현재 상태:** GitHub account linking/App authentication foundation과 Storage 계약은 분리되어 있으며 GitHub Repository write를 조기 활성화하지 않습니다.
- **지금 하지 않는 이유:** GitHub installation 및 Repository Adapter 구현이 이번 범위가 아닙니다.
- **구현 방향:** Adapter 완료 후 Workspace initialization, `session.yml`, submission create/update, reverse sync, collision, restart recovery에 GitLab과 동일한 Golden 계약을 적용합니다.
- **영향 범위:** GitHub App installation token, Repository Adapter, capability rollout과 Provider E2E.
- **완료 조건:** GitHub 실제 Test Repository에서 동일한 semantic data → path → reverse parse 계약과 보안 충돌 케이스가 통과합니다.

## P3

### Legacy `itemCommitIds` 호환 제거

- **Status:** TODO
- **배경:** 현재 Domain/API/Persistence write에서는 필드를 제거했지만, 과도기 JSON 입력을 실패 없이 버리기 위한 Jackson ignored-property 선언이 남아 있습니다.
- **현재 상태:** master 이력과 sandbox DB에는 실제 저장 기록이 없었고 legacy read 후 current write에도 필드가 재생성되지 않습니다.
- **지금 하지 않는 이유:** 다른 환경이나 보관된 snapshot에 과도기 JSON이 존재할 가능성을 즉시 0으로 단정하지 않습니다.
- **구현 방향:** production/sandbox snapshot 및 migration audit로 사용 흔적이 없음을 최종 확인하고 compatibility window 종료 후 ignored-property 선언과 fixture를 함께 제거합니다.
- **영향 범위:** `MemberSubmissionFile` Jackson 역직렬화와 legacy compatibility test.
- **완료 조건:** 지원 대상 데이터에 해당 property가 없다는 운영 근거가 기록되고, 선언 제거 후 전체 persistence/API regression이 통과합니다.

### Unicode NFC/NFD Normalization 정책

- **Status:** TODO
- **배경:** macOS, Linux와 Git Provider 사이에서 한글 filename의 NFC/NFD 표현이 달라질 수 있습니다.
- **현재 상태:** spoofing에 사용되는 Unicode `Cf` 문자는 차단하지만 정상 Unicode는 기존 표현 그대로 저장하며 normalize하지 않습니다.
- **지금 하지 않는 이유:** normalization을 새로 적용하면 기존 Repository path와의 호환성, 충돌 판정 및 Reverse Parsing 결과가 바뀔 수 있습니다.
- **구현 방향:** Provider별 filename round-trip과 기존 Repository inventory를 조사하고 canonical form, 비교 방식, migration 및 충돌 정책을 함께 설계합니다.
- **영향 범위:** Profile record name, path resolver/parser, collision 검사, Repository sync와 기존 파일 migration.
- **완료 조건:** NFC/NFD가 다른 동일 표시 이름의 충돌 정책과 기존 파일 호환성 검증이 문서화되고 migration 포함 회귀 테스트가 통과합니다.

### Test Repository Lifecycle

- **Status:** TODO
- **배경:** Storage Layout 검증용 Private GitLab Repository와 commit history를 감사 및 재확인 목적으로 유지하고 있습니다.
- **현재 상태:** 보존 기간, canonical Repository 수, credential rotation과 자동 cleanup 기준이 명시되지 않았습니다.
- **지금 하지 않는 이유:** 감사 필요성과 테스트 데이터 최소화 사이의 운영 결정을 먼저 내려야 합니다.
- **구현 방향:** 하나의 canonical E2E Repository 유지 여부, run별 prefix 보존 기간, artifact 보관, ProviderAccount rotation 및 cleanup 책임자를 정합니다.
- **영향 범위:** QA 운영 문서, GitLab project, secret rotation과 E2E automation.
- **완료 조건:** retention/삭제 기준과 책임자가 문서화되고 만료 데이터가 안전하게 정리되며 Git history를 rewrite하지 않습니다.

### Storage 오류 계약 문서화

- **Status:** TODO
- **배경:** `INVALID_STORAGE_LAYOUT`, `TEMPORAL_COMPONENT_MISMATCH`, `INVALID_REPOSITORY_FILE_NAME` 등 Storage 관련 오류 코드는 구현과 OpenAPI schema에 사용되지만 오류 코드 안내 문서의 설명이 충분하지 않습니다.
- **현재 상태:** Frontend는 사용자용 문구로 변환하고 Backend는 안정된 code를 반환하지만, API 소비자가 코드별 복구 방법을 한 문서에서 확인하기 어렵습니다.
- **지금 하지 않는 이유:** 이번 hardening은 기존 오류 의미나 HTTP contract를 변경하지 않으며, 불완전한 일부 코드만 추가하기보다 Storage 오류 inventory를 별도 검토해야 합니다.
- **구현 방향:** 실제 Controller/Service에서 반환하는 Storage 오류를 전수 확인하고 상태 코드, 발생 조건, 사용자 복구 행동과 공개 여부를 `docs/api/errors.md`에 정리합니다.
- **영향 범위:** Backend error inventory, OpenAPI/error 문서와 Frontend 오류 매핑.
- **완료 조건:** 구현에 존재하는 공개 Storage 오류와 문서가 양방향으로 일치하고 contract lint 및 오류 매핑 테스트가 통과합니다.

### 사용자 표시 텍스트의 Bidirectional 제어 문자 정책

- **Status:** TODO
- **배경:** Repository path와 filename은 Unicode `Cf`를 차단하지만 commit 안내문, 문서 제목, 활동 텍스트처럼 경로가 아닌 자유 텍스트는 기존 control-character 정책만 사용합니다.
- **현재 상태:** 저장 경로 spoofing 위험은 해소됐으며 자유 텍스트는 이번 Storage hardening 범위 밖입니다.
- **지금 하지 않는 이유:** 자유 텍스트 전체에 동일 정책을 적용하면 국제화와 기존 콘텐츠 표시 호환성을 별도로 검토해야 합니다.
- **구현 방향:** 사용자에게 렌더링되는 텍스트의 trust boundary를 inventory하고 bidi control을 허용할 실제 사용 사례, 입력 거부와 안전한 렌더링 중 적용 정책을 결정합니다.
- **영향 범위:** Commit rule, 문서 제목, 활동 피드, 프로필 표시 이름과 공통 입력 validator.
- **완료 조건:** 적용 대상과 예외가 문서화되고 bidi 표시 왜곡 회귀 테스트가 통과하며 정상 다국어 텍스트는 유지됩니다.
