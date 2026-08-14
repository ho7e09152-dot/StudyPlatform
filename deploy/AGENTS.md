# 배포 추가 지침

- 배포 전 health/readiness, migration 순서, 환경변수, TLS와 reverse proxy header를 확인한다.
- 무중단 가능성, 이전 버전 호환성, rollback 지점과 데이터 복구 조건을 명시한다.
- 운영 credential을 이미지·설정·로그에 포함하지 않는다.
- 배포 설정 변경은 staging 검증과 `docs/operations/production.md` 동기화를 요구한다.
