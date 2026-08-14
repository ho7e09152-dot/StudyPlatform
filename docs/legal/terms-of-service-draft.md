---
version: 2026-08-13
effectiveDate: TBD
status: draft
operator: "이호철"
---

# Study-ing 이용약관 초안

> 운영자 승인 및 법률 검토 전 사용자 화면에 게시하지 않는다.

## 1. 목적과 운영자

이 약관은 `이호철` 개인 개발자(이하 “운영자”)가 무료·비상업 토이 프로젝트로 제공하는 Study-ing의 이용 조건과 운영자·이용자의 권리와 책임을 정한다.

## 2. 서비스 내용

Study-ing은 GitLab project 또는 GitHub repository를 Workspace에 연결하여 다음 기능을 제공한다.

- 학습 일정 관리
- 제출과 팀 review
- Library와 team document
- Records와 Activity
- Workspace member와 설정 관리

현재 GitLab과 GitHub 로그인 및 Workspace 저장소 기능을 지원한다. Study-ing Managed Storage는 제공하지 않는다.

## 3. 무료 서비스

Study-ing은 현재 무료이며 결제, 유료 구독, 광고 기능을 제공하지 않는다. 따라서 현재 약관에는 결제·청약철회·환불 조항이 없다. 향후 유료 기능을 도입하면 적용 법령을 검토하고 약관과 개인정보 처리방침을 개정한다.

## 4. 이용 연령과 계정

1. Study-ing은 현재 만 14세 이상 사용자를 대상으로 한다.
2. 만 14세 미만 사용자를 위한 법정대리인 동의 flow는 제공하지 않는다.
3. 이용자는 자신의 GitLab 또는 GitHub account로 OAuth 인증하고 Study-ing profile을 설정한다.
4. 이용자는 자신의 계정과 인증수단을 안전하게 관리하고 타인의 계정을 무단으로 사용해서는 안 된다.
5. GitLab 연결 재승인은 기존 credential을 교체하며 Workspace repository 자체를 변경하지 않는다.
6. GitHub Connected Account 연결은 현재 Study-ing 계정에 외부 identity를 추가하는 기능이며, email·username 일치를 이유로 다른 Study-ing 계정과 자동 병합하지 않는다.

## 5. Workspace와 외부 저장소

1. Workspace는 이용자가 접근 권한을 가진 GitLab project 또는 GitHub repository와 연결된다.
2. Repository membership과 Study-ing Workspace membership은 별개다. 참여 가능한 이용자가 명시적으로 참여하면 기본 Study-ing 역할은 멤버다.
3. 이용자는 권한 있는 저장소만 연결하고 이용 중에도 필요한 Provider permission을 유지해야 한다.
4. 저장소 permission이 철회되면 private Workspace content 접근이나 제출·동기화 기능이 제한될 수 있다.
5. Workspace 역할과 외부 repository permission은 서로 다른 권한이다.

## 6. 사용자 콘텐츠와 권리

1. 제출, team document, message와 review 등 이용자가 작성한 콘텐츠의 권리는 이용자 또는 기존 권리자에게 유지된다.
2. Study-ing은 서비스 제공, 저장·동기화, 접근통제, 장애 대응에 필요한 범위에서 콘텐츠를 처리한다.
3. 운영자가 사용자 콘텐츠의 소유권을 포괄적으로 취득하지 않는다.
4. 공동 Workspace 기록은 다른 구성원의 학습 기록 무결성을 위해 account 탈퇴 후에도 익명화된 형태로 유지될 수 있다.

`[법률 검토 필요: 서비스 제공에 필요한 이용허락 범위와 권리침해 대응 절차]`

## 7. 이용자의 책임과 금지행위

이용자는 다음 행위를 해서는 안 된다.

- 타인의 account 또는 credential 무단 이용
- 권한 없는 repository·Workspace 접근이나 접근 우회 시도
- 서비스, GitLab API 또는 다른 사용자의 이용 방해
- 악성 코드, 불법 콘텐츠 또는 타인의 권리를 침해하는 콘텐츠 작성
- 허위·오해를 유발하는 방식으로 다른 구성원을 사칭하는 행위

