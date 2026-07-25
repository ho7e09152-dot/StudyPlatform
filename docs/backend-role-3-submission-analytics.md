# 팀원 3 — 제출·기록

> [프로젝트 README로 돌아가기](../README.md)

> 처음 구현한다면 [팀원 3 초심자 구현 핸드북](guides/member-3-submission-analytics-handbook.md)을 먼저 읽고, 이 문서는 요구사항 체크리스트로 사용하세요.

## 역할 목표

사용자가 웹에서 학습 항목을 하나씩 제출하면 자신의 GitLab 파일에 안전하게 병합하고, 저장소의 실제 제출 데이터를 기반으로 대시보드·기록·점수·순위를 계산합니다.

## 주요 책임

- 로그인 사용자의 제출 파일 조회
- 링크·텍스트·코드·혼합 제출 검증
- 항목 하나의 제출 생성·수정·제거
- 기존 다른 항목을 유지하는 안전한 파일 병합
- 사용자 입력 커밋 메시지 검증
- 자신의 파일만 수정하도록 경로와 사용자 매핑 확인
- session revision 불일치 감지
- `last_commit_id` 기반 제출 충돌 처리
- 다른 멤버 제출 읽기
- 오늘의 Dashboard 집계
- 일별·월별 학습 기록
- 1차·2차 마감 기반 점수와 멤버 순위

## 담당 API 초안

### Submission

| Method | Endpoint | 설명 |
|---|---|---|
| GET | `/api/v1/workspaces/{workspaceId}/sessions/{date}/submissions/me` | 내 제출 파일과 항목별 상태 |
| PUT | `/api/v1/workspaces/{workspaceId}/sessions/{date}/items/{itemId}/submission` | 제출 생성 또는 수정 |
| DELETE | `/api/v1/workspaces/{workspaceId}/sessions/{date}/items/{itemId}/submission` | 해당 항목 제출만 제거 |
| GET | `/api/v1/workspaces/{workspaceId}/sessions/{date}/members/{memberId}/submission` | 다른 멤버 제출 읽기 |

### Dashboard·Records

| Method | Endpoint | 설명 |
|---|---|---|
| GET | `/api/v1/workspaces/{workspaceId}/dashboard` | 선택 날짜의 팀·개인 진행률 |
| GET | `/api/v1/workspaces/{workspaceId}/records` | 일별·월별 제출 기록 |
| GET | `/api/v1/workspaces/{workspaceId}/scores` | 기간별 개인 점수와 순위 |

## 멤버 제출 파일 형식

```markdown
---
version: 1
memberId: member-a
gitlabUserId: 101
username: gitlab-user-a
date: 260723
sessionRevision: 3
sessionType: algorithm
updatedAt: 2026-07-23T20:10:00+09:00

submissions:
  - itemId: item-a8f11c
    type: link
    value: https://blog.example.com/rotation
    submittedAt: 2026-07-23T20:10:00+09:00
    updatedAt: 2026-07-23T20:10:00+09:00
---

# 큐와 배열 집중 학습

## 행렬 테두리 회전하기

https://blog.example.com/rotation

## 프로세스

(미제출)
```

GitLab 파일에는 기계가 파싱할 front matter와 사람이 읽을 Markdown 본문을 함께 저장합니다.

## 핵심 도메인 규칙

### 제출 권한

- 로그인 사용자는 자신에게 매핑된 제출 파일만 수정할 수 있습니다.
- 다른 멤버 파일은 읽을 수 있지만 수정할 수 없습니다.
- 사용자 요청에 파일 경로나 member ID를 직접 받아 쓰기 대상으로 사용하지 않습니다.
- 팀원 1의 현재 사용자와 Workspace 멤버십으로 대상 파일명을 결정합니다.

### 항목별 병합

- 한 번의 요청은 한 item만 변경합니다.
- 기존 파일의 다른 item 제출은 그대로 유지합니다.
- 새 제출이면 `submittedAt`과 `updatedAt`을 기록합니다.
- 기존 제출 수정이면 최초 `submittedAt`을 유지하고 `updatedAt`만 변경합니다.
- 제출 제거 시 파일을 삭제하지 않고 해당 item entry만 제거합니다.
- 현재 Session에 없는 item이나 취소된 item은 제출할 수 없습니다.

### 제출 형식

- link는 `http`와 `https` URL만 허용합니다.
- text는 길이 제한을 적용합니다.
- code는 저장만 하고 서버에서 실행하지 않습니다.
- 요청 타입은 Session item의 `submitType`과 일치해야 합니다.
- 커밋 메시지는 빈 값, 제어 문자와 과도한 길이를 검증합니다.

