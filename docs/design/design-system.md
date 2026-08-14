# Study-ing 디자인 시스템

> 상태: 현재 구현 기준 · 2026-08-14
>
> 범위: Public/Auth 화면과 로그인 후 App UI
>
> 목적: 다른 개발자가 현재 UI의 규칙을 재사용하고, 기존 화면과 일관된 변경을 만들기 위한 실무 기준

이 문서는 디자인 원칙과 사용 규칙의 정본이다. 실제 값과 cascade의 구현 정본은 아래 CSS 파일이다. 새 화면은 기존 semantic token과 공통 foundation을 우선 사용하고, 같은 의미의 색상·간격·motion을 페이지 안에서 다시 정의하지 않는다.

## 구현 위치와 cascade

[`frontend/app/layout.tsx`](../../frontend/app/layout.tsx)는 CSS를 다음 순서로 불러온다. 뒤에 로드되는 파일이 같은 specificity의 앞선 선언을 덮어쓴다.

| 순서 | 파일 | 현재 역할 |
| --- | --- | --- |
| 1 | [`globals.css`](../../frontend/app/globals.css) | 기존 전역·페이지별 스타일, 인증된 App의 theme/accent override |
| 2 | [`design-system.css`](../../frontend/app/design-system.css) | semantic token, 공통 interaction, Public/Auth/App shell 및 최신 feature refinement |
| 3 | [`settings.css`](../../frontend/app/settings.css) | Settings 전용 layout과 component refinement |

- 새 코드는 `--ds-*` semantic token을 우선 사용한다.
- `--app-*`와 일부 기존 변수는 점진적 이전을 위한 compatibility alias다. 새 alias를 추가하기보다 `--ds-*`에 연결한다.
- literal color, 임의 duration, 임의 shadow를 page stylesheet에 추가하지 않는다. Provider 공식 색상처럼 의미가 명확한 예외만 허용한다.
- 기존 CSS의 대규모 일괄 변환은 하지 않는다. 기능을 수정하는 범위에서 함께 token으로 이전한다.

## 핵심 원칙

- 학습 기록과 사용자의 다음 행동이 장식보다 먼저 읽혀야 한다.
- 한 사실은 한 번만 표현한다. 동일 상태를 icon, badge, 문구, 숫자로 반복하지 않는다.
- Neutral surface가 UI의 기반이고 Study-ing purple은 primary action, focus, active/selected state에 사용한다.
- Provider identity와 Workspace repository provider를 구분한다. 연결 capability가 없는 기능은 노출하지 않는다.
- Desktop과 mobile에서 같은 핵심 흐름을 완료할 수 있어야 한다.
- Motion은 상태 변화를 설명하며, 화면을 장식하거나 응답을 늦추지 않는다.

## Color token

### Light theme

| 역할 | Token | 값 |
| --- | --- | --- |
| Primary | `--ds-color-primary` | `#6653c7` |
| Primary hover | `--ds-color-primary-hover` | `#5542b4` |
| Primary soft | `--ds-color-primary-soft` | `#eeebff` |
| App canvas | `--ds-color-canvas` | `#f7f7f9` |
| Surface | `--ds-color-surface` | `#ffffff` |
| Secondary surface | `--ds-color-surface-secondary` | `#f4f4f6` |
| Muted surface | `--ds-color-surface-muted` | `#ececf0` |
| Primary text | `--ds-color-text-primary` | `#1b1b24` |
| Secondary text | `--ds-color-text-secondary` | `#5f606d` |
| Tertiary text | `--ds-color-text-tertiary` | `#858692` |
| Border | `--ds-color-border` | `#e2e2e8` |
| Strong border | `--ds-color-border-strong` | `#cacbd4` |
| Success / soft | `--ds-color-success` / `--ds-color-success-soft` | `#21875e` / `#e6f5ee` |
| Warning / soft | `--ds-color-warning` / `--ds-color-warning-soft` | `#a8640b` / `#fff3dc` |
| Danger / soft | `--ds-color-danger` / `--ds-color-danger-soft` | `#d14343` / `#fdeaea` |

상태는 색만으로 전달하지 않는다. 사용자에게 필요한 상태 문구 또는 accessible name을 함께 제공한다.

### Authenticated App dark theme

Dark theme은 “purple dark”가 아니라 neutral charcoal surface와 purple accent의 조합이다. `.app-frame[data-theme="dark"]`에서 다음 값을 적용한다.

