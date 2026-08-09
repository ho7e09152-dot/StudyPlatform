# Study Workspace 프로덕션 전환 실행 계획

## 2026-08-09 구현 진행 상태

- 완료: Spring Security 세션 인증, CSRF, Workspace 활성 멤버 경계
- 완료: 운영 모드 seed fallback 제거와 명시적 demo mode 분리
- 완료: OAuth Bearer 기반 프로젝트 검색·접근 재검증·첫 Workspace UI
- 완료: 최초 가입 프로필, 사용자 지정 표시 이름·GitLab 기록 파일명, 약관 버전·동의 시각 저장
- 완료: 기존 저장소 읽기 전용 분석, 5단계 분류, tree fingerprint 재검증과 `.study-workspace` 격리 초기화
- 완료: GitLab 일정·제출 파일명, 문서 작성자와 commit `author_name`에 사용자 지정 이름 적용
- 완료: Flyway 사용자/credential/Workspace 메타데이터 스키마, AES-GCM token 암호화, Spring Session JDBC
- 완료: Workspace/member/settings/cache 상태의 PostgreSQL repository 전환과 기존 로컬 JSON 자동 1회 migration
- 완료: 저장소 tree·텍스트 파일 읽기의 OAuth Bearer 전환
- 완료: 일정 생성·수정·취소의 OAuth Bearer GitLab 커밋과 `last_commit_id` 충돌 방지
- 완료: GitLab `session.yml` 안전 parser/import와 원본 기반 부분 실패 재동기화
- 완료: 제출 쓰기 API의 OAuth Bearer 전환, 멤버 Markdown 커밋과 원본 재동기화
- 완료: OAuth token의 JDBC session 제거와 암호화 credential 조회/회전
- 완료: GitLab 멤버 후보·동기화, Owner/Manager/Member 역할, 마지막 Owner 보호
- 완료: sync job/부분 실패 UI, 인앱 알림, 감사 로그
- 완료: 7일 소프트 삭제/복원/만료 정리와 계정 탈퇴 시 개인정보 익명화
- 완료: backend Dockerfile, production profile, request ID/structured logs, metrics/tracing, rate limit, backup/restore runbook
- 외부 배포 시 필요: public HTTPS 도메인, GitLab OAuth callback 등록, managed PostgreSQL/secret manager, staging 실제 사용자 E2E

## 목표

다음 세로 흐름을 실제 GitLab 데이터로 완성한다.

```text
GitLab OAuth 로그인
→ 사용자 계정 생성
→ 접근 가능한 프로젝트 선택
→ Workspace 생성/가져오기
→ 실제 session.yml 조회·생성
→ 본인 Markdown 제출
→ 실제 GitLab commit SHA 확인
→ 기록·점수 재계산
```

## 권장 기본 결정

- GitLab 저장소가 일정·제출의 원본이다.
- DB에는 사용자, 암호화 OAuth credential, Workspace 연결, 멤버십, sync 상태만 저장한다.
- 일반 멤버도 일정은 관리할 수 있지만 프로젝트 재연결·멤버 제거·Workspace 삭제는 Owner/Manager로 제한한다.
- production에서는 seed fallback을 금지하고 demo를 별도 mode/route로 격리한다.
- 가능하면 프론트와 API를 같은 site에서 제공하고 `/api` reverse proxy를 사용한다.

## 전체 일정 추정

- 총량: 32~46 person-days
- 1인 개발: 약 8~12주
- 3인 팀: 공통 기반 이후 병렬 작업 시 약 4~6주
- UI 재디자인은 포함하지 않는다. 현재 UI를 재사용한다.

## Phase 0 — 정책과 계약 고정

예상: 1~2일

### 작업

- 사용자 역할을 `OWNER`, `MANAGER`, `MEMBER`로 확정
- 기존 저장소 import와 신규 구조 초기화 정책 확정
- GitLab 지원 구조와 허용 파일 경로 확정
- demo/production 모드 정책 확정
- OpenAPI에서 목표 계약과 실제 구현 상태를 분리
- 오류 코드와 401/403/409/429 프론트 행동 확정

### 완료 조건

- 한 장의 사용자 흐름과 상태 전이가 합의됨
- 모든 P0 endpoint 요청·응답이 OpenAPI에 있음
- `member-a`, 공용 PAT, seed fallback 제거 기준이 문서화됨

## Phase 1 — P0 인증과 데이터 경계

예상: 3~5일

### 백엔드

- Spring Security 추가
- `/api/v1/auth/**`, actuator health 외 API 보호
- CSRF 정책 구현
- `CurrentUser`와 request authentication principal 구현
- `WorkspaceAccessService.requireActiveMember` 구현
- 모든 Workspace API에 인증·멤버십 검증 적용
- 소프트 삭제 Workspace의 일반 접근 차단
- GitLab PAT 진단 endpoint를 dev profile로 제한

