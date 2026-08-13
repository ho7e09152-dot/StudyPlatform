# GitLab CI 사용 가이드

`.gitlab-ci.yml`은 Merge Request 또는 기본 브랜치 변경에 공통 검사를 실행합니다.

## 실행되는 Job

| Job | 검사 내용 | 실패하면 확인할 곳 |
|---|---|---|
| `api_contract` | `docs/api/openapi.yaml` 문법과 참조 | OpenAPI 경로·schema·`$ref` |
| `repository_hygiene` | 실제 `.env`, token 형태의 값 추적 여부 | `.gitignore`, 스테이징 파일 |
| `frontend_lint` | ESLint | Job 로그의 파일과 줄 번호 |
| `frontend_audit` | 운영 npm 의존성의 high 이상 취약점 | 직접·전이 의존성의 수정 버전 |
| `frontend_test` | 프로덕션 빌드와 라우트 smoke test | Vite 빌드 오류, Node 테스트 |
| `frontend_e2e` | Chromium에서 제출·피드·활동함·팀 문서 권한·일정 검색 | Playwright screenshot, trace, JUnit artifact |
| `backend_test` | Spring context와 모든 JUnit 테스트 | JUnit report |

## 로컬에서 CI와 같은 검사 실행

```bash
# OpenAPI
npx --yes @redocly/cli lint docs/api/openapi.yaml --config .redocly.yaml

# Frontend
cd frontend
npm ci
npm run lint
npm audit --omit=dev --audit-level=high
npm run test
npx playwright install chromium
npm run test:e2e

# Backend
cd ../backend
./gradlew clean test
```

Node.js 22.13 이상을 사용합니다.

## Pipeline이 시작되지 않을 때

이 저장소의 Pipeline은 다음 상황에서 시작됩니다.

- Merge Request 생성 또는 새 commit push
- 기본 브랜치 push
- GitLab UI의 **Build > Pipelines > Run pipeline**

Job이 `pending` 상태에 오래 머무르면 GitLab Runner가 프로젝트에 연결되어 있는지 확인합니다.

```text
Settings
→ CI/CD
→ Runners
→ Available runners
```

SSAFY GitLab에서 공용 Runner를 제공하지 않는다면 팀 PC 또는 별도 서버에 Runner를 등록해야 합니다. Runner 등록 전에도 로컬 명령으로 동일한 검사를 수행할 수 있습니다.

## 실패 Job 고치는 순서

1. 실패한 Job 이름을 클릭합니다.
2. 로그의 첫 번째 오류를 찾습니다.
3. 같은 명령을 로컬에서 실행합니다.
4. 첫 오류부터 수정합니다.
5. 관련 테스트를 추가하거나 수정합니다.
6. commit하고 같은 브랜치에 push합니다.
7. 기존 Merge Request Pipeline이 다시 실행되는지 확인합니다.

여러 오류가 보이더라도 첫 번째 컴파일 오류가 뒤의 오류를 연쇄적으로 만들 수 있으므로 첫 오류부터 처리합니다.

## Cache와 Artifact 차이

- Cache는 npm과 Gradle 다운로드 시간을 줄이는 재사용 파일입니다.
- Artifact는 실패 결과를 사람이 확인하기 위한 빌드·테스트 보고서입니다.
- Cache가 없어져도 빌드 결과가 달라지면 안 됩니다.
- Artifact는 7일 후 자동 만료되도록 설정했습니다.
- `frontend_e2e` 실패 시 `frontend/test-results/`에서 screenshot과 trace를 확인합니다.

## 브라우저 E2E 범위

Playwright는 `NEXT_PUBLIC_APP_MODE=demo`인 격리 서버를 자동으로 실행합니다. 실제 GitLab이나 운영 DB를 변경하지 않고 다음 회귀를 확인합니다.

- 오늘 페이지 활동함이 화면 오른쪽에 정상 배치되는지
- 팀 메시지 작성과 항목 제출 후 완료율이 갱신되는지
- 팀 문서를 만들 수 있고 다른 작성자의 문서는 읽기 전용인지
- 일정 검색이 실제 목록을 필터링하는지
- 데모 설정 화면이 실제 백엔드 API를 호출하지 않는지

실제 OAuth token, 두 사용자 GitLab 권한과 commit 작성자는 CI의 격리된 E2E만으로 증명할 수 없습니다. 배포 전에는 [스테이징 OAuth E2E 체크리스트](staging-e2e.md)를 추가로 수행합니다.

## 비밀정보 검사 범위

`repository_hygiene`은 다음을 막습니다.

- 이름이 정확히 `.env`인 파일을 Git이 추적하는 경우
- 예제와 문서를 제외한 코드에서 `GITLAB_ACCESS_TOKEN=실제값` 형태가 발견되는 경우

이 검사는 모든 비밀 패턴을 탐지하는 전문 secret scanner를 대체하지 않습니다. 토큰을 실수로 push했다면 파일만 지우는 것으로 끝내지 말고 즉시 GitLab에서 토큰을 폐기하고 새로 발급해야 합니다.