### Session 기준 확인

- 제출 파일의 `sessionRevision`과 현재 `session.yml` revision을 비교합니다.
- 문제 교체 등으로 기준이 바뀌었으면 최신 Session을 다시 확인하도록 응답합니다.
- replaced 또는 cancelled item의 기존 제출은 과거 기록으로 보존하지만 현재 완료율에 포함하지 않습니다.

## 점수 규칙

필수 활성 항목 한 개를 기준으로 계산합니다.

| 제출 시점 | 점수 |
|---|---:|
| 1차 마감 이전 또는 같은 시각 | 10P |
| 1차 마감 이후, 2차 마감 이전 또는 같은 시각 | 6P |
| 미제출 또는 최종 마감 초과 | 0P |

- 2차 마감이 없는 일정은 1차 마감 이후 제출을 0P로 처리합니다.
- 점수는 제출 파일의 최초 `submittedAt`을 기준으로 합니다.
- 수정 시 점수를 다시 높이기 위해 최초 제출 시각을 변경하지 않습니다.
- 동점자는 같은 순위로 표시하고 다음 순위는 건너뜁니다.
- 일별 점수는 선택 날짜, 월별 점수는 선택 월의 필수 활성 항목을 합산합니다.

## Dashboard 집계

```text
멤버별 완료 항목 수
= 현재 Session의 필수 활성 item 중 제출이 존재하는 수

멤버 완료
= 모든 필수 활성 item 제출

전체 제출률
= 제출된 필수 항목 수 / (활성 멤버 수 × 필수 활성 항목 수)
```

기록과 점수는 DB에 고정 통계로 저장하기보다 GitLab 파일에서 재생성할 수 있어야 합니다. 성능이 필요하면 짧은 TTL 캐시를 사용하고 파일 쓰기 성공 시 관련 캐시를 즉시 무효화합니다.

## GitLab API 사용 범위

```text
GET  /api/v4/projects/:id/repository/files/:path
POST /api/v4/projects/:id/repository/files/:path
PUT  /api/v4/projects/:id/repository/files/:path
```

GitLab 호출은 공통 `GitLabRepositoryPort`를 사용합니다. 프로젝트 ID와 기본 브랜치는 팀원 1이 제공하는 `WorkspaceContext`에서 가져옵니다.

## 패키지 구조 예시

```text
backend/src/main/java/.../
├── submission/
│   ├── controller/
│   ├── service/
│   ├── domain/
│   └── infrastructure/markdown/
├── dashboard/
│   ├── controller/
│   └── service/
└── records/
    ├── controller/
    ├── service/
    └── scoring/
```

## 구현 순서

### 1. 제출 파일 파서

- YAML front matter 분리와 파싱
- submissions 배열을 도메인 객체로 변환
- Markdown 본문 생성
- 한글, URL, 코드 블록과 줄바꿈 round trip
- 잘못된 파일을 명확한 오류로 변환

### 2. 내 제출 조회

- 현재 사용자와 Session 조회
- 사용자에게 매핑된 파일 경로 계산
- 파일이 없으면 모든 항목 미제출 상태 반환
- 파일이 있으면 revision과 item 기준 검증

### 3. 항목 제출

- Workspace와 GitLab 접근 권한 확인
- 현재 Session과 item 조회
- 제출 타입과 내용 검증
- 최신 멤버 파일 조회
- 요청 item 하나만 병합
- 파일이 없으면 create, 있으면 update
- 사용자 커밋 메시지와 `last_commit_id` 전달
- Dashboard·Records 캐시 무효화

### 4. 충돌 처리

- 파일 수정 충돌 시 최신 파일 재조회
- 요청 item이 다른 요청에서 바뀌지 않았으면 최신 내용에 한 번 재병합
- 같은 item이 동시에 변경됐으면 자동 덮어쓰기하지 않고 409 반환
- 무한 자동 재시도 금지

### 5. Dashboard

- 활성 멤버별 제출 파일을 제한된 동시성으로 조회
- 개인·팀 진행률 계산
- 최근 제출과 Session 변경 불일치 표시
- 일부 파일 조회 실패 시 응답 정책 결정

### 6. Records와 점수

- 일별·월별 Session 범위 조회
- 제출률, 학습 일수와 총 제출 수 계산
- 멤버별 평균 완료율
- 1·2차 마감 기준 점수 계산
- 공동 순위 처리

## 오류 처리