### 프론트엔드

- 앱 시작 시 `/auth/me`를 호출하는 `AuthProvider` 구현
- 미로그인 사용자를 `/login`으로 이동
- 401/403 공통 처리
- 로딩 중 seed 화면을 먼저 보여주지 않도록 bootstrap 화면 추가
- production에서 API 실패 시 seed fallback 금지
- demo는 `/demo` 또는 명시적인 demo mode로 분리

### 테스트

- 비로그인 protected endpoint 전체 401
- Workspace 비멤버 403
- User A가 User B Workspace ID로 접근할 수 없음
- production API 장애가 demo 데이터로 바뀌지 않음

### 완료 조건

- 인증 없는 브라우저에서 `/today` 진입 불가
- 인증 없는 `/workspaces` 요청이 401
- 현재 사용자 ID를 하드코딩하지 않음

## Phase 2 — 영속 사용자·OAuth credential·세션

예상: 4~6일

### 데이터 모델

- `users`
- `oauth_credentials`
- `workspaces`
- `workspace_members`
- `terms_acceptances` 또는 User 동의 필드
- `sync_jobs`
- `notification_preferences`

### 백엔드

- Spring Data JPA, PostgreSQL, Flyway 추가
- OAuth callback에서 GitLab user ID 기준 User upsert
- refresh token rotation과 만료 처리
- token 암호화 Port와 실제 adapter
- Redis/Spring Session 또는 합의된 세션 전략 적용
- logout/revoke, account disconnect 구현
- cookie `Secure`, proxy, SameSite를 환경별로 검증

### 테스트

- callback 재로그인 시 같은 User 갱신
- 서버 재시작 후 세션 정책 검증
- refresh 성공/실패/재동의
- token이 API 응답과 로그에 나타나지 않음

### 완료 조건

- OAuth 사용자가 demo member를 덮어쓰지 않음
- 사용자와 credential이 DB에 안전하게 저장됨
- 다중 인스턴스에서도 세션이 일관됨

## Phase 3 — OAuth GitLab Client와 온보딩

예상: 5~7일

### 백엔드

- `GitLabTokenProvider.getValidAccessToken(userId)` 구현
- Repository client를 `Authorization: Bearer` 방식으로 전환
- `GET /gitlab/projects` 검색·페이지네이션 구현
- project connection-check 구현
  - 현재 사용자 접근 여부
  - access level
  - default branch
  - protected branch/write 가능 여부
- Workspace 프로젝트 중복 연결 검증
- Workspace 생성 idempotency 적용
- 기존 저장소 구조 scan/import API 구현
- initial sync job과 상태 API 구현

### 프론트엔드

- 첫 로그인 신규 사용자 분기
- 프로젝트 검색/선택 UI
- 권한과 기본 브랜치 결과 UI
- `기존 구조 가져오기` / `새 구조 만들기` 선택
- Workspace 이름·timezone 확인
- 초기 sync 진행률·성공·부분 실패 화면
- Workspace 0개 empty state와 새 Workspace CTA

### 완료 조건

- PAT 없이 현재 사용자의 프로젝트 목록이 표시됨
- 선택한 Workspace와 저장소 화면 프로젝트가 동일함
- 다른 사용자의 프로젝트를 공용 credential로 조회하지 않음

## Phase 4 — 실제 GitLab 일정 세로 기능

예상: 4~6일

### 백엔드

- `session.yml` parser/serializer 구현
- 날짜 폴더 tree 조회와 Session 목록 구성
- 일정 생성 시 GitLab file create
- 수정/취소 시 최신 file 조회와 `last_commit_id` 적용
- revision, 변경 사유, archived item 검증
- YAML 오류·외부 변경·보호 브랜치 오류 매핑
- 성공 후 cache invalidation

### 프론트엔드

- 현재 일정 UI를 실제 API 응답에 연결
- loading/empty/invalid YAML 상태
- 409 최신 버전 불러오기와 충돌 안내
- 실제 commit SHA와 GitLab 링크 표시

### 완료 조건

- 새 일정 생성 후 실제 프로젝트에 `YYMMDD/session.yml` 존재
- GitLab에서 외부 수정 후 앱 저장 시 덮어쓰지 않고 409
- 서버 로컬 JSON을 일정 원본으로 사용하지 않음

## Phase 5 — 실제 제출과 commit

예상: 5~7일

### 백엔드

