# Study-ing Design System

이 문서는 Study-ing Platform UI의 디자인 Source of Truth다. 페이지별 구현은 이 기준을 우선하며, 기존 기능·API 계약·라우팅·데이터 구조는 디자인을 이유로 변경하지 않는다.

## Design Philosophy

Study-ing은 관리 도구나 GitLab 저장소 브라우저가 아니라, 사용자가 오늘의 학습 흐름을 이해하고 다음 행동을 선택하는 학습 Workspace다.

사용자가 화면에서 먼저 알아야 하는 순서는 다음과 같다.

1. 오늘 무엇을 공부해야 하는가
2. 나는 어디까지 진행했는가
3. 팀은 어디까지 진행했는가
4. 다음 행동은 무엇인가

GitLab은 데이터의 원본이자 안전한 동기화 기반이지만, 기본 화면의 주인공이 아니다. 기술 정보는 사용자의 학습 판단에 필요할 때만 단계적으로 공개한다.

디자인 키워드는 `Clean`, `Calm`, `Focused`, `Lightweight`, `Content-first`다. 중립적인 표면, 충분하지만 과도하지 않은 여백, 명확한 타이포그래피 위계, 제한적인 보라색 강조를 사용한다.

## Current Architecture

공통 스타일은 다음 두 레이어로 구성한다.

- `frontend/app/globals.css`: 기존 페이지별 레이아웃과 기능 스타일
- `frontend/app/design-system.css`: 공통 토큰, primitives, App Shell과 반응형 기준

새 페이지 스타일은 `design-system.css`의 토큰을 사용한다. 기존 UI와 같은 역할의 컴포넌트를 새로 중복 생성하지 않는다.

현재 재사용하는 공통 컴포넌트는 다음과 같다.

- `AppShell`, `WorkspaceSwitcher`
- `Modal`, `Toast`, `StorageDetails`
- `ProgressBar`, `Avatar`
- 공통 class primitives: `.button`, `.icon-button`, `.field`, `.surface`, `.status-badge`, `.type-chip`

페이지별 리디자인을 진행할 때 `PageHeader`, `SectionHeader`, `EmptyState`, `ListRow`처럼 반복이 확인되는 구조만 별도 컴포넌트로 승격한다. 한 페이지에서만 사용하는 작은 wrapper는 공통 컴포넌트로 만들지 않는다.

## Design Tokens

토큰은 `frontend/app/design-system.css`의 `--ds-*` 변수로 정의한다.

### Color

| 역할 | 토큰 | 사용 기준 |
|---|---|---|
| Primary | `--ds-color-primary` | Primary CTA, 활성 내비게이션, 선택, focus, 주요 progress |
| Primary soft | `--ds-color-primary-soft` | 활성 항목의 낮은 강도 배경 |
| Canvas | `--ds-color-canvas` | 앱 전체 배경 |
| Surface | `--ds-color-surface` | 독립 섹션, modal, drawer |
| Secondary surface | `--ds-color-surface-secondary` | hover, 보조 영역, 입력 조합 |
| Primary text | `--ds-color-text-primary` | 제목과 핵심 콘텐츠 |
| Secondary text | `--ds-color-text-secondary` | 설명과 보조 문장 |
| Tertiary text | `--ds-color-text-tertiary` | 날짜, 경로, caption |
| Border | `--ds-color-border` | section과 row 구분 |
| Success | `--ds-color-success` | 완료, 정상 연결, 성공 |
| Warning | `--ds-color-warning` | 지각, 변경 확인, 처리 필요 |
| Danger | `--ds-color-danger` | 오류, 삭제, 접근 상실 |

Purple은 한 영역에서 여러 장식 요소에 동시에 반복하지 않는다. 보라색 배경, 아이콘, 텍스트, 버튼이 경쟁한다면 Primary CTA 또는 선택 상태만 남기고 나머지는 neutral로 낮춘다.

### Dark Theme

Light Theme 토큰은 유지한다. Dark Theme는 `neutral charcoal + accent` 구조를 사용하며 canvas와 일반 surface에 accent hue나 blue/slate tint를 섞지 않는다.

