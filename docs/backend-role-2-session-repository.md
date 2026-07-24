# 팀원 2 — 일정·저장소

> [프로젝트 README로 돌아가기](../README.md)

## 역할 목표

GitLab 저장소에 저장된 날짜별 `session.yml`을 학습 일정으로 변환하고, 웹에서 생성·수정한 일정을 다시 안전하게 커밋합니다. 저장소 tree와 파일 조회 API도 담당해 프론트엔드 저장소 화면에 실제 GitLab 데이터를 제공합니다.

## 주요 책임

- 날짜별 Session 목록과 상세 조회
- 일정 생성·수정·취소
- 여러 학습 항목의 추가·수정·교체·순서 변경
- 1차·2차 마감 검증
- `session.yml` 파싱과 직렬화
- Session revision 관리
- GitLab `last_commit_id` 기반 충돌 방지
- 이미 제출된 일정 변경 시 경고와 변경 사유 검증
- repository tree 조회
- 허용된 파일의 내용·커밋·GitLab URL 조회
- YAML 형식 오류와 GitLab 오류를 도메인 오류로 변환

## 담당 API 초안

### Session

| Method | Endpoint | 설명 |
|---|---|---|
| GET | `/api/v1/workspaces/{workspaceId}/sessions` | 기간·유형·상태별 일정 목록 |
| GET | `/api/v1/workspaces/{workspaceId}/sessions/{date}` | 특정 날짜 일정 |
| POST | `/api/v1/workspaces/{workspaceId}/sessions` | 새 일정과 `session.yml` 생성 |
| PUT | `/api/v1/workspaces/{workspaceId}/sessions/{date}` | revision 검증 후 일정 수정 |
| DELETE | `/api/v1/workspaces/{workspaceId}/sessions/{date}` | 파일 삭제 대신 cancelled 처리 |

### Repository

| Method | Endpoint | 설명 |
|---|---|---|
| GET | `/api/v1/workspaces/{workspaceId}/repository/tree` | 연결 프로젝트의 tree |
| GET | `/api/v1/workspaces/{workspaceId}/repository/file` | 허용 파일 내용과 커밋 정보 |

## Session 저장 형식

```yaml
version: 1
revision: 3
date: 2026-07-23
type: algorithm
title: 큐와 배열 집중 학습
description: 풀이를 작성하고 링크를 항목별로 제출합니다.
status: active
deadline: 2026-07-23T23:59:00+09:00
secondaryDeadline: 2026-07-24T23:59:00+09:00

updatedAt: 2026-07-23T00:05:00+09:00
updatedBy:
  username: gitlab-user-b

items:
  - id: item-a8f11c
    order: 1
    title: 행렬 테두리 회전하기
    source: programmers
    url: https://...
    submitType: link
    required: true
    status: active
```

일정 데이터는 DB에 이중 저장하지 않습니다. 파싱 결과를 짧게 캐시할 수 있지만 GitLab에서 언제든 다시 구성할 수 있어야 합니다.

## 핵심 도메인 규칙

### 날짜와 경로

```text
API 날짜: 2026-07-23
GitLab 폴더: 260723
Session 파일: 260723/session.yml
```

- 서버가 날짜를 폴더명으로 변환합니다.
- 프론트가 전달한 임의 파일 경로를 일정 쓰기에 사용하지 않습니다.
- 날짜 형식과 timezone을 명시적으로 검증합니다.

### 학습 항목

- 항목 ID는 서버가 생성하고 이후 변경하지 않습니다.
- 화면의 순서는 `order`로 관리합니다.
- 제거된 항목은 즉시 삭제하지 않고 cancelled 또는 replaced 상태로 보존합니다.
- 제출 방식은 link, text, code, mixed 중 하나입니다.
- 완료율에는 필수이며 활성 상태인 항목만 포함합니다.

### 1차·2차 마감

- 1차 마감은 필수입니다.
- 2차 마감은 선택 사항입니다.
- 2차 마감은 반드시 1차 마감보다 늦어야 합니다.
- ISO 8601과 Workspace timezone을 사용합니다.

### 일정 수정

- 요청의 `expectedRevision`과 현재 YAML revision을 비교합니다.
- GitLab의 `last_commit_id`도 함께 비교합니다.
- 기존 제출이 있으면 변경 사유를 요구합니다.
- 성공 시 revision을 1 증가시킵니다.
- 일정 취소는 파일 삭제가 아니라 `status: cancelled` 업데이트입니다.

## GitLab API 사용 범위

```text
GET  /api/v4/projects/:id/repository/tree
GET  /api/v4/projects/:id/repository/files/:path
GET  /api/v4/projects/:id/repository/files/:path/raw
POST /api/v4/projects/:id/repository/files/:path
PUT  /api/v4/projects/:id/repository/files/:path
```

GitLab 호출은 공통 `GitLabRepositoryPort`를 사용합니다. 팀원 1이 제공하는 `WorkspaceContext`에서 프로젝트 ID와 기본 브랜치를 가져옵니다.

## 패키지 구조 예시

```text
backend/src/main/java/.../
├── session/
│   ├── controller/
│   ├── service/
│   ├── domain/
│   └── infrastructure/yaml/
└── repository/
    ├── controller/
    ├── service/
    └── dto/
```

## 구현 순서

### 1. Repository 읽기

- Workspace 접근 검증 연결
- 루트 tree 조회
- 날짜 폴더 패턴 필터링
- `session.yml` raw 파일 조회
- 커밋 ID와 GitLab web URL 반환
- 허용 확장자와 1MB 크기 제한 적용

