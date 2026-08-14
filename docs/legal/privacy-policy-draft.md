---
version: 2026-08-13
effectiveDate: TBD
status: draft
operator: "이호철"
---

# Study-ing 개인정보 처리방침 초안

> 운영자 승인 및 법률 검토 전 사용자 화면에 게시하지 않는다. Study-ing은 `이호철` 개인 개발자가 운영하는 무료·비상업 토이 프로젝트다.

## 1. 개인정보 처리 목적

Study-ing은 다음 목적으로 필요한 범위의 개인정보를 처리한다.

- GitLab OAuth 로그인과 Study-ing 계정 관리
- Workspace 참여, 역할과 GitLab project 접근 권한 확인
- 학습 일정, 제출, review와 팀 문서 기능 제공
- GitLab repository 읽기·쓰기와 동기화
- Activity 알림과 읽음 상태 제공
- 오류 확인, 보안 감사와 서비스 안정성 유지
- 표시 이름, 학습 기록 이름, 시간대와 화면 설정 제공

Study-ing에는 현재 결제, 유료 구독, 광고, 맞춤형 광고, 마케팅 목적 개인정보 이용 또는 개인정보 판매 기능이 없다. 제3자 analytics도 사용하지 않는다. 이러한 기능을 추가하면 이 방침을 재검토하고 필요한 고지·동의 절차를 마련한다.

`[법률 검토 필요: 목적별 개인정보 처리의 구체적 적법 근거]`

## 2. 처리하는 개인정보 항목

### 2.1 GitLab 로그인과 계정

- GitLab user ID, username, display name, profile image URL, profile/web URL
- OAuth access token, refresh token, expiry와 scope
- Study-ing 내부 account ID, account 생성·수정 시각
- 표시 이름, 학습 기록 파일명, 개인 timezone
- theme와 accent color
- Terms version/agreedAt, Privacy version/agreedAt, 만 14세 이상 확인 시각

OAuth access/refresh token은 서버 DB에서 AES-GCM으로 암호화한다. 브라우저에는 OAuth token을 저장하지 않고 HttpOnly session cookie를 사용한다.

### 2.2 GitHub 연결 계정

- GitHub user ID, username, optional display name, avatar URL, profile URL
- OAuth access token, optional refresh token/expiry metadata, granted scope

GitHub 연결은 이미 로그인한 사용자가 Settings에서 명시적으로 요청할 때만 GitHub App user authorization으로 수행한다. email은 요청하거나 저장하지 않는다. GitHub 저장소 기능이 활성화된 경우 사용자가 설치 대상으로 선택한 저장소의 metadata, permission, 파일, commit과 comment를 Workspace 기능 제공 범위에서 처리한다.

### 2.3 Workspace와 학습 활동

- Workspace membership, Study-ing role, GitLab/GitHub repository permission 상태
- 연결 project ID/path, branch, repository storage metadata
- 학습 일정, 제출 본문·reflection, team document, 공지와 메시지
- GitLab/GitHub commit ID/message와 review/comment 연계정보
- notification 내용과 read time
- sync job과 audit event의 유형·대상·오류정보·시각

자유 형식 콘텐츠에는 사용자가 다른 사람의 정보 또는 민감한 내용을 입력할 수 있다. 서비스 이용에 필요하지 않은 개인정보·민감정보는 입력하지 않아야 한다.

### 2.4 자동으로 처리될 수 있는 기술정보

- server-side session ID와 session attributes
- IP address 기반 비로그인 rate-limit window
- reverse proxy/application log의 IP, User-Agent, request path, request ID와 오류정보

OAuth code/state, access/refresh token, Authorization header, session cookie 및 private submission body를 의도적으로 log에 남기지 않는다. 실제 production proxy 설정은 공개 전 별도로 검증한다.

## 3. 처리 및 보유 기간

아래 기간은 법정 보유기간이 아니라 개인정보 최소화와 서비스 운영을 위해 정한 Study-ing의 Product Retention Policy다. 다른 법령에 따라 별도 보존 의무가 실제로 생기는 경우 해당 근거·항목·기간을 이 방침에 추가한다.

| 데이터 | 보유 기간/삭제 시점 |
|---|---|
| Account, profile, settings, current consent | account 탈퇴 시까지 |
| OAuth credential | 해당 Provider account 연결과 Study-ing account 유지 기간; 재승인 시 기존 credential 교체, account 탈퇴 시 모든 Provider credential 삭제. 현재 GitLab logout은 GitLab credential도 삭제함 |
| Server session | 마지막 사용 후 8시간; expired session 정리 작업 실행 |
| Notification과 read state | 생성 후 90일 |
| Sync/error operational record | 생성 후 30일 |
| Audit event | 생성 후 180일; 탈퇴 시 actor 식별정보 제거 |
| Soft-deleted Workspace | 삭제 후 7일간 복원 가능, 이후 Study-ing DB에서 final cleanup |
| Active Workspace 공동 콘텐츠 | Workspace 운영 기간; account 탈퇴 때 콘텐츠는 유지하고 Study-ing-managed attribution 익명화 |
| Application/proxy log | production 운영 목표 최대 30일; 실제 설정은 launch checklist에서 검증 |
| Encrypted DB backup | backup을 사용하는 경우 rotation 목표 최대 7일; 실제 설정은 launch checklist에서 검증 |
| GitLab repository files/commits/comments | GitLab project와 해당 운영 정책에 따름; Study-ing이 account/workspace 삭제로 자동 제거하지 않음 |

