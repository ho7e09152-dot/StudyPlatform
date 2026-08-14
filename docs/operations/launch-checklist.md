# Study-ing 공개 출시 체크리스트

내부 출시 준비 문서다. 사용자-facing Legal Page에는 노출하지 않는다.

## P0 — 운영자와 법무 문서 공개

- [x] 운영자 `이호철` 입력
- [ ] 서비스 문의 `ho7e09152@gmail.com` 실제 수신 테스트
- [ ] 개인정보 문의/권리행사 `ho7e09152@gmail.com` 실제 수신 테스트 및 처리 담당 확인
- [ ] Terms/Privacy의 책임 범위, 처리 적법 근거, GitLab 관계, 준거법·관할 검토
- [ ] Terms/Privacy `effectiveDate`, 공고일과 변경 이력 위치 입력
- [ ] Draft `status: draft`를 승인 후에만 `published`로 변경
- [ ] 게시 문서 version과 backend required version 일치 확인
- [ ] Profile onboarding에서 만 14세 이상, Terms, Privacy 세 동의가 각각 기록되는지 확인
- [ ] 향후 version 변경 시 재동의 화면 구현 전 required version을 올리지 않음

## P0 — 인프라 목록

- [ ] `{{PRODUCTION_HOSTING_PROVIDER}}`, `{{PRODUCTION_SERVER_REGION}}` 입력
- [ ] `{{PRODUCTION_DB_PROVIDER}}`, `{{PRODUCTION_DB_REGION}}` 입력
- [ ] `{{GITLAB_INSTANCE_TYPE_OR_OPERATOR}}`와 실제 data region/정책 확인
- [ ] GitLab·hosting·DB의 위탁/제3자 제공/독립 처리자 분류 검토
- [ ] 국외 이전/국외 처리 해당 여부와 필요한 고지·동의 검토
- [ ] 외부 proxy/CDN/monitoring/backup vendor inventory 완료

## P0 — 보안과 logging

- [ ] HTTPS와 Secure/HttpOnly/SameSite=Lax session cookie 실응답 확인
- [ ] 모든 proxy layer에서 OAuth callback query access log 차단
- [ ] OAuth code/state/token, Authorization, Cookie, private submission body log 미노출 검증
- [ ] application/proxy/container/aggregation log 최대 30일 lifecycle rule 확인
- [ ] `OAUTH_TOKEN_ENCRYPTION_KEY`를 secret manager에 저장하고 접근·rotation owner 확정
- [ ] DB/disk/backup encryption 확인
- [ ] [incident response runbook](incident-response.md)의 owner/contact placeholder 입력 및 tabletop 점검

## P0 — 보유와 삭제

- [ ] Flyway V13까지 적용 확인
- [ ] notification 90일, sync log 30일, audit 180일 cleanup scheduler 실행 확인
- [ ] Workspace soft delete 7일과 restore/final purge 확인
- [ ] encrypted DB backup 최대 7일 rotation rule 확인
- [ ] Account delete 후 user/profile/consent/credential/notification 삭제 확인
- [ ] Account delete 후 shared attribution과 cached submission identity가 `탈퇴한 사용자`로 익명화되는지 확인
- [ ] Account delete 직후 protected API가 credential 없음으로 차단되고 session이 만료되는지 확인
- [ ] GitLab files/commits/comments가 Study-ing 삭제와 별개임을 실제 문구와 대조

## P1 — 운영

- [ ] 개인정보 열람·정정·삭제·처리정지 요청의 본인확인·처리·회신 절차 확정
- [ ] 서비스 종료 고지와 Study-ing DB 정리 절차 확정
- [ ] scheduler 실패·DB 증가량 monitoring/alert 확인
- [ ] 월 1회 isolated restore test 계획
- [ ] abandoned onboarding account cleanup 정책 후속 결정
- [ ] soft-deleted document/message 자체 retention 후속 결정

## 향후 재검토 조건

다음 기능 추가 전 Terms/Privacy와 onboarding consent를 다시 검토한다.

- GitHub 로그인·Repository Provider 또는 복수 provider account 정책 확장
- Study-ing Managed Storage
- 결제·유료 구독·거래
- 광고·marketing·analytics
- 이메일/문자 notification
- 만 14세 미만 사용자 지원
- 자동 data export
