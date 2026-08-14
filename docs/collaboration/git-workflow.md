# Git 협업 가이드 (2인 + AI 에이전트)

이 문서는 Study-ing을 **두 명이 동시에, 각자 AI 에이전트를 적극적으로 사용하며** 개발할 때 지키는 Git 규칙을 설명합니다. 협업 개발 경험이 적은 팀을 기준으로, "왜 이렇게 하는지"와 "실제로 어떤 명령을 치는지"를 함께 적었습니다.

짧은 버전은 [`CONTRIBUTING.md`](../../CONTRIBUTING.md)에 있습니다. 헷갈리면 이 문서를 먼저 읽고, 평소에는 `CONTRIBUTING.md`만 봐도 됩니다.

## 왜 규칙이 필요한가

두 명이 같은 저장소를 건드리는 데다, 각자 에이전트가 짧은 시간에 대량의 코드를 만들어냅니다. 사람 둘일 때보다 **동시에 같은 파일을 바꿀 확률이 훨씬 높고**, 리뷰 없이 커밋된 코드의 양도 많아지기 쉽습니다. 아래 규칙은 전부 이 두 가지 위험(충돌, 미검토 코드)을 줄이는 방향으로 맞춰져 있습니다.

---

## 1. 기본 원칙 (요약)

1. **`master`에 직접 커밋하지 않는다.** 항상 브랜치를 만들고 PR로 합친다.
2. **브랜치는 짧게 산다.** 하루~이틀 안에 끝낼 수 있는 단위로 쪼갠다. 오래 살수록 충돌이 커진다.
3. **에이전트 세션 하나 = 브랜치 하나 = 목적 하나.** 에이전트에게 "이것저것 다 고쳐줘"를 시키지 않는다.
4. **커밋하기 전에 반드시 `git diff`로 직접 읽는다.** 에이전트가 만든 코드도 예외 없다.
5. **작업 시작 전에 서로 어떤 영역을 건드리는지 한마디로 공유한다.** (카톡이든 뭐든 상관없음, 도구가 중요한 게 아니라 "동시에 같은 파일 만지지 않기"가 중요함)

---

## 2. 브랜치 전략

### 2.1 브랜치 종류

| 브랜치 | 용도 | 규칙 |
|---|---|---|
| `master` | 항상 배포 가능한 상태를 유지하는 기준 브랜치 | 직접 push 금지, PR merge로만 변경 |
| 작업 브랜치 | 기능/버그/문서 등 실제 작업 단위 | `master`에서 분기, 끝나면 삭제 |

### 2.2 브랜치 이름 규칙

```text
<type>/<간단한-설명>
```

`type`은 다음 중 하나를 씁니다. (`CONTRIBUTING.md`와 동일)

| type | 언제 쓰나 |
|---|---|
| `feat/` | 새 기능 추가 |
| `fix/` | 버그 수정 |
| `test/` | 테스트만 추가/수정 |
| `docs/` | 문서만 변경 |
| `refactor/` | 동작은 그대로 두고 구조만 개선 |
| `chore/` | 빌드, 의존성, 설정 등 잡일 |
| `agent/` | 에이전트가 여러 파일에 걸쳐 탐색·정리하는 **큰 단위 세션**을 돌릴 때 (아래 4장 참고) |

설명은 영어 소문자 + 하이픈, 3~5단어 이내로 짧게 씁니다.

```bash
feat/workspace-invite-link
fix/session-cookie-expiry
docs/onboarding-guide
refactor/submission-service
agent/provider-error-handling-cleanup
```

이슈나 티켓 번호가 있으면 앞에 붙여도 됩니다: `fix/123-session-expiry`.

### 2.3 브랜치 실전 명령어

```bash
# 1) 항상 master를 최신으로 맞추고 시작한다
git switch master
git pull origin master

# 2) 새 작업 브랜치를 만든다
git switch -c feat/workspace-invite-link

# 3) 작업하고, 중간중간 커밋한다 (3장 참고)
git add <파일>
git commit -m "feat(workspace): add invite link generation"

# 4) 원격에 올린다 (최초 1회는 -u로 upstream 연결)
git push -u origin feat/workspace-invite-link

# 5) 이후에는 그냥 push
git push
```

### 2.4 브랜치 수명 관리

