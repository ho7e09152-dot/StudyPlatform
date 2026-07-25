# Frontend API Layer

`WorkspaceProvider`의 메모리 기반 동작을 Spring Boot API로 점진적으로 교체하는 프론트엔드 API 계층입니다. GitLab 연결과 저장소 파일 조회가 먼저 구현되어 있습니다.

```text
lib/api/
├── client/       # fetch 래퍼, 쿠키, 공통 오류 변환
├── hooks/        # GitLab 연결 상태와 재시도
├── services/     # authApi, workspaceApi, sessionApi 등
├── types/        # GitLab 연결·프로젝트·tree·파일 응답 타입
└── README.md
```

## 예정 서비스

```text
services/
├── gitlabApi.ts        # 구현됨: 연결 확인과 파일 조회
├── authApi.ts          # 예정
├── workspaceApi.ts     # 예정
├── sessionApi.ts       # 예정
├── submissionApi.ts    # 예정
└── recordsApi.ts       # 예정
```

## 기본 원칙

- GitLab access token을 브라우저에서 직접 다루지 않습니다.
- 브라우저는 Spring 백엔드의 HttpOnly 세션 쿠키를 사용합니다.
- 컴포넌트에서 URL과 `fetch` 호출을 직접 반복하지 않습니다.
- 백엔드 공통 오류 코드를 프론트 오류 타입으로 변환합니다.
- 현재 도메인 타입과 API DTO의 차이는 서비스 계층에서 변환합니다.
- 로딩·빈 상태·권한 오류·충돌·GitLab 장애를 구분합니다.

API 기준 주소는 `NEXT_PUBLIC_API_BASE_URL`로 설정하며 기본값은 `http://localhost:8080`입니다.
