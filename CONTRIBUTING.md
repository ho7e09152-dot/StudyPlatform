# Study-ing 협업 가이드

이 문서는 Git과 Spring 협업이 익숙하지 않은 팀원도 같은 방식으로 작업하기 위한 규칙입니다. 막히면 혼자 오래 고민하기보다 작업 중인 코드, 오류 로그, 시도한 방법을 함께 공유합니다.

## 1. 작업 시작 전 읽을 문서

1. [README](README.md)
2. [3인 팀 구현 로드맵](docs/team-implementation-roadmap.md)
3. [OpenAPI 계약](docs/openapi.yaml)
4. [API 공통 오류 계약](docs/api-error-catalog.md)
5. 자기 역할 문서와 초심자 구현 핸드북
6. [개발환경 가이드](docs/development-environment.md)

기능 요구사항과 OpenAPI가 다르면 임의로 구현하지 말고 팀이 계약을 먼저 수정합니다.

## 2. 한 사람이 기능을 끝까지 소유하기

각 기능은 다음 범위를 한 사람이 함께 구현합니다.

```text
Controller
→ Request/Response DTO
→ Service
→ Domain rule
→ Repository 또는 GitLab Port
→ 예외
→ 단위 테스트
→ 통합 테스트
→ OpenAPI 확인
```

Controller만 한 사람, Service만 다른 사람이 맡는 식으로 계층별 분할을 하지 않습니다. 기능 흐름 전체를 경험하는 것이 학습 목표입니다.

## 3. 브랜치 만들기

작업 시작 전에 기본 브랜치를 최신으로 만듭니다.

```bash
git switch master
git pull gitlab master
```

기능 브랜치를 만듭니다.

```bash
git switch -c feat/member1-oauth-login
```

브랜치 규칙:

| Prefix | 사용 예 |
|---|---|
| `feat/` | 새로운 기능 |
| `fix/` | 버그 수정 |
| `test/` | 테스트 추가 |
| `docs/` | 문서만 수정 |
| `refactor/` | 동작을 바꾸지 않는 구조 개선 |
| `chore/` | 설정, 의존성, CI |

브랜치 이름에는 담당자와 작은 작업 하나를 적습니다.

```text
좋음: feat/member2-create-session
좋음: test/member3-score-calculator
나쁨: feat/backend
나쁨: member1-work
```

## 4. 작은 단위로 구현하기

한 Merge Request에 역할 전체를 넣지 않습니다.

추천 분할:

```text
MR 1: 도메인 모델과 단위 테스트
MR 2: parser와 fixture 테스트
MR 3: service와 GitLab adapter
MR 4: controller와 MockMvc 테스트
MR 5: 프론트 연결
```

하나의 MR은 리뷰어가 20~30분 안에 이해할 수 있는 크기를 목표로 합니다.

## 5. Commit 규칙

형식:

```text
type(scope): 변경 요약
```

예시:

```text
feat(session): create session yaml
fix(submission): reject stale last commit id
test(auth): add oauth state validation cases
docs(api): clarify score response
```

권장 type:

- `feat`
- `fix`
- `test`
- `docs`
- `refactor`
- `chore`
- `ci`

commit 전에 확인합니다.

```bash
git status
git diff
git diff --check
```

`git add .`보다 변경한 파일을 명시적으로 추가하는 습관을 권장합니다.

```bash
git add backend/src/main/java/.../Session.java
git add backend/src/test/java/.../SessionTests.java
```

## 6. Push 전 전체 검사

```bash
make check
```

시간이 오래 걸려도 최소한 자기 영역 검사는 실행합니다.

```bash
cd backend
./gradlew test --tests '*Session*'
```

```bash
cd frontend
npm run lint
```

## 7. Merge Request 만들기

```bash
git push -u gitlab feat/member2-create-session
```

GitLab에서 Merge Request를 만들고 기본 템플릿을 작성합니다.

필수 내용:

- 왜 필요한 변경인지
- 어떤 규칙을 구현했는지
- 실행한 테스트
- 리뷰어가 집중해서 볼 부분
- UI가 바뀌면 화면 이미지
- API가 바뀌면 OpenAPI 변경

자기 코드를 먼저 한 번 리뷰한 뒤 팀원에게 요청합니다.

## 8. 리뷰 규칙

리뷰어는 사람을 평가하지 않고 코드와 설계를 검토합니다.

좋은 리뷰:

```text
expectedRevision이 일치하지 않을 때 409가 반환되는 테스트도 있으면
동시 수정 규칙을 더 분명하게 보장할 수 있을 것 같아요.
```

피해야 할 리뷰:

```text
이상해요.
왜 이렇게 했어요?
```

리뷰 우선순위:

1. 데이터 손실과 보안
2. 도메인 규칙
3. API 계약
4. 테스트 누락
5. 이름과 가독성
6. 단순 스타일

## 9. Merge 충돌 해결

기본 브랜치 최신 변경을 가져옵니다.

```bash
git fetch gitlab
git rebase gitlab/master
```

충돌 파일을 직접 수정하고 검사합니다.

```bash
git add 충돌을_해결한_파일
git rebase --continue
```

이미 다른 팀원이 사용하는 공유 브랜치라면 강제 push 전에 반드시 상의합니다. 개인 기능 브랜치에서도 `--force` 대신 다음을 사용합니다.

```bash
git push --force-with-lease
```

## 10. 완료 정의

다음 항목이 모두 만족되어야 기능이 완료된 것입니다.

- [ ] OpenAPI 계약과 일치한다.
- [ ] 정상 흐름 테스트가 있다.
- [ ] 권한 거부 테스트가 있다.
- [ ] 리소스 없음 테스트가 있다.
- [ ] 충돌 테스트가 있다.
- [ ] GitLab 오류 변환 테스트가 있다.
- [ ] 토큰이 응답과 로그에 노출되지 않는다.
- [ ] `make check`가 통과한다.
- [ ] 역할 문서의 체크리스트를 갱신했다.
- [ ] 다른 팀원이 Merge Request를 리뷰했다.