- **하루~이틀 안에 PR을 올리는 걸 목표**로 삼습니다. 작업이 커지면 브랜치를 쪼갤 방법을 먼저 고민합니다.
- 작업 중 `master`가 많이 바뀌었으면 중간에 최신화합니다.

```bash
git switch feat/workspace-invite-link
git fetch origin
git rebase origin/master   # 히스토리를 깔끔하게 유지하고 싶을 때
# 또는 rebase가 아직 낯설면:
git merge origin/master    # 더 안전하지만 merge commit이 하나 더 생김
```

  두 방법 중 뭘 써도 되지만, **같은 브랜치를 두 사람이 같이 만지고 있다면 rebase를 피하세요.** rebase는 커밋 해시를 바꾸기 때문에, 이미 push한 브랜치를 다른 사람도 pull 받아 쓰고 있으면 히스토리가 꼬입니다. 이 팀 규모(2인)에서는 **"브랜치는 원칙적으로 한 사람이 소유"**하는 편이 훨씬 마음 편합니다.
- merge된 브랜치는 바로 삭제합니다.

```bash
git branch -d feat/workspace-invite-link          # 로컬
git push origin --delete feat/workspace-invite-link # 원격
```

---

## 3. 커밋 메시지 규칙

### 3.1 포맷

```text
type(scope): 한 줄 요약

(선택) 본문: 왜 바꿨는지, 무엇을 고려했는지
(선택) footer: Breaking change, 관련 이슈 등
```

- 한 줄 요약은 **명령형, 소문자 시작, 끝에 마침표 없음**. (`add`, `fix`, `remove` ...)
- 한 줄 요약은 50자 내외를 넘지 않도록 짧게.
- 이 저장소의 기존 커밋은 대부분 영어로 되어 있으니, 일관성을 위해 **영어 유지를 권장**합니다. (본문 설명이 길어질 때만 한국어를 섞어도 무방)

### 3.2 type 목록

브랜치 prefix와 동일하게 맞춥니다.

| type | 의미 |
|---|---|
| `feat` | 새 기능 |
| `fix` | 버그 수정 |
| `docs` | 문서만 변경 |
| `refactor` | 동작 변화 없는 구조 개선 |
| `test` | 테스트 추가/수정 |
| `chore` | 빌드/의존성/설정 등 |

### 3.3 scope 예시

`scope`는 어떤 영역을 건드렸는지 나타냅니다. 이 프로젝트 구조 기준 자주 쓰는 scope:

```text
auth, workspace, submission, records, repository, session,
provider, github, gitlab, policy,       # backend 도메인
frontend, design,                        # frontend 전반
docs, ci, infra
```

### 3.4 예시

실제 이 저장소에 있는 좋은 예시 (그대로 참고하면 됩니다):

```text
fix: preserve private key permissions in container deployment
feat: complete GitHub App repository provider integration
feat(workspace): add invite link generation
docs(api): document workspace commit rule error codes
```

나쁜 예 → 좋은 예:

```text
❌ update stuff
❌ fix bug
❌ WIP
❌ 에이전트가 여러개 고침

✅ fix(session): refresh cookie before expiry check
✅ refactor(submission): extract score calculation to domain service
✅ docs(getting-started): add windows setup notes
```

### 3.5 커밋을 어떻게 나눌까 (atomic commit)

한 커밋 = 한 가지 목적. 아래처럼 나눕니다.

```bash
git status                # 뭐가 바뀌었는지 먼저 확인
git diff                  # 내용을 직접 읽는다
git add backend/src/.../WorkspaceService.java
git commit -m "feat(workspace): add invite link expiry check"

git add frontend/components/settings/SettingsWorkspace.tsx
git commit -m "feat(workspace): show invite link in settings UI"
```

"기능 + 리팩터링 + 오타 수정"을 한 커밋에 몰아넣지 않습니다. 나중에 문제가 생겼을 때 `git bisect`나 `git revert`로 원인을 찾기 훨씬 쉬워집니다.

---

## 4. AI 에이전트와 함께 작업할 때 (핵심)

두 사람 다 에이전트를 적극적으로 쓰는 전제이므로, 여기가 가장 중요합니다.

### 4.1 세션 = 브랜치 = 목적, 하나로 묶기

