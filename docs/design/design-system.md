# Study-ing 디자인 시스템

이 문서는 현재 구현된 UI foundation의 정본이다. 새 화면은 기존 token과 component를 재사용하고 접근성·반응형·light/dark theme을 함께 검증한다.

## 디자인 철학

- 학습 기록이 장식보다 우선한다. 정보 밀도는 유지하되 action hierarchy를 분명히 한다.
- 같은 상태와 action에는 같은 색, icon, label과 feedback을 사용한다.
- Provider와 Workspace 상태를 혼동하지 않으며 capability가 없는 기능을 암시하지 않는다.
- desktop과 mobile 모두에서 핵심 흐름을 완료할 수 있어야 한다.

## 현재 구조

`app/`은 route와 page 조합, `components/`는 공통 UI와 feature component, `lib/`는 API client·domain 변환·utility를 담당한다. page마다 token이나 공통 component를 복제하지 않는다.

## 디자인 token

### 색상

CSS custom property를 정본으로 사용한다. 배경·surface·border·text·muted·primary·success·warning·danger의 semantic token을 사용하고 literal color를 새로 흩뿌리지 않는다. 상태는 색만으로 전달하지 않고 text 또는 icon을 함께 제공한다.

### Dark theme

Dark theme은 같은 semantic token을 다른 값으로 매핑한다. 새 surface, overlay, chart와 focus 상태는 light/dark에서 모두 contrast를 확인한다.

### Typography

Heading은 정보 구조를, body와 caption은 내용과 보조 설명을 나타낸다. 단순히 크게 보이게 하려고 heading level을 건너뛰지 않는다. 숫자 지표는 비교 가능하도록 안정적인 정렬을 사용한다.

### Spacing, radius, shadow

기존 spacing scale과 radius token을 사용한다. Shadow는 overlay와 hierarchy 표현에만 제한하고 border 없이 구조를 구분하는 수단으로 남용하지 않는다.

### Motion

Motion은 상태 변화 이해를 돕는 짧은 transition에만 사용한다. `prefers-reduced-motion`을 존중하고 필수 정보를 animation에 의존하지 않는다.

## Layout

App shell의 navigation과 content 영역을 유지한다. content width와 gutter는 기존 layout token을 따른다. mobile에서는 horizontal overflow 없이 한 column으로 재배치하고 primary action을 접근 가능한 위치에 둔다.

## Surface, card와 list

Card는 독립된 정보 묶음에, list는 반복되는 같은 유형의 항목에 사용한다. 중첩 card를 피하고 empty·loading·error 상태가 normal content와 같은 영역을 차지하도록 설계한다.

## Button hierarchy

- Primary: 화면의 대표 action 하나.
- Secondary: 대안 또는 반복 가능한 action.
- Tertiary/ghost: 낮은 강조의 navigation·보조 action.
- Danger: 삭제·철회처럼 되돌리기 어려운 action.

Icon-only button에는 접근 가능한 이름을 제공한다. disabled 상태만으로 이유를 숨기지 말고 필요하면 설명한다. destructive action은 대상과 결과를 확인한다.

## Form control

모든 input은 연결된 label, 도움말과 오류 message를 가진다. Placeholder를 label로 사용하지 않는다. Validation 오류는 해당 field와 연결하고 제출 실패 시 focus 또는 summary로 발견할 수 있게 한다.

## 상태 색상

Success, warning, danger, info는 semantic token과 일관된 문구를 사용한다. Provider 오류, 권한 부족, 네트워크 실패와 빈 데이터를 같은 상태로 표현하지 않는다.

## App shell과 점진적 공개

Sidebar는 현재 Workspace navigation과 Provider 연결 상태를 구분한다. 고급 설정은 기본 흐름을 방해하지 않도록 점진적으로 공개하되 중요한 권한·보안 결과를 숨기지 않는다.

## Workspace 진입과 연결

Workspace Discovery, Join, Connect는 서버 capability와 Repository permission을 기준으로 표시한다. GitHub Connected Account를 GitHub Repository 지원으로 표현하지 않는다. Join과 switch 후 이전 Workspace data를 새 Workspace 내용처럼 표시하지 않는다.

## Settings

Account, Workspace, notification과 위험 action을 구분한다. 연결된 계정은 Provider identity와 지원 capability를 정확히 표시한다. 저장 성공·실패는 Toast와 field feedback으로 알린다.

## Learning Library

Library는 session, 제출 내용, review와 Provider 원본 상세의 위치다. Records는 기간 분석을 담당하며 상세 편집 기능을 중복하지 않는다.

## Modal, page, drawer

Modal 또는 dialog는 짧고 집중된 확인·입력에 사용하고 focus trap, 초기 focus, Escape와 focus 복귀를 보장한다. Page는 긴 작업이나 고유 URL이 필요한 흐름에 사용한다. Drawer 또는 sheet는 주변 맥락을 유지하는 보조 상세에 사용하며 mobile 전체 높이와 scroll을 검증한다.

## 반응형 규칙

고정 pixel width에 의존하지 않는다. Table은 작은 화면에서 의미 있는 card/list 또는 안전한 scroll container로 바꾼다. 320px 부근에서도 content와 action이 잘리지 않아야 하며 touch target 크기를 확보한다.

## 접근성과 micro UX

- Keyboard만으로 모든 interactive element를 사용할 수 있어야 한다.
- Visible focus와 올바른 semantic element를 사용한다.
- 비동기 상태는 필요할 때 `aria-live`로 알리고 loading 중 중복 제출을 막는다.
- Image에 목적에 맞는 alt를 제공하고 장식 image는 빈 alt를 사용한다.
- 날짜·점수·완료율에는 색 이외의 text 의미를 제공한다.

## 문구와 언어

사용자 문구는 한국어를 기본으로 하고 짧고 구체적인 action 중심으로 작성한다. API field, error code, Provider·제품명과 기술 고유명은 번역하지 않는다. 내부 오류나 stack trace를 사용자에게 노출하지 않는다.

## Page 재설계 체크리스트

- [ ] 기존 route와 API 계약을 유지하거나 정본을 함께 갱신했다.
- [ ] normal, loading, empty, error, permission-denied 상태가 있다.
- [ ] desktop/mobile, light/dark theme을 확인했다.
- [ ] keyboard, focus, label, contrast와 screen reader 문맥을 확인했다.
- [ ] 공통 token과 component를 재사용했다.
- [ ] capability와 실제 Backend 권한을 혼동하지 않았다.
- [ ] 관련 unit/component/E2E test와 screenshot 검증을 수행했다.
