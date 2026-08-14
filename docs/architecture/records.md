# Records 분석 지표 정의

`/records`는 [디자인 시스템](../design/design-system.md)을 따르며 Records를 기간 분석으로 다룬다. 제출 내용, 학습 항목 상세, review와 Provider 원본은 Library에 둔다.

## 기간 모델

- 주간: 선택 날짜가 속한 월요일부터 일요일까지다. 요약, 일별 완료율 chart와 멤버 평균은 해당 주의 활성 session을 사용한다.
- 월간: 날짜가 선택한 월로 시작하는 활성 session이다. 요약, 완료 calendar와 선택 날짜 분석 요약은 해당 월을 사용한다.
- 기존 `day` mode는 한 session을 나타내면서 주간 chart와 월간 calendar를 함께 표시했고, 기존 `month` mode도 월과 선택 주를 섞었다. 현재 control과 내용은 같은 범위를 설명한다.
- Workspace 기준일 이후의 주·월로 이동할 수 없다.

## 지표 정의

- 일별 완료율: 활성 멤버가 완료한 활성 필수 항목 slot 수 / 활성 멤버의 전체 활성 필수 항목 slot 수.
- 팀 평균 완료율(`팀 평균 완료율`): 선택한 주 또는 월의 활성 session별 팀 완료율을 가중치 없이 평균한다. session이 없는 날짜는 0%로 보지 않고 제외한다.
- 학습일: 선택 기간의 활성 session 수.
- 완료 항목(`완료 항목`): 선택 기간에 활성 멤버가 완료한 활성 필수 항목 slot의 합이며 submission object 수가 아니다.
- 멤버 평균: 선택 기간의 활성 session에서 해당 멤버의 필수 항목 완료율을 가중치 없이 평균한다.
- session이 없는 날은 `No data`, 완료한 필수 항목이 없는 session은 `0%`다.

이 정의는 Frontend의 `getDashboardMetrics`와 Backend `/dashboard`, `/records` 계산과 일치한다.

## 점수와 순위 정책

현재 Workspace 설정과 Backend 계약에는 점수·순위 활성화 field가 없다. 따라서 현재 계약에서 점수와 팀 순위는 고정 Workspace 제품 정책이며 가짜 toggle이나 disabled UI를 제공하지 않는다. 정책은 domain metrics layer에 두어 Records만의 UI 규칙을 만들지 않고 향후 설정 가능한 Study Rule을 사용할 수 있게 한다.

- 1차 마감 제출: 활성 필수 항목당 10점.
- 2차 마감 제출: 활성 필수 항목당 6점.
- 그 외 또는 누락: 0점.
- 순위: 점수 내림차순이며 같은 점수는 같은 순위다.

Backend는 현재 요청 기간의 모든 필수 항목을 `maxPoints`에 포함하고 마감 전이라도 누락 제출을 0점으로 본다. 따라서 dialog는 모든 0점 항목이 지각이라고 단정하지 않고 `점수 없는 항목`이라고 표시한다.

## Calendar 의미

- 완료율: 중립색에서 보라색까지 일별 완료율에 따른 배경 강도.
- 선택 날짜: 보라색 border와 outline.
- 오늘: 보라색 날짜 글자와 작은 점.
- session 없음: 중립 배경과 명시적인 접근성 text.
- 각 날짜의 접근성 label은 날짜, 완료/session 없음, 오늘 여부와 선택 여부를 제공한다.

## 콘텐츠 경계

선택 날짜 요약에는 날짜, 유형, 제목, 완료율, 현재 멤버 완료 여부, 제출 멤버 수와 항목 수가 포함된다. `학습 세션 보기`는 `/library/sessions/:date`로 연결한다. Records는 submission 또는 review 상세를 직접 열지 않는다.

## 검증

Records 계산은 Backend service test와 Frontend Records/E2E test로 검증한다. Screenshot과 Playwright report는 local 또는 CI artifact로 생성하며 repository에 commit하지 않는다.