| 역할 | 값 | 사용 기준 |
|---|---|---|
| Canvas | `#121214` | 앱 전체 배경 |
| Sidebar | `#17171A` | Desktop sidebar, mobile header |
| Surface | `#1D1D21` | card, panel, dialog, drawer |
| Elevated/secondary | `#222226` | hover, input 조합, 보조 surface |
| Border | `#303036` | divider와 control border |
| Primary text | `#F5F5F7` | 제목과 핵심 정보 |
| Secondary text | `#BDBDC4` | 본문과 설명 |
| Tertiary text | `#909099` | metadata와 caption |
| Purple accent base | `#7C5CFF` | selection tint와 브랜드 accent 기준색 |
| Purple foreground | `#9277FF` | dark surface 위 active text/icon과 focus |
| Purple action | `#7858FA` | 흰색 label을 사용하는 Primary CTA |

Dark Theme의 selected state는 낮은 강도의 accent 배경(`rgba(124, 92, 255, 0.12)`)과 필요한 경우 subtle border(`rgba(124, 92, 255, 0.30)`)를 사용한다. 기준색을 text나 button background에 그대로 재사용해 대비가 낮아지지 않도록 foreground/action token을 분리한다. 일반 navigation, card, page background에 purple wash, glow 또는 decorative gradient를 사용하지 않는다.

### Typography

| 역할 | 토큰 | 기준 |
|---|---|---|
| Page title | `--ds-font-page-title` | 페이지에서 하나만 사용 |
| Section title | `--ds-font-section-title` | 주요 콘텐츠 그룹 제목 |
| Primary content | `--ds-font-content` | 일정명, 학습 항목, 사용자 이름 |
| Body | `--ds-font-body` | 설명과 일반 콘텐츠 |
| Body small | `--ds-font-body-small` | 버튼, 조밀한 row |
| Metadata | `--ds-font-metadata` | 날짜, 상태 보조 정보, 기술 metadata |

제목은 크기와 굵기로 구분하고 색상에 의존하지 않는다. 영문 uppercase eyebrow는 제품 기본 패턴으로 사용하지 않는다. 필요한 경우 `팀 진행 상황`, `다음 할 일`, `학습 흐름 요약`처럼 사용자 언어를 쓴다.

### Spacing

4px 배수의 `--ds-space-*` scale을 사용한다.

- 컴포넌트 내부의 작은 간격: `4–12px`
- row와 control 간격: `12–16px`
- card 또는 section padding: `16–24px`
- section 사이 간격: `--ds-space-section` (`24px`)
- 페이지 상단·하단 간격: layout token 사용

페이지에서 임의의 spacing 값을 추가해야 한다면 먼저 기존 scale로 해결할 수 있는지 확인한다.

### Radius and Shadow

- Small radius: input, button, icon button
- Medium radius: card, menu, compact panel
- Large radius: modal, drawer
- Subtle shadow: 떠 있음을 반드시 알려야 하는 경우만 사용
- Floating shadow: modal, dropdown, drawer, toast에만 사용

기본 section과 card는 border만으로 구분하고 강한 shadow를 사용하지 않는다.

### Motion

Motion은 상태 변화를 설명하고 장식하지 않는다. App Shell은 route마다 다시 움직이지 않으며 Main Content와 실제로 열리고 닫히는 overlay만 짧게 전환한다.

| 역할 | 토큰 | 기준 |
|---|---|---|
| Instant | `--motion-instant: 100ms` | press feedback |
| Fast | `--motion-fast: 140ms` | hover, selection, menu |
| Base | `--motion-base: 200ms` | route content, modal, toast |
| Slow | `--motion-slow: 240ms` | drawer, mobile navigation |
| Exit | `--motion-exit: 150ms` | modal, toast, backdrop close |
| Standard easing | `--ease-standard` | entering and in-place state change |
| Exit easing | `--ease-exit` | leaving state |

- Route: Sidebar와 Mobile Header는 유지하고 Main Content만 `opacity + translateY(6px)`로 진입한다.
- Modal: backdrop fade와 `translateY(8px) + scale(.985)`만 사용한다. 닫힘은 더 빠르며 exit 중 pointer input을 받지 않는다.
- Drawer/Mobile navigation: 화면 가장자리의 방향만 설명한다. 내부 item stagger는 사용하지 않는다.
- Dropdown: `opacity + translateY(-4px)`, 140ms를 사용한다.
- Toast: `opacity + translateY(8px)`, 200ms 진입과 150ms 종료를 사용한다.
- Tab/View switch: `opacity + 3px` 이내의 content transition만 사용한다. Calendar cell이나 row를 순차 등장시키지 않는다.
- Accordion: native `details` semantics와 layout을 유지하고 열린 content에만 짧은 reveal을 적용한다.
- Progress: 값이 실제로 바뀔 때만 280ms로 전환하며 initial render를 0부터 재생하지 않는다.
- Theme/Accent: background, border, color만 140ms로 전환하고 전체 화면 crossfade를 사용하지 않는다.