- 멤버 Markdown front matter parser/serializer 구현
- 현재 로그인 사용자 → Workspace member → file path 결정
- 한 item만 안전하게 merge
- 파일이 없으면 create, 있으면 update
- `last_commit_id`, session revision, submit type 검증
- link/text/code 길이와 commit message 검증
- 같은 item 충돌과 다른 item 동시 변경 정책 구현
- 실제 commit SHA와 web URL 반환

### 프론트엔드

- 현재 제출 modal을 실제 API 결과에 연결
- 저장 단계와 실제 commit 결과 표시
- 401/403/409/429/5xx 복구 UI
- 제출 삭제·수정과 충돌 해결 UI

### 완료 조건

- User A 제출이 User A 파일에만 기록됨
- User B 파일 수정 시도는 403
- 실제 GitLab commit 작성자가 로그인 사용자로 확인됨
- 성공 UI의 SHA가 GitLab과 일치함

## Phase 6 — 원본 기반 통계·동기화·멤버 관리

예상: 4~6일

### 백엔드

- GitLab Session/제출 파일에서 dashboard/records/scores 계산
- 짧은 TTL cache와 commit 후 무효화
- 부분 파일 실패 정책과 data quality 정보
- GitLab 프로젝트 멤버 후보·동기화
- 접근 권한 상실과 복구 처리
- sync job 이력과 실패 사유 저장

### 프론트엔드

- 기록 화면을 records/scores API와 연결
- 마지막 계산·동기화 시각 표시
- 부분 실패/제외 파일 경고
- 멤버 후보·파일명 매핑·접근 상실 UI
- sync center 구현
- 실제 날짜와 Workspace timezone 사용

### 완료 조건

- 프론트가 전체 Workspace 객체로 통계를 자체 계산하지 않음
- GitLab 파일 변경 후 동기화하면 통계가 재계산됨
- 일부 파일 오류가 전체 화면의 거짓 성공으로 숨지 않음

## Phase 7 — 관리·복구·제품 신뢰

예상: 3~5일

### 작업

- 역할별 설정 권한
- 프로젝트 재연결과 OAuth reconnect
- 삭제된 Workspace 7일 복원
- 계정 연결 해제·회원 탈퇴
- 약관·개인정보 처리방침
- browser confirm/alert를 제품 modal로 교체
- 접근성 대비, keyboard, screen reader, 200% zoom 점검
- 알림 기능은 실제 채널을 구현하거나 출시 범위에서 제거

### 완료 조건

- 위험 작업이 권한과 재확인을 거침
- 삭제·복원·탈퇴 데이터 정책이 실제 동작과 문구가 일치함
- 설정 화면에 스텁 동작이 남지 않음

## Phase 8 — 배포와 출시 게이트

예상: 4~6일

### 배포

- 백엔드 Dockerfile과 production profile
- API hosting, HTTPS, public callback URL
- managed PostgreSQL/Redis
- Secret Manager/KMS
- Flyway migration job
- frontend `/api` proxy 또는 production API base URL
- CORS/CSRF/cookie production 설정

### 운영

- structured logging과 request ID
- metrics, tracing, alert
- GitLab 401/403/429/5xx 관측
- DB backup/restore runbook
- token/client secret 로그 검사
- readiness/liveness 분리

### 출시 테스트

- 가입 → 프로젝트 선택 → Workspace 생성 → 첫 일정 → 첫 제출 → GitLab commit E2E
- 두 사용자 데이터 격리 E2E
- OAuth revoke/reconnect E2E
- 외부 변경/충돌 E2E
- server restart/multi-instance session E2E
- accessibility smoke test

### 완료 조건

- audit의 모든 P0 항목 해소
- staging E2E 반복 통과
- production smoke test와 rollback 절차 확인

## 처음 시작할 10개 티켓

1. `SEC-001` Spring Security와 protected route 정의
2. `SEC-002` WorkspaceAccessService와 멤버십 403
3. `FE-001` AuthProvider와 앱 bootstrap gate
4. `DEMO-001` production seed fallback 제거와 demo 격리
5. `DB-001` User/OAuth/Workspace Flyway schema
6. `AUTH-001` callback User upsert와 principal 연결
7. `AUTH-002` token encryption/refresh/session 저장
8. `GL-001` OAuth Bearer GitLab client
9. `GL-002` 현재 사용자의 프로젝트 목록/검사 API
10. `E2E-001` 두 사용자 인증·Workspace 격리 테스트

## 첫 번째 검증 가능한 목표

첫 구현 배치는 다음 결과까지만 목표로 한다.

```text
OAuth 로그인
→ DB 사용자 생성
→ /auth/me 성공
→ 본인에게 속한 Workspace만 조회
→ 비로그인 401
→ 다른 사용자 Workspace 403
→ production seed fallback 없음
```

이 목표가 통과하기 전에는 일정·제출 GitLab 쓰기 구현을 시작하지 않는다.
