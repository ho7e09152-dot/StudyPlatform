# Study-ing Information Density & Typography Audit

> Status: implementation baseline
> Audited: 2026-08-13
> Scope: authenticated product UI at 1440×900 and 390×844
> Source of truth: `docs/design-system.md`, `frontend/app/design-system.css`, current shared components and current demo data

## Executive summary

The current information architecture is stable. The main readability issue is not a missing layout pattern; it is repeated expression of the same state and C-level metadata occupying the space needed by A/B-level content.

The highest-value reductions are:

1. show progress as a count plus a progress bar, not count + percent + bar;
2. remove source/submission-format metadata from Today and schedule rows when the available action already determines the next step;
3. remove exact recent-submission/update timestamps from overview lists;
4. remove repeated row labels such as `평균 완료율` where the section already defines the metric;
5. move repository sync/project identifiers and change actor/time into existing detail disclosures;
6. use the recovered space for role-based type tokens and comfortable line-height, without shrinking row tap targets.

No navigation, route, API contract, primary action, warning, deadline, permission state, or content ownership boundary is changed by this audit.

## Priority model

- **A — Action Critical:** next action, deadline, blocking warning, required status, permission/error recovery.
- **B — Context Important:** title, date, progress count, team status, learning type.
- **C — Supporting Metadata:** recent update/submission time, actor, source, submission format, full repository path.
- **D — Technical/Audit:** project ID, revision, file path, raw permission, commit/provider implementation metadata.

## Evidence captured before change

Current-run evidence is stored under `artifacts/information-density-audit/before/`.

- Desktop: Today, Schedule, Schedule detail, Library sessions/documents, Library session/document detail, Records, Workspace Hub/Connect, Settings, Activity and Submission.
- Mobile: the same states at 390×844.
- Theme: Light is the primary density baseline; the existing neutral-charcoal Dark Theme is a contrast regression target only.
- Layout result: no horizontal overflow was observed in the captured product screens.
- Capture limitation: Workspace discovery/project calls reported local backend connection errors in the first capture environment. The density assessment for those components is therefore also grounded in their rendered demo state and source inventory; this is not treated as a product error.

Representative evidence:

- `before/desktop/01-today.png`
- `before/mobile/01-today.png`
- `before/desktop/03-schedule-detail.png`
- `before/mobile/04-library.png`
- `before/desktop/08-records.png`
- `before/mobile/12-settings-repository.png`

## Screen and component inventory