`prefers-reduced-motion: reduce`에서는 route/modal/drawer translation을 제거하고 non-essential animation과 transition을 1ms로 줄인다. Focus 이동, focus trap, Escape, 이전 focus 복원과 screen-reader status는 애니메이션 완료를 기다리지 않는다. `transition: all`은 사용하지 않고 실제 변하는 property를 명시한다.

## Layout

공통 layout token은 다음을 관리한다.

- Sidebar width: `--ds-sidebar-width`
- Main content max-width: `--ds-content-max`
- Page horizontal padding: `--ds-page-padding-x`
- Page vertical padding: `--ds-page-padding-y`
- Section gap: `--ds-space-section`

Desktop에서는 Sidebar와 Main Content를 사용한다. Main Content의 너비는 제한하되 큰 화면에서 지나치게 비어 보이지 않도록 한다.

2-column은 콘텐츠 관계가 명확할 때만 사용한다. Tablet 또는 Mobile에서 한 열로 전환하며 정보의 읽기 순서를 유지한다.

## Surface, Card, and List

기본 정보 구조는 다음과 같다.

`Page background → Section → Row / Content → Divider`

Card는 다음 조건에서만 사용한다.

- 다른 정보와 독립적으로 선택하거나 이동할 수 있다.
- 별도의 상태와 action을 가진다.
- 주변 정보와 분리된 하나의 의미 단위다.

같은 section 안의 관련 항목은 card를 반복하지 않고 `ListRow + Divider`로 표현한다. Card 안에 다시 Card를 넣지 않는다.

## Button Hierarchy

한 영역의 강한 Primary CTA는 하나만 둔다.

- Primary: 지금 수행해야 하는 핵심 행동
- Secondary: 비교, 보조 행동, 대안
- Ghost/Text: 세부 정보, 닫기, 이동
- Danger: 삭제 또는 되돌리기 어려운 행동

동일한 시각 강도의 버튼을 한 줄에 여러 개 나열하지 않는다. Icon-only button은 항상 `aria-label`을 제공한다.

## Form Controls

Input, Textarea, Select, SearchInput은 동일한 border, radius, font size, focus ring을 사용한다.

- label은 입력값보다 먼저 읽히도록 배치한다.
- 도움말은 tertiary text를 사용한다.
- 오류는 red border와 오류 문장을 함께 제공한다.
- placeholder만으로 label을 대신하지 않는다.
- disabled는 색상과 cursor 양쪽으로 구분한다.

## Status Colors

- Green: 완료, 성공, 정상 연결
- Amber: 확인 필요, 지각, 변경됨
- Red: 오류, 위험, destructive action
- Gray: 기본, 미제출, 비활성, 보조 정보
- Purple: 상태 색상이 아니라 제품 action과 selection 색상

학습 유형처럼 의미가 상태가 아닌 label은 기본적으로 neutral badge를 사용한다. 색 구분이 학습 판단에 꼭 필요할 때만 제한적으로 확장한다.

## App Shell

Desktop Sidebar 순서는 다음과 같다.

1. Study-ing brand
2. Workspace Switcher
3. 오늘 / 일정 / 기록 / 학습 라이브러리 / 설정
4. 활동함
5. GitLab 연결 상태
6. 사용자 프로필

Workspace Switcher의 닫힌 상태에는 Workspace 이름만 주요 정보로 표시한다. GitLab 프로젝트 경로는 메뉴를 연 뒤 secondary metadata로 제공한다.

GitLab 연결이 정상일 때는 작은 green status와 `GitLab 연결됨`만 보여준다. 정상 상태에 재연결 CTA를 노출하지 않는다. 문제가 있을 때만 설명과 `다시 연결` action을 제공한다.

## Progressive Disclosure

다음 정보는 기본 화면에서 핵심 정보와 같은 강도로 노출하지 않는다.

