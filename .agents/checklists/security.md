# 보안 검토 체크리스트

- [ ] 모든 보호 API가 인증을 요구한다.
- [ ] Workspace role과 Repository permission을 서버에서 각각 검증한다.
- [ ] OAuth state/CSRF, redirect URI와 account collision을 안전하게 처리한다.
- [ ] token·Cookie·Authorization·private content가 응답과 로그에 노출되지 않는다.
- [ ] credential은 암호화되고 key rotation·revocation 경로가 있다.
- [ ] 개인정보 수집·보유·삭제가 공개 정책 및 구현 사실과 일치한다.
- [ ] migration이 기존 데이터, constraint, index, lock과 rollback을 고려한다.
- [ ] 입력 검증, 출력 인코딩, CORS와 security header 회귀가 없다.