## 4. 개인정보 파기 절차와 방법

### Account 탈퇴

Study-ing account 탈퇴 시 다음 Study-ing-managed 데이터를 삭제한다.

- account, profile, profile image URL, provider identity cache와 개인 설정
- encrypted OAuth access/refresh credential
- Terms/Privacy consent record와 만 14세 이상 확인 record
- notification/read state
- 해당 Study-ing account의 server session

다른 Workspace 구성원의 기록 무결성을 위해 team document, 공지, 메시지와 cached submission 콘텐츠 자체는 자동 삭제하지 않는다. 대신 Study-ing DB의 작성자 식별정보를 `탈퇴한 사용자`로 익명화하고 audit actor 연결을 제거한다. Audit event는 생성 후 최대 180일 정책을 따른다.

### Workspace 삭제

Workspace는 삭제 후 7일 동안 Owner가 복원할 수 있다. 7일이 지나면 Workspace configuration, repository connection metadata, settings, notification, sync state, team content와 derived/cache data를 Study-ing DB에서 정리한다. Audit event는 180일 정책을 따른다.

전자적 record는 DB row 삭제 또는 식별정보 제거 방식으로 처리한다. Production backup의 삭제 반영은 최대 7일 rotation 목표에 따른다.

## 5. GitLab에 남는 정보

Study-ing은 GitLab repository를 학습 일정·제출 원본과 변경 이력에 사용한다. Study-ing account 또는 Workspace를 삭제해도 다음 정보가 GitLab에 남을 수 있다.

- schedule와 submission files
- team document 등 실제로 repository에 기록된 파일
- commit, commit author information와 Git history
- review/comment

Study-ing은 탈퇴나 Workspace 삭제 과정에서 GitLab 또는 GitHub 원본을 자동 삭제하지 않는다. 사용자는 해당 저장소의 권한과 Provider 정책에 따라 직접 처리해야 한다.

## 6. 외부 서비스, 처리위탁과 제3자 제공

현재 로그인 Provider는 GitLab이다. 사용자가 Settings에서 명시적으로 연결하고 GitHub App을 대상 저장소에 설치한 경우 GitHub도 Workspace 저장소 Provider로 사용할 수 있다. GitHub 신규 로그인/가입은 제공하지 않는다.

GitHub 계정을 연결하면 GitHub user ID, username, optional display name, avatar/profile URL과 encrypted GitHub App user access credential을 처리한다. 현재 email은 요청하거나 저장하지 않는다. GitHub Workspace를 사용하면 설치된 저장소 metadata/permission과 사용자가 요청한 repository file/commit/comment를 처리한다.

### GitLab → Study-ing

- 사용자 identity와 OAuth credential
- 접근 가능한 project metadata와 repository permission
- repository files, commits와 review comments

### Study-ing → GitLab

- OAuth 인증·API 요청 정보
- schedule, submission과 repository에 저장하도록 사용자가 지시한 콘텐츠
- commit message/author 연계정보와 review comment

| 외부 서비스 | 목적 | 전달·처리 데이터 | 상태 |
|---|---|---|---|
| `{{GITLAB_INSTANCE_TYPE_OR_OPERATOR}}` | OAuth, project 접근, repository read/write/review | 위 GitLab data flow | 운영자·법적 분류 확인 필요 |
| GitHub.com | Connected Account 연결·재승인과 사용자가 선택한 Workspace 저장소 read/write | GitHub identity/credential, 설치된 repository metadata/permission, 요청된 file/commit/comment | 법적 분류와 국외 처리 여부 검토 필요 |
| `{{PRODUCTION_HOSTING_PROVIDER}}` | app hosting | request와 service data | LAUNCH BLOCKER |
| `{{PRODUCTION_DB_PROVIDER}}` | DB/session/backup(해당 시) | Section 2 데이터 | LAUNCH BLOCKER |

GitLab과 hosting 관계가 위탁, 제3자 제공 또는 별도 개인정보처리자 중 어디에 해당하는지는 인프라·계약 확인 후 법률 검토한다.

## 7. 국외 이전 또는 국외 처리

`LAUNCH BLOCKER — INFRA DECISION`

다음 값이 확정되지 않아 국외 이전 여부를 단정하지 않는다.

- hosting: `{{PRODUCTION_HOSTING_PROVIDER}}`, `{{PRODUCTION_SERVER_REGION}}`
- database: `{{PRODUCTION_DB_PROVIDER}}`, `{{PRODUCTION_DB_REGION}}`
- GitLab: `{{GITLAB_INSTANCE_TYPE_OR_OPERATOR}}`

국외 처리가 확인되면 이전받는 자, 국가, 항목, 목적, 시기·방법, 보유기간, 법적 근거와 거부 방법·효과를 반영한다.

