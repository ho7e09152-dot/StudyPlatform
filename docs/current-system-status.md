# 현재 시스템 상태

기준일: 2026-08-11

## 한 줄 요약

GitLab OAuth 로그인부터 프로젝트 연결, 일정·제출 commit, 팀 리뷰·피드·문서까지 P0 사용자 흐름이 구현되어 있다. 자동 테스트는 통과했으며 production 승격 전 실제 HTTPS 스테이징에서 두 GitLab 계정 E2E가 남아 있다.

## 현재 사용자 흐름

```text
GitLab OAuth 로그인
→ 최초 프로필과 표시 이름 입력
→ 접근 가능한 프로젝트 검색
→ 빈/기존 저장소 읽기 전용 분석
→ Workspace 생성 또는 가져오기
→ 일정 session.yml 생성
→ 본인 제출 Markdown commit
→ 팀원 제출 열람과 GitLab commit comment 리뷰
→ DB 기반 공지·대화와 팀 문서 사용
```

## 데이터 저장 위치

| 데이터 | 원본 저장소 | 설명 |
|---|---|---|
| 일정, 학습 항목 | GitLab `session.yml` | DB에는 화면 조회와 장애 복구용 동기화 cache 저장 |
| 개인 제출 | GitLab 멤버 Markdown | 로그인 사용자의 OAuth 계정으로 commit |
| 제출 리뷰 | GitLab 최신 제출 commit comment | 알림과 감사 이벤트는 DB 저장 |
| 사용자·프로필 | PostgreSQL | GitLab ID, 표시 이름, 테마, 약관 동의 |
| OAuth credential | PostgreSQL | AES-GCM 암호화 access/refresh token |
| 로그인 세션 | Spring Session JDBC | 브라우저에는 HttpOnly session cookie만 저장 |
| Workspace·멤버·설정 | PostgreSQL | 프로젝트 연결, 역할, sync와 soft delete 상태 |
| 팀 공지·메시지 | PostgreSQL | GitLab commit을 만들지 않는 대화 데이터 |
| 팀 문서 | PostgreSQL | Markdown, 작성자 전용 수정, optimistic lock |
| 알림·감사 로그 | PostgreSQL | 제출 리뷰, 공지, 문서 생성과 운영 이벤트 |

## 저장소 구조

신규 Workspace는 다음 경로를 사용한다.

```text
.study-workspace/
  config.yml
  sessions/{YYYY}/{YYYY-MM-DD}/
    session.yml
    submissions/{사용자-지정-이름}.md
```

기존 `YYMMDD/session.yml` 구조는 계속 지원한다. Owner가 설정에서 명시적으로 실행할 때만 tree fingerprint와 충돌을 검사한 뒤 단일 GitLab commit으로 V2 구조에 이동한다.

## 권한

- 활성 멤버만 Workspace 데이터를 읽고 쓸 수 있다.
- 일정과 본인 제출은 서비스 정책과 실제 GitLab 권한을 모두 통과해야 한다.
- 프로젝트 연결, 역할, 공지와 Workspace 삭제는 Owner/Manager 정책을 적용한다.
- 팀 문서는 만든 사람만 수정·삭제한다. Owner/Manager도 다른 작성자의 본문을 대신 수정하지 않는다.
- 오래된 revision, document version 또는 `last_commit_id` 요청은 덮어쓰지 않고 409로 거부한다.

## 자동 검증 상태

- Spring 전체 테스트
- 프론트 ESLint, production build, server-render route test
- Playwright: 오늘 제출·피드·활동함, 팀 문서 권한, 일정 검색·설정 격리
- OpenAPI lint, production dependency audit, secret 기본 검사
- production Compose 구문 검사
- 빈 DB Flyway V1~V9 적용
- staging readiness·401·OAuth authorize redirect 사전 점검

실행 명령은 [CI 가이드](ci-guide.md)를 따른다.

## 출시 전에 남은 외부 검증

- public HTTPS 프론트·API 주소 확정
- GitLab Application Redirect URI 정확히 등록
- managed PostgreSQL과 Secret Manager 설정
- 실제 GitLab 사용자 A/B 가입·제출·리뷰·문서 권한 확인
- OAuth 철회·재연결과 서버 재시작 세션 유지 확인
- 외부 commit 충돌, GitLab 429/5xx 복구 확인
- PostgreSQL backup/restore 리허설

구체적인 승인 순서는 [스테이징 OAuth E2E 체크리스트](staging-e2e-checklist.md)를 사용한다.

## 제품 기능 다음 순서

1. 외부 스테이징 승인과 첫 배포
2. 피드 답글·멘션·반응·SSE
3. 리뷰 요청·미확인 수·해결 상태
4. 문서 댓글·태그·즐겨찾기·버전 복원
5. 기존 수동 저장소 변환 mapping/diff/Merge Request 흐름

세부 P1/P2 범위는 [todo.md](../todo.md)에 유지한다.