- GitLab 프로젝트 경로
- 브랜치
- 파일 경로
- revision
- commit ID
- GitLab API 이름
- 내부 저장 구조

기술 정보가 필요한 화면에서는 `세부 정보`, `GitLab 정보`, `고급 설정`을 통해 열어볼 수 있게 한다. 사용자 문구를 먼저 제공하고 기술 용어는 metadata로 배치한다.

저장 위치·브랜치·커밋처럼 저장 Provider에 공통적인 정보는 `StorageDetails`를 사용한다. 컴포넌트 이름과 내부 인터페이스는 Provider에 종속시키지 않되, 실제 연결된 Provider가 GitLab이면 사용자 문구에는 `GitLab 저장 정보`처럼 정확한 이름을 표시한다.

## Workspace Entry and Connection

`/workspaces`는 참여 중인 Workspace 선택과 최근 삭제 복원의 기준 화면이다. Sidebar Switcher는 최근/현재 Workspace와 `모든 Workspace`, `새 Workspace 연결`만 제공하며, Workspace가 많아져도 전체 관리 기능을 작은 메뉴 안에 넣지 않는다.

`/workspaces/new`는 Repository 연결 전용 Full Page Flow다. Repository 선택 → 권한 및 기본 브랜치 확인 → 기존 학습 기록 분석 → 연결 순서로 점진적으로 내용을 공개한다. 복원은 이 화면에 섞지 않는다.

- Workspace 이름과 Repository 이름은 서로 다른 개념이며 사용자가 Workspace 이름을 변경할 수 있다.
- 사용자 UI의 제품 용어는 `Workspace`로 통일한다. `워크스페이스`를 페이지마다 혼용하지 않는다. App Role은 내부 enum을 유지하되 사용자에게 `소유자`, `관리자`, `멤버`로 표시한다.
- Repository visibility는 `비공개`, `내부`, `공개`처럼 사용자 언어로 표시한다.
- 쓰기 권한 부족은 최종 저장 전에 차단하고 현재 권한과 필요한 권한을 함께 설명한다.
- Repository 권한 성공은 `프로젝트 권한을 확인했어요`로 표현하고 Workspace 연결 가능 여부를 확정하지 않는다. 실제 연결 준비 상태는 별도의 Study-ing 저장소 분석 결과가 결정한다. GitLab의 Maintainer/Developer 같은 raw access level은 접힌 권한 상세에만 둔다.
- 기존 학습 기록은 일정·제출을 먼저 요약하고 전체 파일 수는 세부 정보로 낮춘다.
- 충돌은 사용자 중심 요약을 먼저 보여주고 raw path는 `문제 상세 보기` 안에 둔다.
- 첫 Workspace도 동일한 `WorkspaceConnectionFlow`를 재사용하고 App Shell 대신 Onboarding Shell만 다르게 사용한다.

Frontend의 새 UI 모델은 `Repository`, `RepositoryConnection`, `RepositoryProvider`를 사용한다. 현재 Backend 계약의 GitLab 필드는 adapter에서 변환하며, 현재 지원하지 않는 GitHub나 Managed Storage 선택지는 노출하지 않는다. Sidebar 연결 상태는 개인 계정 목록이 아니라 현재 Workspace의 Repository Provider 상태를 뜻한다.

Workspace Discovery는 현재 사용자의 Provider 프로젝트 접근 목록과 활성 Repository Connection을 서버에서 외부 Repository ID로 매칭한다. `/workspaces`의 `참여 가능한 Workspace`는 아직 활성 멤버가 아니고 GitLab Developer 이상의 쓰기 권한이 확인된 항목만 표시한다. 사용자가 `참여하기`를 선택하면 서버가 권한을 다시 확인한 뒤 Study-ing 역할 `MEMBER`로 등록한다. Repository Permission으로 `OWNER`나 `MANAGER`를 자동 부여하지 않으며 Soft Deleted Workspace는 노출하거나 Join하지 않는다.

`/workspaces/new`는 연결되지 않은 Repository의 새 Workspace 생성, 이미 참여 중인 Repository의 Workspace 이동, 참여 가능한 기존 Repository의 Workspace Join을 구분한다. 신규 Workspace 생성 시에도 Repository 멤버 전원을 자동 가입시키지 않는다. Invite token과 자동 Join은 여전히 지원하지 않는다.

