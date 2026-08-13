# Workspace Discovery / Join

The current membership and revalidation policy is documented in [`workspace-membership.md`](./workspace-membership.md).

## 현재 Domain

- Workspace 원본 상태는 `workspace_metadata.state_json`과 `WorkspaceState`에 저장된다.
- Repository 연결은 현재 GitLab project ID를 사용하며 DB unique constraint로 Workspace와 1:1이다.
- Study-ing 역할은 `OWNER`, `MANAGER`, `MEMBER`이고 Repository access level과 독립적이다.
- Soft Delete Workspace는 7일 복원 정책을 사용하며 Discovery에서 제외된다.
- OAuth credential은 서버 DB에 암호화 저장되고, Join은 현재 로그인 세션의 credential만 사용한다.

## 정책

- Discovery: 접근 가능한 GitLab 프로젝트 목록과 활성 Repository Connection을 external project ID로 bulk matching한다.
- Join 최소 권한: GitLab Developer(30) 이상.
- Submission 최소 권한: GitLab Developer(30) 이상. 현재 제출이 사용자의 OAuth credential로 Repository에 commit되므로 Join 이후 즉시 제출할 수 없는 상태를 만들지 않는다.
- 관리자 기능: Study-ing의 `OWNER` 또는 `MANAGER` 역할로 결정하며 GitLab Maintainer 여부로 자동 승격하지 않는다.
- Join 역할: 서버가 항상 `MEMBER`로 결정한다.
- Join은 실행 시 Repository 권한을 다시 조회하고, 같은 사용자의 중복 요청은 동일 멤버를 반환한다.
- 신규 Workspace 생성은 생성자만 소유자로 등록한다. GitLab 멤버 전체 자동 가입은 하지 않는다.

## 기존 멤버와 Repository 권한 변경

현재 Workspace Membership은 Repository Membership과 별도 상태로 유지된다. 기존 멤버의 GitLab 접근 상실은 관리자 `GitLab 멤버 동기화`에서 `PROJECT_ACCESS_LOST`로 반영되고, GitLab 쓰기 작업도 Provider가 다시 권한을 검증한다. Discovery 결과는 매 조회와 Join 시점에 새로 검증하며 장기 멤버십 cache를 추가하지 않았다.

로그인·Workspace 전환 시 모든 기존 멤버를 자동 비활성화하는 정책은 이번 Join 기능에 포함하지 않았다. Provider 일시 장애가 기존 Workspace 읽기까지 차단하지 않도록 하기 위함이다. 더 엄격한 private Repository 열람 정책이 필요하면 짧은 TTL의 Repository access attestation과 별도 reconnect/outage 상태가 후속으로 필요하다.

## 지원하지 않는 기능

- Invite token / email invite
- Repository 멤버 자동 Join
- Workspace 나가기
- GitHub / Study-ing Managed Storage용 eligibility strategy
- Join 알림. Audit API가 존재하므로 `WORKSPACE_MEMBER_JOINED` event만 기록한다.
