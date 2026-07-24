# Frontend API Layer

현재 `WorkspaceProvider`의 메모리 기반 동작을 Spring Boot API로 교체할 때 사용할 프론트엔드 API 계층입니다.

```text
lib/api/
├── client/       # fetch 래퍼, 쿠키, 공통 오류 변환
├── services/     # authApi, workspaceApi, sessionApi 등
├── types/        # 백엔드 요청·응답 타입
└── README.md
```

## 예정 서비스

```text
services/
├── authApi.ts
├── workspaceApi.ts
├── gitlabApi.ts
├── sessionApi.ts
├── repositoryApi.ts
├── submissionApi.ts
└── recordsApi.ts
```

## 기본 원칙

- GitLab access token을 브라우저에서 직접 다루지 않습니다.
- 브라우저는 Spring 백엔드의 HttpOnly 세션 쿠키를 사용합니다.
- 컴포넌트에서 URL과 `fetch` 호출을 직접 반복하지 않습니다.
- 백엔드 공통 오류 코드를 프론트 오류 타입으로 변환합니다.
- 현재 도메인 타입과 API DTO의 차이는 서비스 계층에서 변환합니다.
- 로딩·빈 상태·권한 오류·충돌·GitLab 장애를 구분합니다.

실제 백엔드 API 명세가 확정될 때 `.gitkeep`을 제거하고 구현 파일을 추가합니다.