| 역할 | 값 |
| --- | --- |
| App background | `#121214` |
| Sidebar | `#17171a` |
| Surface / card | `#1d1d21` |
| Elevated surface | `#222226` |
| Muted surface | `#28282d` |
| Input | `#19191d` |
| Border / strong border | `#303036` / `#414149` |
| Primary text | `#f5f5f7` |
| Secondary / tertiary text | `#bdbdc4` / `#909099` |
| Overlay | `rgba(7, 7, 9, 0.72)` |

Purple accent의 dark 기본값은 다음과 같다.

| 역할 | 값 |
| --- | --- |
| Accent base | `#7c5cff` |
| Primary text/icon | `#9277ff` |
| Strong accent | `#a18cff` |
| Primary action / hover | `#7858fa` / `#6f4fed` |
| Selected background | `rgba(124, 92, 255, 0.12)` |
| Selected border | `rgba(124, 92, 255, 0.30)` |

Dark surface, border와 muted text에 blue/purple tint를 임의로 추가하지 않는다. Glow, gradient, purple wash를 사용하지 않는다.

### Accent theme

인증된 App은 `.app-frame[data-accent]`로 accent를 선택한다. 현재 지원하는 accent는 purple, blue, teal, orange, rose다. Light 기준 대표 색은 각각 `#6653c7`, `#4263eb`, `#16836f`, `#c76a14`, `#bd456b`이며 dark에서는 대비를 확보한 별도 값을 사용한다.

Accent는 action과 selected/focus 의미에만 사용한다. Provider 색은 Provider icon과 식별 보조에만 사용하고 Study-ing의 primary/focus hierarchy를 대체하지 않는다.

## Theme model

- 로그인 후 App theme은 `AppThemeProvider`와 `.app-frame[data-theme]`, `.app-frame[data-accent]`가 제어한다.
- Sidebar, navigation, card, form control, tab과 divider는 같은 semantic mapping을 사용한다.
- Public/Login은 제품 진입 화면에 맞춘 별도 surface 규칙을 가진다. 인증된 App preference를 무조건 상속시키지 않는다.
- Demo는 실제 계정 설정과 분리하며 최초 진입을 light theme으로 고정한다.
- Theme 전환은 background, color, border-color만 짧게 전환한다. 전체 화면 crossfade는 사용하지 않는다.

## Typography

| 역할 | Token/기준 | 현재 값 |
| --- | --- | --- |
| Page title | `--ds-font-page-title` | `clamp(30px, 3vw, 36px)` |
| Section title | `--ds-font-section-title` | `19px` |
| Row/content title | `--ds-font-content` | `16px` |
| Body | `--ds-font-body` | `15px` |
| Secondary body | `--ds-font-body-small` | `14px` |
| Metadata/caption | `--ds-font-metadata` | `12px` |
| Body line height | `--ds-line-body` | `1.65` |

- 제목 level은 시각 크기가 아니라 문서 구조에 맞춘다.
- 12px는 caption이나 낮은 우선순위 metadata에만 사용한다.
- 한글 body/description은 충분한 line-height를 유지하고, 정보를 줄였다는 이유로 row 높이를 축소하지 않는다.
- 숫자 지표는 label과 관계가 분명해야 하며 동일 값을 percent, fraction, 문장으로 중복하지 않는다.

## Spacing, radius와 elevation

- Spacing scale: `4, 8, 12, 16, 20, 24, 32, 40, 48px`
- 기본 section gap: `24px`
- Radius: `8px` control, `12px` compact surface, `16px` card/dialog, `999px` pill/avatar
- Shadow는 overlay, popover, dialog처럼 실제 elevation이 있는 UI에만 사용한다.
- 일반 list/card의 구조는 spacing과 subtle border로 구분하고 shadow를 중첩하지 않는다.

## Layout과 breakpoint

- Desktop sidebar: `248px`
- Main content maximum: `1200px`
- Main horizontal padding: `clamp(24px, 4vw, 48px)`
- Main vertical padding: `40px`

현재 breakpoint 용도는 다음과 같다.

| 기준 | 주요 용도 |
| --- | --- |
| `1020px` | Records 등 고밀도 feature의 중간 layout |
| `960px` | Desktop AppShell/sidebar와 mobile navigation 전환 |
| `900px` | Settings의 중간 layout |
| `720px` | 공통 1-column/mobile content 전환 |

