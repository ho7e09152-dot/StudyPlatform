# 팀원 1 — 인증·Workspace

> 처음 구현하는 사람은 요구사항을 읽은 뒤 [팀원 1 초심자 구현 핸드북](guides/member-1-auth-workspace-handbook.md)을 순서대로 따라가세요. 핸드북에는 정확한 클래스·패키지, UML, ERD, 구현 단계, 코드 뼈대와 테스트 표가 포함되어 있습니다.

> [프로젝트 README로 돌아가기](../README.md)

## 역할 목표

사용자가 GitLab 계정으로 안전하게 로그인하고, 접근 가능한 프로젝트를 선택해 Study Workspace와 연결할 수 있는 기반을 구현합니다.

이 영역은 다른 모든 백엔드 기능의 출발점입니다. 팀원 2와 팀원 3은 직접 OAuth 토큰을 다루지 않고, 이 영역에서 제공하는 현재 사용자와 Workspace 접근 검증 결과를 사용합니다.

## 주요 책임

- GitLab OAuth 로그인·콜백·로그아웃
- 로그인 사용자 조회와 앱 사용자 생성·갱신
- access token과 refresh token 암호화 저장
- 만료 전 토큰 갱신
- 서버 세션과 HttpOnly 쿠키
- 사용자가 접근 가능한 GitLab 프로젝트 목록
- 프로젝트 연결 가능 여부 확인
- Workspace 생성·조회·수정·소프트 삭제·복구
- GitLab 프로젝트 멤버 후보 조회
- Workspace 멤버십 생성과 동기화
- 앱 권한과 GitLab access level 구분
- Workspace 접근 인가와 감사 로그

## 담당 API 초안

### 인증

| Method | Endpoint | 설명 |
|---|---|---|
| GET | `/api/v1/auth/gitlab/login` | OAuth 인증 시작 |
| GET | `/api/v1/auth/gitlab/callback` | code와 state 검증 및 로그인 완료 |
| GET | `/api/v1/auth/me` | 현재 로그인 사용자와 Workspace 목록 |
| POST | `/api/v1/auth/logout` | 앱 세션 종료 |

### GitLab 프로젝트

| Method | Endpoint | 설명 |
|---|---|---|
| GET | `/api/v1/gitlab/projects` | 현재 사용자가 접근 가능한 프로젝트 |
| GET | `/api/v1/gitlab/projects/{projectId}/connection-check` | 브랜치·권한·Repository API 연결 검사 |
| GET | `/api/v1/gitlab/projects/{projectId}/members` | Workspace 멤버 후보 |

### Workspace

| Method | Endpoint | 설명 |
|---|---|---|
| GET | `/api/v1/workspaces` | 내 Workspace 목록 |
| POST | `/api/v1/workspaces` | 프로젝트와 멤버를 선택해 Workspace 생성 |
| GET | `/api/v1/workspaces/{workspaceId}` | Workspace 상세 |
| PATCH | `/api/v1/workspaces/{workspaceId}` | 이름과 설정 수정 |
| DELETE | `/api/v1/workspaces/{workspaceId}` | 7일 복구 가능한 소프트 삭제 |
| POST | `/api/v1/workspaces/{workspaceId}/restore` | 소프트 삭제 복구 |
| POST | `/api/v1/workspaces/{workspaceId}/members/sync` | GitLab 멤버 상태 동기화 |

## 핵심 데이터 모델

### User

```text
id
gitlab_user_id
username
display_name
avatar_url
commit_email
created_at
updated_at
```

GitLab 사용자를 식별할 때 변경 가능한 username이 아니라 숫자 `gitlab_user_id`를 기준으로 합니다.

### OAuthCredential

```text
user_id
encrypted_access_token
encrypted_refresh_token
expires_at
scope
updated_at
```

토큰은 AES-GCM과 같은 인증된 암호화 방식으로 저장합니다. Client Secret과 토큰 원문을 로그에 남기지 않습니다.

### Workspace

```text
id
name
gitlab_project_id
gitlab_project_path
default_branch
status
deleted_at
created_at
updated_at
```

같은 GitLab 프로젝트에 활성 Workspace가 중복 연결되지 않도록 DB 제약과 서비스 검증을 함께 적용합니다.

### WorkspaceMember

```text
workspace_id
user_id
gitlab_access_level
status
joined_at
updated_at
```

GitLab 접근 권한을 잃은 사용자는 과거 기록을 삭제하지 않고 `PROJECT_ACCESS_LOST` 상태로 전환합니다.

## GitLab API 사용 범위

```text
GET /api/v4/user
GET /api/v4/projects?membership=true
GET /api/v4/projects/:id
GET /api/v4/projects/:id/members/all
GET /api/v4/projects/:id/members/all/:user_id
POST /oauth/token
```

Repository tree와 파일 읽기·쓰기는 공통 GitLab 클라이언트에서 제공하지만, 기능 API의 소유권은 팀원 2와 팀원 3에게 있습니다.

## 패키지 구조 예시

```text
backend/src/main/java/.../
├── auth/
│   ├── controller/
│   ├── service/
│   ├── domain/
│   └── infrastructure/
├── workspace/
│   ├── controller/
│   ├── service/
│   ├── domain/
│   └── infrastructure/
└── security/
    ├── CurrentUser.java
    ├── SessionConfig.java
    └── TokenCipher.java
```

