# Backend 추가 지침

- Controller는 HTTP 변환, application/service는 use case와 transaction, domain은 규칙, repository·Provider adapter는 외부 연동을 담당한다.
- 모든 Workspace API에서 인증, Workspace role, Repository permission을 필요한 수준으로 각각 검증한다.
- Provider 응답과 예외를 공통 domain/API 계약으로 변환하고 token이나 private body를 전달하지 않는다.
- 스키마 변경은 기존 파일 수정이 아닌 새 Flyway migration으로 작성한다. 운영 데이터, index, lock, 재실행과 롤백 절차를 검토한다.
- API 변경과 같은 작업에서 `docs/api/openapi.yaml`, 오류 코드 문서, 계약 테스트를 동기화한다.
- 최소 검증은 `./gradlew test`이며 Windows에서는 `gradlew.bat test`를 사용할 수 있다.