`--ds-breakpoint-shell`은 문서용 값이며 표준 CSS media query에서 custom property를 직접 사용할 수 없다. 실제 media query는 literal threshold를 사용하므로 새 기준을 만들 때 이 표와 기존 query를 함께 갱신한다.

- Table은 작은 화면에서 의미 있는 list/card 또는 안전한 horizontal scroll container로 바꾼다.
- `min-width: 0`, wrapping, ellipsis를 사용해 긴 이름과 repository path가 viewport를 밀어내지 않게 한다.
- 390×844를 대표 mobile viewport로 확인하고, 좁은 화면에서도 touch target과 primary action을 유지한다.

## Motion

| 역할 | Token | 값 |
| --- | --- | --- |
| Immediate feedback | `--motion-instant` | `100ms` |
| Hover/menu/selection | `--motion-fast` | `140ms` |
| Main content/dialog | `--motion-base` | `200ms` |
| Drawer/sheet | `--motion-slow` | `240ms` |
| Exit | `--motion-exit` | `150ms` |
| Standard easing | `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` |
| Exit easing | `--ease-exit` | `cubic-bezier(0.4, 0, 1, 1)` |

- `opacity`와 `transform`을 우선한다. 큰 shadow, filter, blur를 animation하지 않는다.
- AppShell/sidebar는 route마다 재등장시키지 않고 바뀌는 main content만 전환한다.
- Settings subsection 이동은 설정 content만 전환한다.
- Exit는 enter보다 빠르게 하고, exit 중 닫힌 overlay가 pointer event를 가로채지 않게 한다.
- `transition: all`은 사용하지 않는다. 필요한 property만 명시한다.
- `prefers-reduced-motion: reduce`에서는 translation/scale과 progress motion을 제거하거나 즉시 완료한다. Focus와 상태 변경은 animation 완료를 기다리지 않는다.

## 공통 component foundation

| Foundation | 위치 | 사용 규칙 |
| --- | --- | --- |
| App loading | `components/ui/AppLoadingScreen.tsx` | Login/demo transition의 일관된 brand loading, live status 제공 |
| Avatar | `components/ui/Avatar.tsx` | 사용자 이미지와 fallback initial을 같은 크기/의미로 표현 |
| Modal | `components/ui/Modal.tsx` | 짧은 확인·입력, focus trap, Escape, focus restoration, shared motion |
| Drawer | `components/ui/Drawer.tsx` | 주변 맥락을 유지하는 보조 상세, overlay와 mobile scroll 검증 |
| Page transition | `components/ui/PageTransition.tsx` | AppShell이 아닌 변경되는 main content에만 적용 |
| Progress bar | `components/ui/ProgressBar.tsx` | 상태를 색만으로 표현하지 않고 accessible value/text 제공 |
| Storage details | `components/ui/StorageDetails.tsx` | Provider-aware 기술 정보를 progressive disclosure로 제공 |
| Toast | `components/ui/Toast.tsx` | 짧은 성공·오류 feedback과 screen reader announcement 제공 |

Button, form control, badge는 현재 별도 React primitive가 아니라 공통 CSS class와 semantic token을 사용하는 foundation이다. 화면마다 유사 JSX/CSS를 새로 만들기 전에 기존 `.button` 계열, form control, status badge 패턴을 확인한다. 별도 component가 실제로 생기기 전까지 문서에서 존재한다고 가정하지 않는다.

## Interaction과 content pattern

### Button hierarchy

- Primary: 화면 또는 범위의 대표 action 하나.
- Secondary: 대안, utility 또는 반복 가능한 action.
- Tertiary/ghost: navigation과 낮은 강조의 보조 action.
- Danger: 삭제·철회처럼 되돌리기 어려운 action. 대상과 결과를 확인한다.

Provider login button은 동일한 구조와 neutral surface를 사용한다. GitHub/GitLab은 icon과 미세한 hover surface로 구분하며, Provider 전체를 purple/orange/black으로 채우지 않는다. Focus ring은 Provider 색이 아니라 Study-ing focus token을 사용한다.

### Form

- 모든 input에 연결된 label을 제공하며 placeholder를 label로 사용하지 않는다.
- 도움말은 label만으로 이해하기 어려울 때만 유지한다.
- 오류를 field와 연결하고, 제출 실패 시 사용자가 원인과 다음 행동을 찾을 수 있게 한다.
- Disabled control만 보여주지 말고 비활성 이유가 필요한 경우 가까운 곳에 설명한다.