에이전트에게 작업을 시키기 전에 **먼저 브랜치를 만듭니다.** "일단 시켜보고 마음에 들면 커밋"하는 습관은 `master`나 다른 브랜치를 오염시키기 쉽습니다.

```bash
git switch master && git pull origin master
git switch -c fix/session-cookie-expiry
# 이제 에이전트에게 이 브랜치 위에서 작업을 시킨다
```

에이전트가 목적과 무관한 파일(포맷터가 전체 파일을 건드렸다거나, 관련 없는 리팩터링)까지 바꿔놨다면, **그 변경은 커밋에서 제외하거나 별도 커밋/브랜치로 분리**합니다.

### 4.2 커밋 전 필수 체크리스트

에이전트가 "커밋해줘"라고 하면 바로 하지 말고, 아래를 먼저 확인하는 걸 팀 규칙으로 삼습니다.

- [ ] `git status`로 의도하지 않은 파일(특히 `.env`, 키, 생성된 report/screenshot)이 없는지 확인했다.
- [ ] `git diff`를 처음부터 끝까지 직접 읽었다. (에이전트 요약만 믿지 않는다)
- [ ] 변경 범위가 브랜치 목적과 일치한다.
- [ ] `make check` 또는 최소 해당 영역 테스트(`npm run lint`, `npm run test`, `./gradlew test`)를 돌렸다.
- [ ] 민감정보(token, Authorization header, 쿠키, 개인정보)가 로그·테스트 코드·문서에 남지 않았다.

이건 `CONTRIBUTING.md`의 "완료 기준"과 같은 기준입니다. 에이전트가 만든 코드라고 검증 절차를 생략하지 않습니다.

### 4.3 동시 작업 충돌 예방

두 사람이 각자 에이전트를 병렬로 여러 개 돌리면, 사람이 직접 타이핑할 때보다 훨씬 빠르게 파일이 바뀝니다. 그만큼 충돌도 빨리 납니다.

- **작업 시작 전에 한 줄 공유**: "나 지금 `workspace` 쪽 건드릴게" 정도면 충분합니다. Slack, 카톡, GitHub 이슈 코멘트 뭐든 상관없습니다.
- **영역을 나눠서 병렬 작업**: 예를 들어 한 명은 backend `submission` 도메인, 한 명은 frontend `settings` 화면처럼 최대한 겹치지 않게 잡습니다.
- **브랜치를 오래 들고 있지 않는다**: 하루 이상 묵히면 `master`가 그새 바뀌어 충돌 범위가 커집니다. 작게 자주 PR을 올립니다.
- **같은 파일을 동시에 건드려야 한다면**: 먼저 끝낸 사람이 PR을 빨리 merge하고, 다른 사람은 그 뒤에 `git pull`/`rebase`로 받아서 이어갑니다. 어느 한쪽이 먼저 끝날 때까지 기다리는 게, 나중에 충돌 푸는 것보다 쌉니다.

### 4.4 큰 규모 에이전트 세션 (`agent/` 브랜치)

에이전트에게 "코드베이스 전반을 훑고 정리해줘" 같은 탐색적·광범위한 작업을 시킬 때는 `agent/<주제>` 브랜치를 씁니다. (실제로 이 저장소에 `agent/study-ing-platform-updates` 브랜치가 이런 용도로 이미 있습니다.)

이런 브랜치는 특히 리뷰가 오래 걸리므로:

- 가능하면 나중에 **기능 단위로 잘라서** 여러 개의 작은 PR로 나눠 올립니다.
- 한 번에 merge하지 않고, 리뷰어가 하루 안에 다 볼 수 있는 크기로 쪼갭니다.

### 4.5 에이전트에게 규칙을 알려주기

매번 사람이 "커밋 규칙 지켜서 해줘"라고 타이핑하는 대신, 저장소 루트에 `CLAUDE.md`(Claude Code) 또는 `AGENTS.md`(범용) 파일을 만들어 이 문서와 `CONTRIBUTING.md`를 요약해두면, 에이전트가 세션 시작 시 자동으로 규칙을 읽습니다. 지금은 이 파일들이 없으니, 필요해지면 별도로 만드는 걸 권장합니다.

### 4.6 민감정보 노출 방지