| Page / Component | Current information | Priority A/B/C/D | Redundancy | Proposed action | Decision |
| --- | --- | --- | --- | --- | --- |
| Today / Focus progress | Current learning, next learning, deadline, `2개 중 1개`, `50%`, progress bar | A: next action/deadline; B: count; C: percentage duplicate | Count, percentage and bar express one fact three times | Keep `1 / 2 완료` and the bar; remove the visible percentage | Remove + Typography increase |
| Today / Learning row | Status icon, title, status text, source, submission format, material link, action | A: title/action; B: material link; C: source/format; duplicated status | Icon/action and status text repeat completion/next state | Keep title, material link and action; keep status in accessible text, remove default source/format/status metadata | Remove |
| Today / Team progress header | Completed member count, percent, bar | B: count; C: duplicate percentage | Same aggregate shown three ways | Keep member count and bar; remove visible percent | Remove |
| Today / Team member row | Name, exact recent submission time, item count, status, review affordance | A: review-needed; B: count/status; C: exact time | Time does not change the overview action | Remove exact recent submission time; keep count and actionable status | Remove |
| Today / Schedule change notice | Change summary, actor, exact timestamp, detail action | A: what changed/action; C: actor/time | Summary is diluted by audit metadata | Keep summary; move actor/time into existing change detail | Move to Detail |
| Today / Team notice | Title, content, author, exact time | A/B: title/content; C: exact time/author in overview | Metadata forms a third reading line on mobile | Keep title/content; retain only concise date when needed | Remove / simplify |
| Schedule / Index row | Date/type/title, item count, two deadlines, my progress, team progress, status, arrow | A: nearest deadline/status; B: title/my progress; C: team aggregate here | Team progress is already available in Today/detail/Records | Keep nearest actionable deadline, item count, own progress and status; remove team aggregate from index | Remove |
| Schedule / Calendar cell | Date and schedule title | A/B | No material redundancy | Preserve current low-density cell | Keep |
| Schedule / Detail progress | Count, percent, bar for personal and team progress | A/B count; C percentage duplicate | Same progress repeated | Keep count and bar; remove visible percentage | Remove |
| Schedule / Detail learning/member rows | Status/source/format/required plus action; recent submission time/count/status | A: action/review; B: count/status; C: source/format/time | Same patterns as Today | Apply the shared Today density policy | Remove |
| Schedule / Create & Edit forms | Labels plus helper copy | A: validation; B: non-obvious helper; C: label restatement | Some helpers restate their labels | Keep only policy/behavior helpers; remove tautological helper copy when present | Remove selectively |
| Library / Session row | Type/title/description, item preview, item count, team submissions, recent update, arrow | A/B: title/description/count; C: preview/update time | Preview and update time create two low-value lines | Keep title, short description and core counts; remove item preview and recent update | Remove |
| Library / Session header | Type/title/date/item count/team submission count | A/B: title/date/items; C: team count duplicated by section | Team count repeats immediately below | Keep date and item count; show team count once in its section | Remove |
| Library / Session items | Title, source, submission format, required marker, material link | A: title/material; B: optional/required where actionable; C: source/format in archive | Storage/input details do not drive archive reading | Keep title/material; move technical storage information to existing Storage Details | Remove / Move to Detail |
| Library / Team submission rows | Name, exact submission time, item count, status | A: review-needed; B: count/status; C: exact time | Exact time is available in member detail | Remove exact time; keep count/status | Remove |
| Library / Team document row | Title, 1–2-line preview, author, exact update time, modified/own markers, arrow | A/B: title/preview; C: exact time/ownership label | `수정` and `내 문서` add state without changing row action | Keep title/preview and `author · date`; remove redundant ownership/modified labels | Remove + simplify |
| Library / Document reader | Title, author/update time, content | A/B: title/content; C: exact metadata | Content hierarchy is already strong | Preserve layout; format metadata concisely | Keep / simplify |
| Records / Summary metrics | Value, label and repeated denominator helper | A/B: value/label; C: repeated helper | Metric basis is repeated per card | Put calculation basis in one section-level sentence where needed | Move to section context |
| Records / Member row | Name, repeated `평균 완료율`, bar, percent | A/B: name/value/bar; C: repeated label | Section already defines the metric | Remove row-level label; keep name, bar and percent | Remove |
| Workspace Hub / My Workspace | Name, provider, full path, role, current state | A: current state/action; B: name/role/provider; C: full path | Full path wraps on mobile and rarely changes selection | Keep on desktop as secondary identity; hide path on mobile, retaining provider | Responsive Hide |
| Workspace Hub / Discoverable | Name, provider/path, eligibility confirmation, join action | A: name/join; B: provider/path; C: eligibility confirmation | Section title already guarantees join eligibility | Remove `저장소 쓰기 권한 확인됨`; show permission copy only for exception states | Remove |
| Workspace Connect / Header and row | Provider OAuth explanation/PAT helper; repository name/path/visibility/state | A: row state/action; B: identity/visibility; C: PAT implementation detail | PAT explanation is not needed for repository choice | Shorten header to accessible-project behavior; keep row identity/state | Remove / simplify |
| Settings / General | Section descriptions, labels, helpers, current state and role | A: editable fields/save; B: cross-domain policy helpers; C: label restatement | Some helpers restate visible labels | Keep only time-zone/lifecycle/role-boundary explanations; shorten generic copy | Remove selectively |
| Settings / Repository | Provider/path/status surface, repeated provider/path row, branch, recent sync, details with project ID | A: status/reconnect; B: provider/repository/branch; C: sync time; D: ID/path details | Provider/path appears twice | Keep provider/repository/branch/status once; move recent sync and technical identifiers into existing details | Move to Detail |
| Settings / Connected Accounts | Provider, username, status, reauthorize action, long explanatory note | A: reauthorize; B: identity/status; C: implementation explanation | Row is already concise; note repeats domain separation verbosely | Keep row; shorten note to one sentence | Keep / simplify |
| Activity / Todo | Title, remaining item, deadline | A/B | No material redundancy | Preserve | Keep |
| Activity / News | Title, short description, relative time, unread state | A/B | No material redundancy | Preserve | Keep |
| Submission Dialog / Sheet | Item, input, action, submission format, collapsed storage details | A: input/action; B: format; C/D: storage metadata | Progressive disclosure already works | Preserve; do not remove input-critical format information | Keep |
| Member Review | Header completion summary/time, per-item completion, total count, review content | A: review/content; B: item status; C: duplicate header/time | Aggregate and item status repeat completion | Keep review content and item-level status; simplify header metadata | Remove selectively |
| Login | Product login copy, OAuth/PAT/browser security detail | A: login/recovery; B: safe-login context; C: implementation detail | Existing structure is compact | Keep current structure; technical detail remains secondary and concise | Keep |
| Sidebar | Navigation, provider status, user identity | A/B | No material redundancy | Preserve; provider status remains workspace-scoped | Keep |

## Typography decisions

The current role tokens are `page-title`, `section-title`, `content`, `body`, `body-small`, and `metadata`. They are structurally sufficient, so this audit will not introduce another type system.

Changes are limited to readability roles after metadata removal:

- preserve the existing responsive page-title clamp;
- raise section titles from 18px to 19px;
- raise primary row/content text from 15px to 16px;
- raise body text from 14px to 15px;
- raise secondary body text from 13px to 14px;
- keep true captions/metadata at 12px and avoid using that token for essential state;
- give Korean body copy a 1.65 line-height while keeping compact row metadata locally controlled.

This is a role-based adjustment, not a blanket `+2px` transform. Public Landing typography and the Dark Theme color tokens are out of scope.

### Follow-up correction — modal content

Post-deployment review found that the shared modal header and form controls consumed the new role tokens, while several legacy modal-body selectors still rendered actionable labels and primary content at 9–12px. Submission item labels, submission type/source links, review/session detail content and technical disclosure captions now use the same `content`, `body-small` and `metadata` roles as their equivalent page content. The information and interaction structure is unchanged; only the missed modal-body typography hierarchy is corrected.

## Responsive content policy

- Desktop may show A + B and only the C metadata that materially disambiguates a row.
- Mobile shows A + B; full repository paths and exact overview timestamps are removed or hidden.
- Deadlines, permission/reconnect warnings, unsaved state, error recovery, review-needed state and conflict messages remain visible at every viewport.
- Removed visual status is retained in an accessible name where it is needed to understand an icon-only state.

## Expected reduction

The implementation targets roughly 20% fewer default metadata fragments across Today, Schedule, Library, Records, Workspace Hub and Settings. This is a directional target only; A/B information is not removed to satisfy a count.

## Regression gates

- Light and neutral-charcoal Dark themes keep readable secondary text.
- Desktop 1440×900 and Mobile 390×844 have no body overflow.
- Tap targets and row height are not reduced solely because text was removed.
- Focus, aria labels, progress labels, warning and error recovery remain intact.
- Landing, navigation, routes, APIs and core flows remain unchanged.
