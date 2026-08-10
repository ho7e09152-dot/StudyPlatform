# Staging OAuth E2E checklist

이 문서는 외부 GitLab 계정과 HTTPS 배포 주소가 필요한 마지막 출시 승인을 위한 체크리스트다. CI의 데모 브라우저 테스트는 UI 회귀를 검증하고, 이 절차는 실제 OAuth 토큰·프로젝트 권한·GitLab 커밋을 검증한다.

## 1. 자동 사전 점검

GitLab 애플리케이션의 Redirect URI와 배포 환경 변수를 먼저 설정한다.

```bash
FRONTEND_BASE_URL=https://study.example.com \
BACKEND_BASE_URL=https://api.study.example.com \
./scripts/staging-smoke.sh
```

다음을 모두 통과해야 한다.

- 랜딩과 로그인 화면 HTTP 200
- readiness HTTP 200
- 비로그인 Workspace API HTTP 401
- OAuth 시작 URL이 GitLab authorize endpoint로 HTTP 302
- 백엔드 응답에 `X-Request-ID` 존재

## 2. 테스트 준비

- GitLab 테스트 사용자 A와 B
- 두 사용자 모두 접근 가능한 빈 프로젝트 1개
- 기존 Markdown 또는 소스가 있는 프로젝트 1개
- A는 Maintainer 또는 Owner, B는 Developer 권한
- 브라우저 프로필 또는 시크릿 창을 사용자별로 분리

실제 개인 프로젝트 대신 삭제 가능한 스테이징 전용 프로젝트를 사용한다. OAuth Client Secret, access token, refresh token은 스크린샷이나 이슈에 남기지 않는다.

## 3. 사용자 A — 가입과 Workspace 생성

- [ ] GitLab로 로그인하고 이름·필수 프로필을 입력한다.
- [ ] 빈 프로젝트를 선택하면 `EMPTY`로 분류된다.
- [ ] 최종 확인 전에는 GitLab commit이 생성되지 않는다.
- [ ] Workspace 생성 후 `.study-workspace/config.yml`과 초기 구조를 확인한다.
- [ ] 일정을 만들고 GitLab의 `session.yml` commit SHA를 기록한다.
- [ ] 링크 또는 코드 항목을 제출하고 사용자 지정 이름이 commit 작성자와 제출 파일명에 사용되는지 확인한다.
- [ ] 제출 성공 화면의 SHA와 GitLab commit 링크가 실제 commit과 일치하는지 확인한다.

## 4. 사용자 B — 권한과 협업

- [ ] B가 같은 Workspace에 들어와 A가 만든 일정과 제출을 읽을 수 있다.
- [ ] B가 본인 제출을 저장하면 B의 OAuth 계정으로 commit이 생성된다.
- [ ] B가 A의 제출에 리뷰를 남기면 GitLab commit comment와 A의 인앱 알림이 생성된다.
- [ ] B가 일반 팀 메시지를 남길 수 있다.
- [ ] B가 만든 팀 문서는 A도 읽을 수 있지만 A에게 편집·삭제 버튼은 보이지 않는다.
- [ ] B가 임의의 Workspace ID 또는 다른 사용자의 문서 수정 API를 호출하면 403을 받는다.

## 5. 기존 저장소와 충돌

- [ ] 기존 파일이 있는 프로젝트는 `LEGACY`, `COMPATIBLE`, `PARTIALLY_COMPATIBLE`, `CONFLICTED` 중 올바르게 분류된다.
- [ ] 읽기 전용 분석에서는 commit이나 파일 변경이 발생하지 않는다.
- [ ] 기존 자료 유지 모드에서 서비스 데이터가 `.study-workspace` 아래에 격리된다.
- [ ] 분석 뒤 외부 commit을 추가하면 오래된 fingerprint로 초기화가 거부된다.
- [ ] 기존 루트 날짜 폴더 마이그레이션 미리보기와 단일 이동 commit을 확인한다.

## 6. 세션과 장애 복구

- [ ] 새로고침해도 로그인 확인 화면이 반복 노출되지 않는다.
- [ ] 백엔드를 재시작해도 JDBC 세션이 유지된다.
- [ ] GitLab OAuth 승인을 철회하면 명확한 재연결 안내가 나온다.
- [ ] 다시 승인한 뒤 기존 Workspace가 중복 생성되지 않는다.
- [ ] 동일 제출을 두 창에서 수정하면 오래된 `last_commit_id` 요청은 409로 거부된다.
- [ ] GitLab 429 또는 일시적 5xx 응답 시 사용자 데이터가 데모 데이터로 대체되지 않는다.

## 7. 출시 증거

테스트 결과에는 다음만 기록한다.

- 배포 버전 또는 commit SHA
- 테스트 시각과 브라우저
- Workspace ID와 GitLab project path
- 생성된 session/submission commit SHA
- 통과·실패 항목과 실패 시 `X-Request-ID`

두 사용자 흐름, OAuth 재연결, 충돌 검증이 모두 통과하기 전에는 production 배포로 승격하지 않는다.