에이전트는 디버깅 중에 `.env` 값을 출력하거나, 테스트 fixture에 실제 토큰을 그대로 박아 넣는 실수를 할 수 있습니다.

- `.env*`는 이미 `.gitignore`에 걸려 있지만, **`git add .`처럼 통째로 add하지 말고** 변경 파일을 하나씩 확인합니다.
- 커밋 직전에 `git diff --cached`로 실제로 올라가는 내용을 한 번 더 봅니다.
- 실수로 커밋했다면 push 전에 `git reset HEAD~1`로 되돌립니다. **이미 push했다면 즉시 알리고 토큰/키를 회전(rotate)합니다.** (되돌리는 것만으로는 이미 원격에 노출된 값이 안전해지지 않습니다.)

---

## 5. Pull Request

- PR은 작더라도 꼭 올립니다. 두 명뿐이라 "그냥 merge"하고 싶은 유혹이 크지만, PR은 리뷰 기록이자 나중에 왜 이렇게 바꿨는지 찾아볼 근거가 됩니다.
- PR 설명에는 최소한 다음을 적습니다: 변경 이유, 실행한 검사(`make check` 등 결과), UI 변경이면 스크린샷.
- 리뷰는 상대방이 하되, **급한 건 아니고 하루 안에 봐주는 정도의 SLA**로 합의해두면 서로 안 답답합니다.
- merge 방식은 **squash merge를 기본**으로 합니다. 브랜치 안에서 "wip", "fix typo" 같은 커밋이 많이 생겨도 `master` 히스토리는 깔끔하게 유지됩니다. (커밋을 이미 3장 규칙대로 깔끔하게 나눴다면 일반 merge도 무방합니다. 팀 안에서 하나만 정해서 통일하세요.)
- merge 후에는 원격/로컬 브랜치를 모두 삭제합니다. (GitHub PR 화면의 "Delete branch" 버튼 사용 가능)

> 참고: 이 저장소에는 GitLab 시절 템플릿(`.gitlab/merge_request_templates/Default.md`)이 남아 있습니다. 현재 원격은 GitHub(`ho7e09152-dot/StudyPlatform`)이므로, 필요하면 이 내용을 `.github/PULL_REQUEST_TEMPLATE.md`로 옮기는 걸 별도로 진행하는 걸 추천합니다.

---

## 6. 충돌(conflict)이 났을 때

처음 겪으면 당황스럽지만 절차는 항상 같습니다.

```bash
git switch feat/my-branch
git fetch origin
git merge origin/master
# 충돌이 나면 Git이 알려준 파일들을 연다
# <<<<<<< HEAD ... ======= ... >>>>>>> origin/master 표시를 직접 정리
git add <정리한 파일>
git commit   # merge commit 완성
git push
```

- 충돌 마커(`<<<<<<<`, `=======`, `>>>>>>>`)가 파일에 남아있으면 절대 커밋/push하지 않습니다. `git diff --check`로 마지막에 확인합니다. (`CONTRIBUTING.md` 완료 기준에도 있는 항목입니다)
- 어떤 코드를 남길지 애매하면 상대방에게 바로 물어보는 게 혼자 추측하는 것보다 빠릅니다.
- 에이전트에게 충돌 해결을 맡길 수도 있지만, **최종적으로 무엇이 남았는지는 사람이 diff로 직접 확인**합니다.

---

## 7. 요약 체크리스트 (인쇄해서 붙여놔도 됨)

```text
[작업 시작]
□ master로 이동 후 pull
□ 어떤 영역 작업할지 상대방에게 한 줄 공유
□ type/설명 형식으로 브랜치 생성

[작업 중]
□ 에이전트 세션 = 이 브랜치의 목적과 일치하는지 확인
□ 커밋은 목적 단위로 쪼개기 (type(scope): summary)

[커밋 전]
□ git status로 의도치 않은 파일 확인
□ git diff 직접 읽기
□ 관련 테스트 / make check 실행
□ 민감정보 없는지 확인

[PR]
□ 변경 이유 + 실행한 검사 결과 적기
□ 하루 안에 서로 리뷰
□ squash merge 후 브랜치 삭제
```

---

관련 문서: [`CONTRIBUTING.md`](../../CONTRIBUTING.md) · [개발 환경](../getting-started.md)
