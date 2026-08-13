# Records analytics definitions

`/records` follows the [design system](../design/design-system.md) and treats Records as period analytics. Submission content, learning-item detail, reviews, and provider originals remain in Library.

## Period model

- Weekly: Monday through Sunday around the selected date. Summary, daily completion chart, and member averages use active sessions inside that week.
- Monthly: active sessions whose date starts with the selected month. Summary, completion calendar, and the selected-date analytics summary use that month.
- The previous `day` mode represented one selected session but still rendered a weekly chart and monthly calendar. The previous `month` mode aggregated the month while also rendering the selected week, so the controls and content did not describe the same scope.
- Future week/month navigation is disabled relative to the Workspace reference date.

## Metric definitions

- Daily completion rate: completed active required-item slots across active members / all active required-item slots across active members.
- Team average completion (`팀 평균 완료율`): the unweighted mean of team-wide daily completion rates for active sessions in the selected week or month. Dates without a session are excluded rather than treated as 0%.
- Learning days: count of active sessions in the selected period.
- Completed items (`완료 항목`): sum of completed active required-item slots across active members in the selected period. This is not the number of submission objects.
- Member average: the unweighted mean of that member's required-item completion rate for active sessions in the selected period.
- A day with no session is `No data`; a session with no completed required item is `0%`.

These definitions match `getDashboardMetrics` in the frontend and the backend `/dashboard` and `/records` calculations.

## Score and ranking policy

The current Workspace settings and Backend contract do not expose score-enabled or ranking-enabled policy fields. Score and team ranking are therefore a fixed Workspace product policy in the current contract; no fake toggle or disabled-state UI was added. The fixed policy lives in the domain metrics layer so Records does not introduce an additional UI-only rule and can later consume a configurable Study Rule policy.

- Primary-deadline submission: 10 points per active required item.
- Secondary-deadline submission: 6 points per active required item.
- Otherwise or missing: 0 points.
- Ranking: points descending; equal point totals share a rank.

The Backend currently counts every required item in the requested period in `maxPoints` and treats a missing submission as 0 points without waiting for its deadline to pass. The dialog therefore uses the accurate label `점수 없는 항목` instead of claiming every zero-point item is already late.

## Calendar semantics

- Completion: neutral-to-purple background intensity based on the daily completion rate.
- Selected date: purple border and outline.
- Today: purple date text and a small dot.
- No session: neutral background and explicit accessible text.
- Each date exposes date, completion/no-session state, today state, and selected state through its accessible label.

## Content boundary

The selected-date summary contains date, type, title, completion rate, current-member completion, submitted-member count, and item count. `학습 세션 보기` links to `/library/sessions/:date`. Records no longer opens submission or review detail directly.

## Verification

Records 계산은 backend service test와 frontend Records/E2E test로 검증합니다. Screenshot과 Playwright report는 로컬 또는 CI artifact로 생성하며 repository에 commit하지 않습니다.