최초 Profile 설정에서 표시 이름은 Workspace·일정·제출·리뷰의 사용자 이름이다. Provider와 무관한 `학습 기록 이름`과 시간대는 자동 기본값을 제공하고 고급 설정으로 낮춘다. Provider 계정 관리는 이후 일반 Settings가 담당한다.

## Settings

Settings는 현재 Workspace와 개인 Study-ing 환경을 관리하되 다음 Scope를 섞지 않는다.

- Workspace: 일반, 학습 규칙, 멤버, Workspace 알림, 저장소 연결, 데이터 및 동기화
- 내 설정: 프로필, 연결된 계정, 화면 설정, 계정 관리
- 고급: 보안 및 감사, Workspace 위험 영역

Desktop은 Settings 내부의 세로 navigation과 선택된 content를 사용한다. Mobile은 navigation을 하나의 section selector로 바꾸고 content를 한 열로 표시한다. App Sidebar에는 Settings 하위 메뉴를 추가하지 않는다.

Workspace의 Repository Connection과 개인 Connected Account는 서로 다른 설정이다. 현재 Workspace의 GitLab 프로젝트·브랜치·동기화 상태는 `저장소 연결`에서 확인하고, 개인 GitLab OAuth 재승인은 `연결된 계정`에서 수행한다. 재승인이 Workspace의 Repository를 바꾸는 것처럼 표현하지 않는다.

Workspace 시간대는 일정과 마감 계산 기준이며 `Workspace > 일반`에 둔다. 개인 시간대는 내 화면 표시 기준이며 `내 설정 > 프로필`에 둔다. 알림 값은 현재 Backend의 `WorkspaceSettings`에 저장되므로 Workspace 전체 설정으로 표시한다.

Workspace·프로필 Form은 값이 바뀌었을 때만 저장 action을 활성화하고, 저장되지 않은 상태에서 section·route·browser history·Workspace를 변경하면 이탈 확인을 제공한다. 시간대는 유효한 IANA timezone 선택만 허용한다. Workspace 알림은 소유자/관리자의 즉시 저장 설정이며 저장 중에는 해당 switch를 잠그고 성공 Toast 또는 inline error를 제공한다.

Settings 권한은 Backend 정책과 동일하게 유지한다. 소유자와 관리자는 Workspace 일반·알림·동기화를 관리하고, 역할 변경·저장 구조 이전·Workspace 삭제는 소유자만 수행한다. Member에게 사용할 수 없는 관리 action을 disabled 상태로 상시 노출하지 않으며, 소유자 전용 direct route도 권한 안내 상태에서 차단한다.

멤버 화면은 Study-ing 역할(`소유자`, `관리자`, `멤버`)과 실제 Provider 저장소 권한을 별도 label과 hierarchy로 표시한다. GitLab 권한은 이 화면의 접근 상태 확인 목적에 한해 raw permission label을 제공할 수 있다. 마지막 소유자 유지 등의 역할 제약은 Backend 계약을 따른다.

저장 구조 이전은 `/settings/data/migrate` Full Page Flow를 사용한다. 대상 수와 사용자 중심 상태를 먼저 보여주고, 이 workflow에서 실제 확인이 필요한 source/target path만 기술 상세로 표시한다. 짧은 최종 확인과 삭제 확인만 Dialog를 사용한다.

개인 계정 탈퇴와 Workspace 삭제는 서로 다른 화면과 Danger Surface에 둔다. Workspace 삭제는 소유자에게만 보이고 7일 Soft Delete/Hub 복원 및 GitLab 원본 유지 정책을 명확히 설명한다. 계정 탈퇴는 개인 정보·credential 삭제, Workspace 멤버 익명화, GitLab 원본 유지 정책을 설명한다.

현재 점수 정책은 모든 Workspace에 고정된 `1차 마감 10P / 2차 마감 6P / 그 외 0P`이며 변경 가능한 toggle로 표시하지 않는다. Workspace별 Score/Ranking 설정, Repository 연결 해제, Join/Discovery, invite token은 현재 API가 없는 기능 Gap이다. GitHub와 Study-ing Managed Storage 옵션도 실제 지원 전에는 노출하지 않는다.

## Learning Library

학습 라이브러리는 `/library` namespace를 사용한다. 기존 `/repository`는 호환 경로로만 유지하며, 실제 Git repository를 뜻하는 Backend·Integration의 Repository 용어와 사용자-facing 학습 라이브러리를 구분한다.