## 8. 정보주체의 권리와 행사 방법

사용자는 앱에서 profile을 수정하고 Study-ing account를 탈퇴할 수 있다. 그 밖의 개인정보 열람·정정·삭제·처리정지 요청은 다음 채널로 접수한다.

- 개인정보 문의와 권리행사: `ho7e09152@gmail.com`

현재 앱에는 자동 data export 기능이 없다. 요청 처리 시 본인 여부와 다른 Workspace 구성원의 권리를 확인할 수 있다. 본인확인 방법, 처리기한, 대리인 절차와 제한·거절 통지는 공개 전 운영 절차 및 법률 검토를 확정한다.

## 9. 만 14세 미만 이용자

Study-ing은 현재 만 14세 미만 사용자를 대상으로 서비스를 제공하지 않으며 법정대리인 동의 flow도 제공하지 않는다. Onboarding에서 사용자가 만 14세 이상임을 확인한다.

## 10. 안전성 확보조치

현재 구현에서 확인된 조치는 다음과 같다.

- OAuth credential의 AES-GCM encryption과 environment key 주입
- HttpOnly, SameSite=Lax session cookie 및 production Secure cookie
- OAuth state random generation, server-side 저장, 만료와 constant-time 비교
- CSRF·authorization·role 및 repository permission 확인
- GitLab write 전 권한 재검증과 revision/commit 충돌 방지
- Workspace storage path 제한
- OAuth token과 Authorization header의 의도적 log 금지
- OAuth callback query access log 차단
- private repository access revoke 확인 시 Workspace content 접근 차단

Production HTTPS, secret manager/key rotation, DB·backup encryption, outer proxy redaction은 infrastructure 확정 후 검증한다.

## 11. Cookie와 자동 수집 장치

Study-ing은 인증에 필요한 HttpOnly session cookie를 사용한다. 기본 inactivity expiry는 8시간이다. 광고 또는 제3자 analytics cookie를 사용하지 않으므로 현재 별도 광고 cookie banner를 제공하지 않는다.

화면 theme와 demo-only document는 browser localStorage에 저장될 수 있으며 OAuth 인증정보는 아니다.

## 12. 개인정보 문의

- 운영자: `이호철` 개인 개발자
- 서비스 문의: `ho7e09152@gmail.com`
- 개인정보 문의/권리행사: `ho7e09152@gmail.com`

실제로 응답 가능한 값을 입력하기 전 본 문서를 게시하지 않는다.

## 13. 처리방침 변경

- version: `2026-08-13`
- 공고일: 운영자 승인 시 기록
- 시행일: `TBD`
- 이전 version과 변경 내역: Git version history 및 향후 공개 변경 이력

중대한 변경의 재동의 필요 여부와 고지 절차는 법률 검토 후 확정한다. Backend는 현재 accepted version과 required version이 다른지를 식별할 수 있으나 전용 재동의 화면은 후속 작업이다.

## Official review references

- 개인정보 보호위원회, 개인정보 처리방침 작성지침(2026.4 개정): https://www.pipc.go.kr/np/cop/bbs/selectBoardArticle.do?bbsId=BS217&mCode=D010030000.Updated&nttId=12018
- 개인정보 보호법 제30조: https://law.go.kr/LSW/lsLinkCommonInfo.do?lsJoLnkSeq=1033214957
- 개인정보 보호법 시행령 제31조: https://www.law.go.kr/LSW/lsLawLinkInfo.do?chrClsCd=010202&lsJoLnkSeq=900079801
- 개인정보 보호법 제22조의2: https://www.law.go.kr/LSW/lsLinkCommonInfo.do?ancYnChk=&chrClsCd=010202&lsJoLnkSeq=1029334873

## Publication requirement checklist

| 항목 | Applicability | Draft status |
|---|---|---|
| 처리 목적 | Required | 작성됨; 적법 근거 legal review 필요 |
| 처리 항목 | Required | 코드 inventory 기준 작성됨 |
| 처리·보유 기간 | Required | Product retention 결정 및 DB 구현 완료; infra 검증 필요 |
| 파기 절차·방법 | Required | 작성됨; backup 실제 설정 필요 |
| 제3자 제공 | If applicable | GitLab/hosting 법적 분류 review 필요 |
| 처리위탁 | If applicable | production vendor/계약 확인 필요 |
| 국외 이전 | If applicable | region 확인 전 launch blocker |
| 정보주체·법정대리인 권리 | Required | 앱 기능과 이메일 방식 작성; 실제 이메일 필요 |
| 개인정보 보호책임자/고충 연락처 | Required | 운영자 `이호철`, `ho7e09152@gmail.com` |
| 자동 수집 장치/Cookie | Applicable | 필수 session cookie와 localStorage 설명 |
| 안전성 확보조치 | Required | 확인된 구현만 작성; production infra 검증 필요 |
| 만 14세 미만 | Review Required | 현재 미지원 정책과 onboarding 확인 반영 |
| 처리방침 변경 | Required | version 존재; effective date와 공개 이력 필요 |