### Status와 progressive disclosure

- Success, warning, danger, info는 semantic token과 짧은 문구를 함께 사용한다.
- Permission, provider outage, empty data와 network failure를 같은 상태로 표현하지 않는다.
- Repository path, revision, commit과 raw permission은 `StorageDetails` 또는 기존 상세 화면으로 내린다.
- 기본 목록은 action-critical 정보와 현재 맥락만 보여준다. Desktop의 supporting metadata도 mobile에서 행동에 필요하지 않으면 숨길 수 있다.

## Feature 적용 기준

### AppShell과 navigation

Sidebar active state는 subtle accent background와 accent text/icon을 사용한다. 정상 Provider 상태에는 기술 정보를 추가하지 않는다. Personal Provider Account와 현재 Workspace Repository 상태를 혼합하지 않는다.

### Workspace

Workspace Hub/Discovery/Connect는 Workspace 이름을 먼저, Provider와 repository full path를 secondary로 표시한다. Join은 명시적 button에서만 실행한다. GitHub account linking capability를 GitHub repository capability로 표현하지 않는다.

### Settings

Account, Workspace, notification과 destructive action을 구분한다. Settings navigation 이동 시 전체 page가 아니라 변경 content만 motion을 적용한다. 설정 저장 결과는 가까운 field feedback 또는 Toast로 전달한다.

### Schedule, Library와 Records

목록은 제목과 사용자의 다음 행동을 우선한다. Detail은 index보다 metadata가 많을 수 있지만 header, progress와 section에서 같은 값을 반복하지 않는다. Library는 session·team document·review를, Records는 기간 분석을 담당한다.

### Modal, drawer와 sheet

Modal은 고유 URL이 필요 없는 짧은 작업에, page는 긴 편집이나 공유 가능한 경로에 사용한다. Drawer/sheet는 맥락을 유지하는 보조 상세에 사용한다. Overlay는 viewport 전체를 덮어야 하며 modal container의 margin이나 content width에 갇히면 안 된다.

## 접근성과 문구

- Keyboard만으로 모든 interactive element를 사용하고, `focus-visible`을 명확하게 표시한다.
- Icon-only button에는 accessible name을 제공하고 decorative icon은 중복 낭독되지 않게 한다.
- Modal/drawer의 focus trap, Escape와 focus restoration을 유지한다.
- 비동기 인증·저장·오류 상태는 필요한 경우 `aria-live`로 알리고 중복 제출을 막는다.
- 색만으로 완료율, 선택, 오류나 Provider를 구분하지 않는다.
- 사용 문구는 한국어를 기본으로 하며 짧고 다음 행동이 분명해야 한다. API error code나 stack trace는 노출하지 않는다.
- 대비는 Light/Dark 및 hover/disabled 상태에서 실제 렌더링으로 확인한다. 검증하지 않은 상태에서 WCAG 준수를 단정하지 않는다.

## 현재의 transitional constraint

- `globals.css`에는 기존 page-specific rule과 literal color가 아직 많이 남아 있다.
- `design-system.css`도 token뿐 아니라 최신 feature refinement를 포함한다. 지금은 import order가 공개 contract다.
- Breakpoint는 CSS custom property가 아니라 literal media query로 구현되어 있다.
- 모든 control이 React primitive로 통합된 상태는 아니다.

새 기능 때문에 전체 stylesheet를 한 번에 재작성하지 않는다. 수정하는 영역에서 semantic token, shared motion과 공통 component로 점진적으로 이전하고 visual regression을 확인한다.

## 변경 체크리스트

- [ ] 기존 route, API와 사용자 flow를 불필요하게 변경하지 않았다.
- [ ] normal, loading, empty, error와 permission 상태를 확인했다.
- [ ] literal color/duration 대신 기존 token을 재사용했다.
- [ ] 같은 정보나 상태를 중복 표시하지 않았다.
- [ ] Desktop/mobile, Light/Dark, 긴 text와 overflow를 확인했다.
- [ ] Keyboard, focus, label, contrast와 screen reader 문맥을 확인했다.
- [ ] capability와 실제 Backend 권한을 혼동하지 않았다.
- [ ] 관련 unit/component/E2E test와 필요한 screenshot 검증을 수행했다.