### 2. YAML 파서

- 정상 `session.yml`을 도메인 객체로 변환
- 필수 필드와 enum 검증
- 중복 item ID와 order 검증
- timezone과 2차 마감 검증
- 알 수 없는 필드를 어떻게 처리할지 정책 결정

### 3. 일정 목록·상세

- 기간별 날짜 폴더 검색
- session 파일 병렬 조회
- 동시 요청 수 제한
- cancelled 일정과 잘못된 YAML 처리 정책 적용
- 짧은 TTL 캐시 적용

### 4. 일정 생성

- 같은 날짜 파일 존재 여부 조회
- item ID와 revision 생성
- YAML 직렬화
- 로그인 사용자 이름으로 GitLab 커밋
- 관련 캐시 무효화

### 5. 일정 수정·취소

- 최신 파일과 commit ID 조회
- expected revision 검증
- 기존 제출 존재 여부 확인
- 항목 교체와 archived item 처리
- 변경 사유 기록
- `last_commit_id`를 포함해 파일 수정

## 오류 처리

| Code | 상황 |
|---|---|
| `INVALID_SESSION_FILE` | YAML 문법 또는 필수 필드 오류 |
| `SESSION_NOT_FOUND` | 해당 날짜의 session 파일 없음 |
| `SESSION_ALREADY_EXISTS` | 같은 날짜 일정이 이미 존재 |
| `SESSION_REVISION_CONFLICT` | expected revision 불일치 |
| `FILE_PATH_NOT_ALLOWED` | 허용하지 않은 경로·확장자 |
| `GITLAB_PROJECT_ACCESS_DENIED` | 프로젝트 읽기 권한 없음 |
| `GITLAB_WRITE_PERMISSION_REQUIRED` | 파일 생성·수정 권한 없음 |
| `GITLAB_API_ERROR` | GitLab 응답 오류 |
| `GITLAB_UNREACHABLE` | GitLab 네트워크 오류 |

## 보안 체크리스트

- [ ] 프로젝트 ID와 브랜치는 Workspace 연결 정보에서 조회
- [ ] 파일 경로를 URL decode한 뒤 다시 검증
- [ ] `..`, 절대 경로와 허용하지 않은 확장자 차단
- [ ] Markdown raw HTML을 그대로 렌더링하지 않음
- [ ] 미리보기 파일 크기 제한
- [ ] GitLab 오류 응답에 토큰이나 내부 정보를 포함하지 않음
- [ ] 일정 수정 전 현재 사용자 프로젝트 접근 권한 재확인
- [ ] 보호 브랜치 오류를 명확한 도메인 오류로 반환

## 테스트 항목

### YAML 단위 테스트

- 정상 session round trip
- 여러 학습 항목과 순서 유지
- 2차 마감 직렬화·역직렬화
- 2차 마감이 1차보다 빠른 경우
- 중복 item ID
- 잘못된 submit type
- cancelled·replaced 항목 보존
- 한글, URL, 줄바꿈이 포함된 값

### 서비스 테스트

- 기간별 일정 목록
- 일정 생성 시 item ID와 revision 생성
- 같은 날짜 중복 생성 거부
- revision 충돌
- last commit 충돌
- 기존 제출이 있는 일정 수정 시 변경 사유 요구
- 일정 취소 후 파일 유지
- 성공 후 캐시 무효화

### GitLab 통합 테스트

- 빈 프로젝트 tree
- 날짜 폴더와 파일 조회
- 파일 404 후 create
- 기존 파일 update
- Reporter 쓰기 거부
- Developer 쓰기 성공
- 보호 브랜치 오류
- 429와 Retry-After 처리

## 다른 역할과의 경계

### 팀원 1에게 받는 것

- 현재 로그인 사용자
- 유효한 GitLab 인증 상태
- Workspace 접근 검증
- 서버에서 확정된 프로젝트 ID와 기본 브랜치

### 팀원 3에게 제공하는 것

- 검증된 Session 도메인 모델
- 활성 필수 항목 목록
- 날짜와 폴더 변환 규칙
- session revision과 last commit 정보
- repository 파일 조회 기능

팀원 3의 제출 파일 병합 로직을 Session 서비스 내부에 넣지 않습니다. 반대로 팀원 3은 `session.yml`을 임의로 수정하지 않습니다.

## 완료 기준

- [ ] 실제 GitLab tree와 허용 파일을 조회할 수 있음
- [ ] GitLab의 `session.yml`로 일정 목록과 상세를 구성함
- [ ] 웹 요청으로 새 일정 파일을 커밋할 수 있음
- [ ] revision과 last commit을 확인하며 일정을 수정할 수 있음
- [ ] 일정 취소 시 파일을 삭제하지 않음
- [ ] YAML·권한·충돌·네트워크 오류가 구분됨
- [ ] 단위 테스트와 GitLab 통합 테스트가 작성됨
- [ ] OpenAPI와 YAML 스키마가 문서화됨

## 포트폴리오에 정리할 내용

- DB 대신 GitLab을 원본으로 선택한 이유
- YAML과 도메인 모델 간 변환 설계
- revision과 `last_commit_id`를 함께 사용한 충돌 방지
- 항목 교체 시 과거 제출을 보존하는 정책
- 저장소 경로 검증과 파일 미리보기 보안
- GitLab 오류·보호 브랜치·요청 제한 대응

