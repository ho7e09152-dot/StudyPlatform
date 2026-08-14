# Frontend 추가 지침

- `app/`의 route, `components/`의 재사용 UI, `lib/`의 API client와 domain 변환을 분리한다.
- 서버 capability와 권한 상태를 기준으로 기능을 표시하되 UI 숨김을 접근 제어로 간주하지 않는다.
- API path·field·error code를 임의 변환하지 않고 공통 client 경계에서 오류를 처리한다.
- keyboard, focus, label, semantic HTML, contrast, mobile overflow, light/dark theme을 확인한다.
- 최소 검증은 `npm run lint`와 `npm run test`다. 사용자 흐름 변경은 관련 Playwright E2E를 실행한다.