현재 별도의 일반 관리자 ban system은 없다. 서비스 안정성이나 다른 사용자의 권리를 심각하게 침해하는 경우 필요한 최소 범위에서 접근을 제한할 수 있는 운영 원칙은 두되, 사유·통지·이의절차는 공개 전 법률 검토한다.

## 8. Account 탈퇴

1. 이용자는 Settings에서 Study-ing account를 탈퇴할 수 있다.
2. 탈퇴 시 account, OAuth credential, profile/preferences/consent, notification과 현재 session을 삭제한다.
3. 공동 콘텐츠는 임의 삭제하지 않고 Study-ing DB의 작성자 표시정보를 `탈퇴한 사용자`로 익명화할 수 있다.
4. Active Workspace의 소유자는 orphan Workspace를 방지하기 위해 먼저 Workspace를 삭제하거나 소유권을 정리해야 한다.
5. Audit event는 actor 연결을 제거한 뒤 생성일로부터 최대 180일 운영 정책에 따라 보유한다.

## 9. Workspace 삭제

1. 소유자가 Workspace를 삭제하면 Study-ing에서 soft-deleted 상태가 된다.
2. 삭제일부터 7일 동안 Workspace Hub에서 복원할 수 있다.
3. 7일이 지나면 Workspace configuration, connection metadata, settings, notification/sync data, team content와 derived/cache data를 Study-ing DB에서 정리한다.
4. Audit event는 별도의 180일 정책을 따른다.

## 10. 연결한 저장소에 남는 데이터

Study-ing account 또는 Workspace 삭제는 GitLab/GitHub repository 삭제와 다르다. 다음은 연결한 저장소에 남을 수 있다.

- schedule, submission과 repository에 작성된 team document files
- commit, author information와 Git history
- review/comment

Study-ing은 위 데이터를 account/workspace 삭제 과정에서 자동 삭제하지 않는다. 이용자는 해당 project permission과 GitLab 정책에 따라 직접 관리해야 한다.

## 11. 외부 서비스 의존성

Study-ing은 GitLab·GitHub 인증과 API에 의존한다. Provider 장애, API rate limit, 저장소 권한 변경, network failure 또는 Provider 정책 변경으로 일부 기능이 제한될 수 있다. Study-ing은 외부 Provider 자체의 가용성을 보증하지 않는다.

## 12. 서비스 변경·일시 중단·종료

Study-ing은 개인 개발 프로젝트로 운영되며 유지보수, 외부 서비스 장애 또는 운영 사정에 따라 일부 또는 전체 기능이 변경되거나 일시 중단될 수 있다.

서비스를 종료할 경우 가능한 범위에서 서비스 화면으로 사전에 알리고 Study-ing DB 데이터의 정리 일정을 안내한다. 서비스 종료만으로 GitLab repository 원본을 자동 삭제하지 않는다. 구체적인 고지 기간과 책임 범위는 공개 전 법률 검토한다.

## 13. 책임 범위

운영자는 확인된 오류와 보안 문제를 합리적인 범위에서 대응한다. 다만 외부 Provider 장애, 이용자의 permission 변경 또는 이용자가 관리하는 repository 콘텐츠로 인한 영향까지 무제한으로 보증하지 않는다.

`[법률 검토 필요: 고의·과실, 소비자 보호 규정과 충돌하지 않는 책임 제한 문구]`

## 14. 개인정보

개인정보 처리 기준은 별도의 Study-ing 개인정보 처리방침에 따른다.

- Privacy version: `2026-08-13`
- 개인정보 문의: `ho7e09152@gmail.com`

## 15. 약관 변경

- Terms version: `2026-08-13`
- 공고일: 운영자 승인 시 기록
- 시행일: `TBD`
- 변경 이력: Git version history 및 향후 공개 변경 이력

약관 변경 시 서비스 화면 등 이용자가 확인할 수 있는 방법으로 알린다. 중대한 변경의 사전 고지 기간과 재동의 기준은 법률 검토 후 확정한다.

## 16. 문의

- 운영자: `이호철` 개인 개발자
- 서비스 문의: `ho7e09152@gmail.com`
- 개인정보 문의: `ho7e09152@gmail.com`

## 17. 준거법과 분쟁 해결

대한민국 공개 서비스를 전제로 검토하되 구체적인 준거법, 분쟁 해결 방식과 관할은 전문 법률 검토 후 확정한다.
