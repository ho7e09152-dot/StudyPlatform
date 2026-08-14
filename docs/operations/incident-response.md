# Study-ing 최소 보안 사고 대응

> 개인 개발 토이 프로젝트를 위한 최소 절차다. 법률 자문이나 완전한 사고대응 체계를 대신하지 않는다.

## 연락망

- Operator: `이호철`
- Service contact: `ho7e09152@gmail.com`
- Privacy/incident contact: `ho7e09152@gmail.com`

실제 연락처와 대체 담당 방법을 입력하기 전 production-ready 상태로 간주하지 않는다.

## 1. 확인과 확산 방지

1. 신고 또는 alert 시각과 발견 경로를 기록한다.
2. 증거를 훼손하지 않는 범위에서 영향을 받는 endpoint, account, Workspace, GitLab project와 시간 범위를 확인한다.
3. 노출 endpoint를 차단하거나 위험 기능을 임시 중단한다. 읽기 가능한 안전한 화면까지 불필요하게 전체 차단하지 않는다.

## 2. Credential 대응

상황에 따라 다음 중 필요한 조치를 수행한다.

- 노출된 OAuth credential revoke 및 local row 삭제
- GitLab OAuth application secret rotation
- `OAUTH_TOKEN_ENCRYPTION_KEY` rotation 계획 실행; 기존 ciphertext 처리 없이 key만 교체하지 않음
- affected session invalidation
- DB·hosting·proxy credential rotation

## 3. 범위와 증거

- 어떤 개인정보·콘텐츠가 실제로 접근·변경·유출되었는지 구분한다.
- Provider outage나 timeout을 권한 철회 또는 침해로 오인하지 않는다.
- OAuth token, Authorization, Cookie와 private submission body가 incident note에 불필요하게 복사되지 않게 한다.
- 필요한 log를 access-limited incident copy로 보존하고 목적이 끝나면 삭제한다.

## 4. 커뮤니케이션 결정

개인정보 침해 또는 서비스 보안사고 가능성이 있으면 운영자는 공식 법령·개인정보보호위원회 자료와 전문 자문을 확인해 신고·사용자 통지 필요성, 대상, 시기와 내용을 결정한다. 결론과 근거를 incident record에 남긴다.

## 5. 복구

1. 원인을 수정하고 targeted test와 permission boundary test를 수행한다.
2. GitLab, hosting, DB와 proxy 상태를 확인한다.
3. 최소 권한으로 service를 단계적으로 복구한다.
4. user-facing 영향이 남으면 service 화면과 `ho7e09152@gmail.com`을 통해 안내한다.

## 6. 후속 조치

- 영향 범위, 조치, 누락과 재발방지 action을 기록한다.
- code/config/runbook/retention policy를 갱신한다.
- credential와 log access를 재점검한다.
- 미완료 action에 owner와 완료 목표를 지정한다.
