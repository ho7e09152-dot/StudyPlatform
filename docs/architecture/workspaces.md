# Workspace와 Membership

## Domain 경계

- Workspace는 하나의 normalized `RepositoryConnection`에 연결됩니다.
- Repository identity uniqueness는 `(provider, externalRepositoryId)`로 보장합니다.
- `OWNER`, `MANAGER`, `MEMBER`는 Study-ing 역할이며 Provider permission과 다릅니다.
- Repository membership은 Workspace 가입 자격의 근거지만 자동 가입을 의미하지 않습니다.
- Soft-deleted Workspace는 일반 조회, Discovery와 Join 대상이 아닙니다.

## Discovery와 Join

GitLab 기준 Discovery는 현재 사용자가 접근 가능한 project 목록과 활성 RepositoryConnection을 external project ID로 서버에서 bulk matching합니다. Frontend가 path 문자열을 비교하거나 client가 전달한 role/permission을 신뢰하지 않습니다.

```text
Provider accessible repositories
∩ active Study-ing repository connections
− current active memberships
= discoverable Workspaces
```

사용자가 `참여하기`를 선택하면 서버가 Repository access를 다시 확인한 후 Study-ing `MEMBER`로 등록합니다. GitLab Maintainer라도 `MANAGER`나 `OWNER`로 자동 승격하지 않습니다. 중복 Join은 같은 membership을 반환하며 DB uniqueness가 동시 요청의 중복 row를 막습니다.

## 현재 GitLab permission 정책

현재 제품은 Workspace Member를 실제 제출 참여자로 봅니다.

| Capability | Minimum GitLab permission | Study-ing role |
|---|---:|---|
| Discover and join | Developer (30) | Join 결과는 항상 `MEMBER` |
| 이미 가입한 private Workspace 읽기 | 현재 확인된 project access | Active membership |
| 일정·제출 등 Repository write | Developer (30), 실제 write 시 재검증 | Action별 app role 추가 적용 |
| 일정·설정 관리 | Repository write capability | `OWNER` 또는 `MANAGER` |
| Workspace 삭제 | 현재 Repository access | `OWNER` |

향후 별도 Viewer/read-only 역할을 도입하면 Reporter 지원을 검토할 수 있지만, 현재 UI에서 이를 흉내 내지 않습니다.

## 접근 권한 재검증

- Login/bootstrap: 접근 가능한 GitLab project를 한 번 가져와 Workspace와 bulk matching합니다.
- Workspace switch 및 scoped access: server-side 5분 verification TTL을 사용합니다.
- Selected Workspace: switch 시 Repository 상태를 즉시 확인합니다.
- Repository write: Schedule, Submission, Review, Sync와 Migration이 Provider에 실제 요청하여 최신 write permission을 확인합니다.

확인된 403 또는 project absence는 `REPOSITORY_ACCESS_REVOKED`로 처리하고 private Workspace content를 차단합니다. Timeout, 429와 5xx는 `REPOSITORY_PROVIDER_UNAVAILABLE`이며 membership revoke로 저장하지 않습니다. Provider 장애 중 검증이 필요한 private content는 503으로 실패하고 기존 membership과 기록은 유지합니다.

## Workspace 범위 상태

Join 또는 switch 후 Frontend는 current Workspace를 먼저 갱신하고 Workspace list, Repository status, Today, Schedule, Library, Records, Settings와 Activity의 workspace-scoped query를 무효화합니다. 이전 Workspace 데이터를 새 Workspace 상태로 표시하거나 전체 page reload에 의존해서는 안 됩니다.

## Membership 생명주기

- Repository 접근 철회 또는 관리자의 비활성화는 account 삭제와 다릅니다.
- 비활성 membership의 과거 제출·review attribution은 유지합니다.
- 접근 권한이 복구되면 기존 membership identity를 재사용합니다.
- Repository Member 전체를 자동으로 Study-ing Member로 생성하지 않습니다.

## Workspace 삭제

Workspace 삭제는 Day 0에 soft delete하며 Owner가 7일 동안 복원할 수 있습니다. 이후 retention cleanup이 Study-ing-managed Workspace data와 connection/cache를 정리합니다. GitLab Repository, file과 commit history는 삭제하지 않습니다.

## 제외 범위

- Invite code, email invite와 automatic enrolment
- Workspace leave
- GitHub Repository 기반 Discovery/Join
- Study-ing Managed Storage eligibility