- 학습 세션 목록: 날짜·주제·학습 내용·제출 인원을 우선하고 마감·진행률·revision은 주요 UI에서 제외한다.
- 학습 세션 상세: 설명 → 학습 항목 → 팀 제출 → `StorageDetails` 순서의 읽기 중심 Archive Page를 사용한다.
- 팀 문서: Card Grid보다 Document Row와 Divider를 우선하며 New/Edit은 Full Page, Detail은 최대 `760px` reading width를 사용한다.
- 제출 열람과 리뷰: 새 flow를 만들지 않고 공통 `MemberDetailDialog`와 선행 열람 경고를 재사용한다.
- 검색 범위: 실제 Workspace payload 또는 Backend query가 제공하는 필드만 문구에 표시한다.

## Modal, Page, Drawer

### Modal 또는 Dialog

- 학습 제출
- 제출 확인
- 삭제 확인
- 답안 선행 열람 경고
- 짧은 리뷰

### Page

- 일정 생성과 편집
- Workspace 연결
- 팀 문서 작성과 편집
- 복잡한 설정
- 데이터 이전

### Drawer 또는 Sheet

- 모바일 내비게이션
- 활동함처럼 현재 문맥을 유지하는 보조 목록

활동함은 현재 Workspace 범위의 미처리 항목만 보여준다. `해야 할 일` 수는 남은 필수 학습 항목 수, `새 소식` 수는 읽지 않은 알림 수이며 Sidebar badge는 두 값을 합산한다. Desktop은 우측 Drawer, Mobile은 full-screen Sheet를 사용한다. 알림은 event summary와 사용자 친화적 시간만 표시하고 관련 Schedule·Library·Settings로 이동하며, 제출 열람은 Library의 공통 선행 열람 경고를 우회하지 않는다. 현재 알림 API는 사용자 기준 최근 50개를 반환하므로 UI는 그 결과를 현재 Workspace로 필터링하고 50개 이상이면 제한을 안내한다.

Desktop modal은 중앙 panel을 사용한다. Mobile modal은 full-width sheet 또는 full-screen 형태로 전환한다. 긴 form을 modal에 추가하지 않는다.

## Responsive Rules

- Desktop: Sidebar + Main Content
- Tablet/Mobile: Top Header + Hamburger + Slide-out Navigation
- 2-column content: Mobile에서 1-column
- modal: 작은 화면에서 full-width/full-screen sheet
- 표와 차트: 중요한 label과 값을 row/card로 재배치하고 수평 스크롤만을 유일한 해결책으로 삼지 않는다.

기본 shell breakpoint는 `960px`, compact content breakpoint는 `720px`다.

## Accessibility and Micro UX

- 모든 interactive element는 keyboard focus가 보여야 한다.
- icon-only button은 `aria-label`을 가진다.
- modal은 focus trap, Escape 닫기, 이전 focus 복귀를 지원한다.
- hover에만 action을 숨기지 않는다. Mobile과 keyboard focus에서도 접근 가능해야 한다.
- loading, empty, error, disabled state를 유지한다.
- 애니메이션은 짧게 사용하며 `prefers-reduced-motion`을 존중한다.
- 상태는 색상만으로 전달하지 않고 label 또는 icon을 함께 제공한다.

## Copy and Language

사용자의 학습 행동을 먼저 표현한다.

- `GitLab Repository Files API` → `GitLab 저장 정보`
- `Revision 4` → `일정이 변경되었어요` + 세부 정보의 revision
- `Commit failed` → `변경사항을 저장하지 못했어요`
- `Repository` → `학습 라이브러리`

기술 용어는 오류 해결, 감사, 고급 설정 등 실제로 필요한 문맥에서만 사용한다.

## Page Redesign Checklist

향후 각 페이지를 수정할 때 다음을 확인한다.

1. 첫 화면에서 오늘의 목표·진행·다음 action이 보이는가
2. 한 영역의 Primary CTA가 하나인가
3. 기술 metadata가 학습 콘텐츠보다 강하지 않은가
4. 관련 row가 불필요하게 여러 card로 쪼개지지 않았는가
5. 공통 token과 primitive를 재사용했는가
6. Desktop, Tablet, Mobile에서 정보 순서가 유지되는가
7. loading, empty, error, focus, disabled 상태가 남아 있는가