## 구현 순서

### 1. 연결 스파이크

- 테스트용 PAT를 서버 환경변수에만 설정
- `/user` 호출로 GitLab 서버 연결과 인증 확인
- 프로젝트 목록과 프로젝트 상세 조회
- 테스트 프로젝트의 기본 브랜치와 권한 확인

이 단계의 PAT는 연결 검증용이며 프론트엔드에 노출하거나 DB에 저장하지 않습니다.

### 2. OAuth 로그인

- 사내 GitLab 또는 GitLab.com에 OAuth Application 등록
- OAuth state 생성과 5~10분 TTL 적용
- callback에서 state와 Redirect URI 검증
- code를 access token으로 교환
- `/user` 결과로 앱 사용자 upsert
- HttpOnly 세션 쿠키 발급

### 3. 토큰 저장과 갱신

- 토큰 암호화 컴포넌트 작성
- access token 만료 60초 전 갱신
- 동일 사용자의 동시 refresh 방지
- refresh 실패 시 세션 종료와 명확한 오류 반환

### 4. Workspace 연결

- 접근 가능한 프로젝트 목록 제공
- connection-check 구현
- 선택 멤버가 실제 프로젝트 멤버인지 확인
- Workspace와 멤버십 트랜잭션 생성
- 중복 프로젝트 연결 방지

### 5. 멤버 동기화와 운영 기능

- GitLab 유효 멤버와 앱 멤버십 비교
- 신규 후보·접근 상실·현재 활성 인원 반환
- Workspace 소프트 삭제와 복구
- 주요 관리 작업 감사 로그 기록

## 보안 체크리스트

- [ ] 브라우저와 프론트엔드 저장소에 GitLab 토큰이 존재하지 않음
- [ ] OAuth `state`를 일회성으로 검증
- [ ] callback Redirect URI를 고정
- [ ] `returnUrl`은 앱 내부 경로만 허용
- [ ] 세션 쿠키에 `HttpOnly`, `Secure`, `SameSite` 적용
- [ ] 토큰과 Client Secret 로그 마스킹
- [ ] Workspace ID를 기준으로 연결 프로젝트를 서버에서 조회
- [ ] API마다 Workspace 활성 멤버 여부 확인
- [ ] 소프트 삭제된 Workspace의 일반 API 접근 차단
- [ ] 토큰 암호화 키를 코드와 Git에서 분리

## 테스트 항목

### 단위 테스트

- OAuth state 생성·만료·재사용 방지
- 토큰 암호화 후 복호화
- 내부 경로와 외부 `returnUrl` 구분
- GitLab access level 변환
- Workspace 중복 연결 검증
- 소프트 삭제와 복구 기한 계산

### 통합 테스트

- OAuth callback 성공·state 불일치
- 로그인 후 `/auth/me` 조회
- 만료 토큰 refresh 성공·실패
- 프로젝트 목록과 connection-check
- 프로젝트 비멤버 연결 거부
- Workspace 생성 트랜잭션 롤백
- 멤버 동기화 시 접근 상실 상태 반영

### 권한 테스트

- 비로그인 사용자 401
- Workspace 비멤버 403
- GitLab 프로젝트 접근 상실 403
- 삭제된 Workspace 접근 차단

## 다른 역할에 제공할 계약

### CurrentUser

```java
public record CurrentUser(
    UUID userId,
    long gitLabUserId,
    String username
) {}
```

### WorkspaceAccessService

```java
WorkspaceContext requireActiveMember(UUID workspaceId, UUID userId);
```

반환되는 `WorkspaceContext`에는 서버가 확인한 프로젝트 ID, 기본 브랜치와 멤버 상태가 포함됩니다. 팀원 2와 팀원 3은 프론트에서 받은 프로젝트 ID를 직접 신뢰하지 않습니다.

### GitLabTokenProvider

```java
String getValidAccessToken(UUID userId);
```

실제 구현에서는 토큰 원문이 서비스 전체로 퍼지지 않도록 공통 GitLab 클라이언트 내부에서만 사용하는 형태를 우선 고려합니다.

## 완료 기준

- [ ] GitLab 로그인 후 앱 사용자와 세션이 생성됨
- [ ] 사용자가 접근 가능한 프로젝트를 조회할 수 있음
- [ ] 테스트 프로젝트의 연결 가능 여부를 검사할 수 있음
- [ ] 프로젝트와 선택 멤버로 Workspace를 만들 수 있음
- [ ] 다른 역할 API에서 현재 사용자와 Workspace 접근을 검증할 수 있음
- [ ] access token이 만료되면 안전하게 갱신됨
- [ ] 핵심 성공·실패 흐름에 테스트가 작성됨
- [ ] OpenAPI와 환경변수 예시가 문서화됨

## 포트폴리오에 정리할 내용

- Self-Managed GitLab OAuth를 Spring Security에 연결한 과정
- OAuth state와 서버 세션을 선택한 이유
- 토큰 암호화와 키 관리 방식
- Workspace와 GitLab 프로젝트의 권한 차이
- 토큰 refresh 동시성 문제 해결
- 프로젝트 연결 검사와 중복 방지 정책