| Code | 상황 |
|---|---|
| `ITEM_NOT_FOUND` | 현재 Session에 item이 없음 |
| `SUBMISSION_TYPE_MISMATCH` | item과 요청 제출 방식 불일치 |
| `SUBMISSION_FILE_INVALID` | 멤버 파일 front matter 또는 형식 오류 |
| `SUBMISSION_REVISION_MISMATCH` | 제출 파일과 현재 Session revision 불일치 |
| `SUBMISSION_CONFLICT` | 같은 item 동시 수정 |
| `FILE_PATH_NOT_ALLOWED` | 본인에게 허용되지 않은 파일 경로 |
| `GITLAB_WRITE_PERMISSION_REQUIRED` | GitLab 쓰기 권한 없음 |
| `GITLAB_API_ERROR` | GitLab 파일 API 오류 |

## 보안 체크리스트

- [ ] 현재 사용자에서 제출 파일 경로를 서버가 계산
- [ ] 다른 멤버 파일 수정 요청 차단
- [ ] URL scheme을 `http`, `https`로 제한
- [ ] 코드 제출을 서버에서 실행하지 않음
- [ ] 텍스트·코드·커밋 메시지 크기 제한
- [ ] Markdown raw HTML 비활성화 또는 sanitize
- [ ] GitLab 토큰과 제출 원문을 불필요하게 로그에 기록하지 않음
- [ ] Workspace에 연결된 프로젝트와 기본 브랜치만 사용
- [ ] update 시 `last_commit_id` 전달

## 테스트 항목

### 파서 단위 테스트

- 빈 제출 파일
- 여러 item 제출
- 한글·URL·코드 블록
- 최초 제출 시각 유지
- 제출 제거 후 다른 item 유지
- 잘못된 front matter
- Session에 없는 과거 item 보존

### 제출 서비스 테스트

- 첫 제출 파일 생성
- 기존 파일에 item 하나 추가
- item 하나 수정 시 다른 제출 유지
- item 하나 삭제 시 파일 유지
- 다른 멤버 파일 수정 거부
- 제출 타입 불일치
- Session revision 불일치
- 같은 item 충돌 409
- 다른 item 충돌 한 번 재병합

### 통계 테스트

- 필수·선택·취소 항목의 완료율
- 활성 멤버와 접근 상실 멤버 구분
- 일부 제출과 전체 제출
- Session이 없는 날짜
- 일별·월별 범위
- 공동 순위

### 점수 테스트

- 1차 마감 직전·정각·직후
- 2차 마감 직전·정각·직후
- 2차 마감이 없는 일정
- 미제출
- 제출 수정 후 최초 시각 유지
- 여러 Session의 월별 합산

## 다른 역할과의 경계

### 팀원 1에게 받는 것

- 현재 사용자와 GitLab 사용자 ID
- Workspace 멤버십과 프로젝트 접근 검증
- 서버에서 확정된 프로젝트 ID와 기본 브랜치

### 팀원 2에게 받는 것

- Session 도메인 모델
- 필수 활성 item 목록
- revision과 1·2차 마감
- 날짜·폴더·파일명 규칙

### 팀원 2에게 제공하는 것

- 일정 수정 시 기존 제출 존재 여부
- 교체·취소 item에 연결된 과거 제출 현황
- Dashboard와 기록에서 사용할 제출 집계 결과

제출 서비스는 `session.yml`을 수정하지 않고, 일정 서비스는 멤버 제출 파일을 직접 병합하지 않습니다.

## 완료 기준

- [ ] 웹 요청으로 자신의 제출 파일을 GitLab에 생성·수정할 수 있음
- [ ] item 하나를 변경해도 다른 제출이 보존됨
- [ ] 다른 멤버 파일은 읽기만 가능함
- [ ] 충돌 시 자동 덮어쓰기하지 않음
- [ ] 실제 GitLab 파일에서 Dashboard를 계산함
- [ ] 일별·월별 기록과 점수·순위를 반환함
- [ ] 제출·파서·통계·점수 테스트가 작성됨
- [ ] OpenAPI와 제출 파일 스키마가 문서화됨

## 포트폴리오에 정리할 내용

- Markdown front matter를 선택한 이유
- 한 item 단위 병합으로 기존 데이터를 보존한 방식
- `last_commit_id` 충돌과 제한된 재시도 전략
- 사용자별 파일 경로 권한 검증
- GitLab 원본 데이터에서 통계를 계산한 과정
- 1·2차 마감 점수 정책과 공동 순위 알고리즘
