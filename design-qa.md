# Study-ing `/library` Structural Redesign — Design QA

## Source of truth and environment

- Design source: `docs/design-system.md`
- Reused product patterns: `/today`, `/schedule`, shared `MemberDetailDialog`, `SubmissionReviewPanel`, `Modal`, `StorageDetails`
- Browser target: `https://sandbox.withroro.com/library`
- Desktop viewport: `1440 × 1050`
- Mobile viewport: `390 × 844`
- Locale/timezone: `ko-KR`, `Asia/Seoul`
- Browser evidence: `artifacts/library-redesign-qa/`

## Route migration

The user-facing namespace is now `/library`.

- `/library`
- `/library/sessions/:date`
- `/library/docs/new`
- `/library/docs/:documentId`
- `/library/docs/:documentId/edit`

The Workspace domain stores sessions in a date-keyed map and the backend session/submission/review APIs use the same date identifier, so the archive detail route truthfully reuses `:date`. Legacy `/repository`, `/repository?document=:id`, and matching legacy subroutes render a compatibility transition and replace the URL with the corresponding `/library` route. Backend notification actions now create `/library/docs/:id` links. Actual Git repository API/domain names remain unchanged.

## Information architecture

### Library index

- Page title and product description
- Accessible `학습 세션` / `팀 문서` tabs
- Tab-specific search and the existing session type filter
- Divider-based Session Rows or Document Rows
- Distinct no-data and no-search-result empty states

### Session archive

Session rows prioritize date, topic, title, description/item preview, item count, submitted-member count, and meaningful latest update. Deadline, raw revision, commit/path, and progress bars are excluded. Review counts are not guessed because the backend has no batch review-count endpoint.

Session detail uses Description → Learning Items → Team Submissions → GitLab Storage Details. `일정 보기` links back to the Schedule source. Learning items are content-oriented and Team rows open the shared submission/review dialog.

### Team documents

The previous card grid is now a scan-friendly Document Row list. New/Edit are full routes sharing one editor foundation. Detail uses a `760px` reading width with GFM heading, paragraph, list, checklist, quote, code, inline code, link, and table behavior. Mobile shows either Editor or Preview, never a compressed split view.

## Search support

- Session search is client-side over the complete Workspace snapshot returned by the Workspace API: session title, description, item title, and submission value. The payload is not paginated or partially hydrated, so the placeholder `세션, 학습 항목, 제출 내용 검색` matches the current archive-wide behavior inside the active Workspace.
- The session search does not search unsynchronized provider history or review comments.
- Document search is server-side in production over title, Markdown body, and author display name. The demo adapter applies the same fields.
- QA verifies submission-value search and author search on both viewports.
- Review count is omitted from the index because no truthful batch API exists.

## Submission warning and review reuse

The existing policy condition is preserved: opening another member's submission warns only when the current member still has an active required item without a submission. Self-view and users who completed all required items skip the warning. The warning prioritizes `내 학습 계속하기`; `그래도 보기` remains the lower-priority override.

The detail flow reuses `MemberDetailDialog` → `StorageDetails` → `SubmissionReviewPanel`. No Library-specific review API or dialog was introduced.

## Permissions and delete policy

- Backend permits every active Workspace member to create a team document, so `새 문서` remains available to active members.
- Only the document author receives `canEdit=true`; Edit/Delete controls are hidden for other members.
- Direct non-author edit URLs resolve to an explicit permission state.
- Delete uses the existing version-checked soft delete. The dialog says the item is removed from the team list and cannot be restored from this screen; it does not falsely claim physical/database irreversibility.

## Provider boundary

Provider-facing labels accurately say GitLab for the current connection. Technical file, branch, commit, and revision metadata remain inside the provider-independent `StorageDetails` component. No GitHub or managed-storage option is exposed.

## Responsive and accessibility QA

- Desktop uses Sidebar + content; Mobile uses the existing top header and drawer.
- Session/Document rows reflow without horizontal page scrolling.
- Team submission rows group avatar, name, count, status, and time without collision.
- Document toolbar scrolls only within its control region when necessary.
- Mobile modals retain the existing full-width Sheet behavior, focus trap, Escape/close handling, and focus return.
- Tabs expose tab roles and selection state; toolbar icons have accessible names; status remains textual rather than color-only.

## Browser evidence

Each folder contains the following states; `06b` additionally covers Edit.

- `01-session-list.png`
- `02-session-detail.png`
- `03-pre-submission-warning.png`
- `04-team-submission-review.png`
- `05-team-document-list.png`
- `06-document-new-edit.png`
- `06b-document-edit.png`
- `07-document-preview.png`
- `08-document-detail.png`
- `09-delete-dialog.png`

Evidence folders:

- Desktop: `artifacts/library-redesign-qa/desktop/`
- Mobile: `artifacts/library-redesign-qa/mobile/`
- Automated browser result: `artifacts/library-redesign-qa/qa-results.json`

Visual-polish comparison evidence:

- Before: `artifacts/library-polish-qa/before/`
- After: `artifacts/library-polish-after/`
- Desktop comparison: `artifacts/library-polish-after/comparison-desktop.png`
- Mobile comparison: `artifacts/library-polish-after/comparison-mobile.png`
- Automated polish result: `artifacts/library-polish-after/qa-results.json`

## Verification result

- ESLint: pass
- TypeScript `tsc --noEmit --incremental false`: pass
- Frontend production build: pass
- Frontend Node tests: 6/6 pass
- Backend Gradle tests: 73 total, 72 pass, 1 intentionally skipped, 0 failures
- Browser QA: 20 final screenshots, 0 horizontal overflow failures, 0 console/page errors
- Interaction checks: session submission-body search, document title/body/author search, pre-submission warning, shared review, author-only actions, direct edit denial, legacy deep-link migration, and completed Schedule → Library navigation all pass on Desktop and Mobile

---

# Study-ing `/records` Semantic Consistency + Visual Polish — Design QA

## Comparison target

- Source visual truth: current deployed `/records` before this polish and `docs/design-system.md`
- Before evidence: `artifacts/records-polish-before/`
- Implementation evidence: `artifacts/records-polish-after/`
- Desktop viewport: `1440 × 1050`, 1× density
- Mobile viewport: `390 × 844`, 1× density
- Locale/timezone: `ko-KR`, `Asia/Seoul`
- Compared states: Weekly and Monthly with the same Workspace data, selected date, and period

## Findings and fixes

- P2 resolved — Summary semantics: `평균 완료율` and `총 제출` did not identify the team denominator or the completed-required-item calculation. They now read `팀 평균 완료율` and `완료 항목`.
- P2 resolved — Weekly selected state: the selected 0% day previously filled the entire chart column. Selection now uses the date label and a two-pixel bottom indicator; bar height exclusively represents completion.
- P2 resolved — Mobile no-schedule label: the narrow chart truncated `일정 없음`. Mobile now renders a neutral dash while the full date and no-schedule meaning remain in the button's accessible label.
- P2 resolved — Monthly zero state: active schedule 0% uses the lowest purple tint and explicit `0%`; no schedule remains neutral and has a distinct accessible label.

No focused crop was necessary because all changed copy and state treatments are legible in the same-state full-view comparisons. Fonts, spacing, tokens, asset quality, and content were checked; no unrelated drift or new asset was introduced.

## Interaction and accessibility checks

- Weekly no schedule and 0% are both present and have distinct accessible labels.
- Selected 0% chart column has no filled selection background.
- Monthly 0% and no-schedule cells have different computed backgrounds and labels.
- Summary remains four columns on desktop and 2 × 2 on mobile.
- Score dialog, Library session link, no-session state, and no-data period remain operational.
- No horizontal overflow or console/page errors were found.

## Comparison history

- Pass 1 found the four P2 issues listed above in the before captures.
- After the targeted copy/CSS changes, the same viewport/state captures show all four resolved; no actionable P0/P1/P2 difference remains.

## Final result

final result: passed

---

# Study-ing Final Global Product Design QA

## Audit target and evidence

- Source of truth: `docs/design-system.md`, the page-specific QA records in this document, shared design tokens/components, and the current frontend/backend contracts.
- Baseline evidence: `artifacts/global-product-qa/source/`.
- Final rendered evidence: `artifacts/global-product-qa/rendered/`.
- Same-state comparisons: `artifacts/global-product-qa/comparisons/`.
- Viewports: Desktop `1440 × 900`, Tablet `768 × 1024`, Mobile `390 × 844`, all at 1× density, `ko-KR`, `Asia/Seoul`.
- Inventory: 29 routes × 3 viewports plus 8 common dialog/drawer/sheet states, 95 screenshots total. The Matrix includes Public, OAuth boundary, Workspace/Onboarding, Today, Schedule, Records, Library, Settings, 404, Activity, Submission, Review, and the shared pre-submission warning.

## Severity results and minimal fixes

- P0: none found.
- P1 resolved — unknown routes rendered a blank document. A shared, neutral 404 state now provides `홈으로` and `오늘로 이동` actions without forcing an auth shell onto public users.
- P1 resolved — `/settings/repository` produced a React hydration mismatch because a locale-formatted timestamp used the server environment timezone. User-facing date/time formatting now receives the Workspace timezone deterministically.
- P2 resolved — Terms and Privacy displayed an internal pre-launch legal-review note. The note was removed from production UI and retained in `docs/launch-checklist.md`; legal body meaning was not shortened.
- P2 resolved — Schedule permission copy exposed English App roles. User-facing App roles now consistently use `소유자`, `관리자`, and `멤버` while internal enums remain unchanged.
- P2 resolved — API, sync, submission, schedule, document, and profile failures could surface upstream error text directly. Shared `getUserFacingError` handling now maps authentication, permission, conflict, rate-limit, network, and generic server failures to stable user copy; raw paths/codes remain inside technical disclosures where needed.
- P2 resolved — success Toasts exposed commit SHA, revision, file path, and backend cancellation terminology. Success feedback now describes the user action only. Repository metadata remains available through `StorageDetails`.
- P2 resolved — Today, Schedule, and Library carried separate copies of the pre-submission warning. They now reuse one `PreSubmissionWarning` foundation while preserving the existing policy and routing.
- P2 resolved — the primary Today change notice exposed a raw revision number. Revision remains available only in the technical storage disclosure.
- P3 reviewed, unchanged — unused legacy components (`SessionDetailDialog`, `ProfileSettingsDialog`, and `RepositoryWorkspace`) are no longer imported. They were not removed during the global QA because they do not affect rendered behavior and broad deletion had no direct product value in this pass.

## Product and semantic consistency

- Navigation: App Sidebar remains `오늘 / 일정 / 기록 / 학습 라이브러리 / 설정`, with Activity, Workspace Switcher, and Profile Menu using the shared shell. Mobile uses the accepted Header/Drawer pattern.
- Routes: `/library` is the only user-facing archive namespace. `/repository` and its sub-routes remain compatibility redirects only. No user-facing link targets the legacy namespace.
- Boundaries: Records renders analytics and links to Library; it does not render submission bodies or review threads. Schedule remains the planning source, Library remains the archive, and bilateral Schedule ↔ Library links use centralized helpers. Activity remains summary plus deep link.
- App roles and Repository permission remain distinct. Schedule/general Settings management is Owner/Manager; role change, migration, restore, and Workspace delete are Owner-only; Member retains submission/review access. Restricted direct routes resolve to permission states and backend services enforce the same policy, including last-owner protection.
- Activity is scoped to the selected Workspace. Todo count is missing required actions, News count is unread notifications, and the Sidebar badge is their sum. Workspace switching filters prior Workspace notifications and state.
- Dates and activity times use Korean presentation and the Workspace timezone for Workspace-scoped data. Browser-native form input locale remains the browser's responsibility.

## Provider and storage boundary

- Current user-facing Provider wording accurately says GitLab.
- Shared foundations remain `Repository`, `RepositoryConnection`, `RepositoryProvider`, `RepositoryPermission`, `StorageDetails`, and `AuthProviderButton`.
- GitLab raw permission appears only where Repository access is the subject (member settings or disclosed technical details). Unsupported GitHub and Study-ing Managed Storage UI are not exposed.
- Components render storage metadata progressively; no new requirement that every future Workspace must have a GitLab `repositoryPath` was introduced.

## Route inventory

- Active: `/`, `/login`, `/auth/callback`, `/terms`, `/privacy`, `/onboarding/profile`, `/workspaces`, `/workspaces/new`, `/today`, `/schedule`, `/schedule/:date`, `/schedule/:date/edit`, `/schedule/new`, `/records`, `/library`, `/library/sessions/:date`, `/library/docs/*`, `/settings`, `/settings/:section`, `/settings/data/migrate`.
- Compatibility: `/repository`, `/repository/sessions/:date`, and `/repository/docs/*`; these redirect to their `/library` equivalents.
- Deprecated/dead user routes: none found. Unused legacy components are listed above and can be removed in a separate cleanup.

## Loading, empty, error, and accessibility checks

- Loading remains task-appropriate: OAuth transition, Repository analysis, page fetch, inline save, migration, and Activity do not invent percentage progress.
- Empty states keep context-specific copy for Today, Schedule, Library, Records, Activity, and Workspace rather than collapsing to a generic card.
- Error states distinguish permission, reconnect, conflict, network, validation, and generic server failures without showing stack traces or raw API messages.
- Shared Modal/Drawer foundations retain focus movement, Escape close, outside-click policy, and trigger focus restoration. Mobile Submission/Review/Activity use the accepted sheet/full-screen behavior; small confirms remain dialogs.
- Tabs, Settings navigation, Repository rows, Calendars, Activity items, editor toolbar, and destructive controls retain keyboard labels/focus treatments. Visual screenshot review cannot by itself establish WCAG compliance; automated semantics and interaction tests cover the critical shared flows.

## Responsive and visual comparison

- 87 route renders and 8 shared-state renders reported zero document-level horizontal overflow at Desktop, Tablet, and Mobile widths.
- Landing preview images were explicitly warmed before final full-page capture to verify actual asset rendering; below-the-fold previews remain lazy-loaded in product code.
- Section rhythm, page containers, neutral surfaces, semantic colors, button hierarchy, and Mobile one-column transitions remain within the accepted Design System. No page was structurally redesigned in this pass.
- Same-state comparisons demonstrate the removal of the legal internal note, deterministic Settings timestamp, and the new 404. Shared warning evidence verifies the same component behavior on Desktop and Mobile.

## Brand

- The supplied Study-ing brand icon replaces the previous SSAFY-shaped asset on Landing, Login, App loading, browser icons, and generated public previews.
- User-facing product naming is standardized as `Study-ing`; internal App Role enums and backend domain contracts are unchanged.
- Transparent UI asset: `frontend/public/study-ing-icon.png`; opaque Apple touch asset: `frontend/public/study-ing-icon-white.jpg`.
- Brand refresh evidence: `artifacts/brand-refresh/desktop/` and `artifacts/brand-refresh/mobile/`. Landing product previews and `frontend/public/og.png` were regenerated from the branded implementation.

## End-to-end and regression verification

- Frontend ESLint: pass.
- Frontend production build: pass.
- Frontend Node tests: 15 passed.
- Playwright release smoke: 5 passed (Activity/Submission, Library document author flow, Schedule/Settings, shared warning/review, Workspace switching/404).
- Backend Gradle tests on Java 21: pass, including permission and last-owner policy tests.
- Final browser matrix: 95 screenshots, zero horizontal-overflow findings, zero page exceptions. Direct `/auth/callback` without a real OAuth code intentionally exercised the shared failure boundary and logged an expected unavailable-backend request in the local capture environment; unknown route requests logged the expected HTTP 404.
- Real GitLab OAuth completion, token reauthorization, Provider outage, and production accounts for every role cannot be completed in an isolated local capture without external credentials/state. Their routing, error mapping, frontend guards, API contracts, and backend policy tests were verified without inventing mock production behavior.

final result: passed

---

# Study-ing Public Landing & Legal Pages — Design QA

## Source and rendered evidence

- Product source of truth: `docs/design-system.md` plus the latest `/today`, `/schedule`, `/library`, `/records`, and Login implementations.
- Source captures: `artifacts/landing-redesign-qa/source/desktop/` and `artifacts/landing-redesign-qa/source/mobile/`.
- Rendered captures: `artifacts/landing-redesign-qa/rendered/desktop/` and `artifacts/landing-redesign-qa/rendered/mobile/`.
- Side-by-side comparisons: `artifacts/landing-redesign-qa/comparison-desktop-landing.png`, `comparison-mobile-landing.png`, `comparison-desktop-legal.png`, and `comparison-mobile-legal.png`.
- Public browser target: `https://sandbox.withroro.com/`.
- Viewports: Desktop `1440 × 1050`; Mobile `390 × 844`.

## Structural result

- Landing now follows Header → Hero → three Core Values → four-step workflow → actual Product Showcase → Data & Trust → neutral Final CTA → Footer.
- Repeated marketing cards, the technology stack strip, abstract code-drawn dashboard, floating decorative cards, giant blobs, gradients, and the oversized purple ending section were removed.
- Hero and showcase use the latest real Today, Schedule, Library, and Records screenshots. Desktop and Mobile image sources are distinct.
- Login and Demo actions reuse the real existing routes. Demo is rendered only in demo mode.
- Terms and Privacy share one semantic legal-document foundation with safe history-aware back navigation and a home fallback.

## Fidelity and quality review

- Typography: Landing hierarchy stays below a display/hero-marketing extreme and matches product weights; Legal content uses a `760px` reading width with semantic H1/H2 structure.
- Spacing/layout: the final Desktop page is `3872px` high versus the source’s `4204px`; Mobile is `4700px` versus `6186px`, reflecting intentional removal of repeated and empty marketing sections.
- Colors/surfaces: neutral canvas and white product surfaces dominate; Purple is limited to brand, active tabs, and primary CTA. No gradient, glass effect, giant decoration, or nested marketing-card grid remains.
- Product assets: eight source-derived WebP screenshots total roughly `245KB`; Hero uses eager loading and below-the-fold showcase images use lazy loading. Width/height are declared to prevent layout shift.
- Copy: Data & Trust accurately distinguishes GitLab learning-source files from App-managed preferences/session data. OAuth token copy matches encrypted server DB storage and HttpOnly browser session cookies.
- Brand: the supplied square Study-ing icon and `Study-ing` wordmark replace the previous SSAFY-shaped asset and `STUDY` label.

## Interaction and accessibility checks

- Header anchors target real sections; sections account for the sticky header.
- Showcase is an accessible tablist with Arrow Left/Right, Home, and End navigation.
- Mobile menu exposes `aria-expanded`, closes after selection, and maintains 40px+ tap targets.
- Product screenshots have descriptive alt text and are not the only source of section meaning.
- CTA and navigation focus indicators reuse the product focus system.
- Legal `returnTo` uses the existing safe internal-route validator; external destinations fall back to `/`.
- Reduced-motion preference disables non-essential transitions.

## Verification

- Visual/browser captures: 12, zero horizontal-overflow failures, zero console errors, zero page errors.
- Mobile and Desktop Hero CTA: both inside the first viewport.
- Browser interaction checks: 6/6 pass.
- ESLint: pass.
- Frontend production build: pass.
- Frontend Node tests: 14/14 pass.
- Backend Gradle tests: pass.
- Sandbox health: pass.

final result: passed

---

# Study-ing Login / OAuth Structural + Visual Redesign — Design QA

## Comparison target

- Source visual truth: `artifacts/auth-flow-captures-20260812/desktop/01-login-default.png`, `artifacts/auth-flow-captures-20260812/mobile/01-login-default.png`, the supplied Login brief, and `docs/design-system.md`
- Rendered implementation: `artifacts/login-redesign-qa/desktop/*.png` and `artifacts/login-redesign-qa/mobile/*.png`
- Side-by-side evidence: `artifacts/login-redesign-qa/comparison-desktop.png` and `artifacts/login-redesign-qa/comparison-mobile.png`
- Desktop viewport: `1440 × 1050`; Mobile viewport: `390 × 844`; `deviceScaleFactor: 1`, `ko-KR`, `Asia/Seoul`, light theme
- Compared states: default, session expired, reconnect required, OAuth cancelled, OAuth failure, and OAuth checking

## Findings and fixes

- P2 resolved — Login was visually detached from the product: the dark marketing hero, giant decorative shapes, grid, glass surface, and deep shadow were replaced with a neutral Study-ing authentication surface using the existing tokens.
- P2 resolved — Mobile prioritized marketing over authentication: the compact single-column flow now places the provider action at 348px in the default state and 429px in error states, inside the first 844px viewport.
- P2 resolved — OAuth cancellation and failure shared ambiguous error copy: `access_denied` now receives a neutral cancellation notice, while real `oauth_failed` uses the shared danger notice.
- P2 resolved — the callback showed decorative rings and a fake animated progress bar. It now exposes the real routing sequence without a fabricated percentage or completion value.
- P2 resolved — provider-specific UI structure was coupled to the single GitLab button. `AuthProviderButton` now receives the provider label, icon, URL, and action copy while the visible provider remains accurately GitLab.
- P2 resolved — already-authenticated users could still see `/login`. The public Login entry now checks the existing session and routes completed profiles to validated `returnTo`, or incomplete profiles to onboarding while preserving the destination.

## Fidelity review

- Typography: Login uses the existing page/body/metadata hierarchy. The Study-ing context headline is supportive; the right-side authentication title and Purple CTA remain the task center.
- Layout: Desktop uses one compact split surface with a subtle tint and border. Mobile removes the split surface, hides the supporting value list, and keeps the authentication action in the first viewport.
- Color/surface: neutral canvas and white/secondary surfaces dominate. Purple is limited to the primary provider action and brand label; status colors are semantic and subtle. No gradient, blob, glassmorphism, or nested card remains in the Login implementation.
- Assets/icons: the supplied Study-ing icon and existing Lucide icons are used. No placeholder, CSS illustration, handcrafted SVG, or generated marketing artwork was introduced.
- Copy: security copy matches the implementation: OAuth credentials are encrypted server-side and the browser uses an HttpOnly session cookie. PAT is a small helper only.

## Interaction and accessibility checks

- Login provider and Demo actions remain keyboard reachable with visible focus; the first two tab stops are Home and Study-ing Home in both viewports.
- Inline notices use one accessible component with `role="alert"`, an icon, title, explanation, and state-specific provider action copy.
- OAuth checking uses `role="status"`, `aria-live="polite"`, and `aria-busy="true"`; the visible sequence is textual and not color-only.
- Production routing QA passed for unauthenticated Login, already-authenticated deep-link return, incomplete Profile return preservation, and callback deep-link restoration.
- Internal return paths accept product deep links and reject absolute, protocol-relative, backslash, and newline injection values.
- Terms and Privacy links preserve the Login route/state and return naturally to Login.
- Automated captures report no horizontal overflow, no console error, and no page error across 12 Desktop/Mobile Login and callback captures.

## Verification

- Frontend ESLint: pass
- Frontend production build: pass
- Frontend Node tests: 13 passed
- Backend Gradle tests: pass
- Routing regression: 4 passed
- Browser visual/overflow/accessibility QA: pass
- Public sandbox health: pass

final result: passed

---

# Study-ing Activity Inbox Semantic / Interaction / Responsive Polish — Design QA

## Comparison target

- Source of truth: `docs/design-system.md` and the existing Activity Drawer IA
- Visual reference: `artifacts/design-system-qa/activity-inbox-v2.png`
- Final evidence: `artifacts/activity-polish-after/desktop-todo.png`, `desktop-news.png`, `mobile-todo.png`, and `mobile-news.png`
- Side-by-side comparison: `artifacts/activity-polish-after/comparison-desktop.png`
- Desktop viewport: `1440 × 1050`; Mobile viewport: `390 × 844`
- Locale/timezone: `ko-KR`, `Asia/Seoul`; device scale: `1×`

## Semantic and interaction findings

- P1 resolved — scope and badge timing: the API returns the signed-in user's latest 50 notifications across Workspaces, while the drawer is a current-Workspace surface. Notifications now load on mount, filter by `workspaceId`, and refresh on Workspace switch, so the closed Sidebar badge no longer waits for the first drawer open.
- P1 resolved — count mismatch: `해야 할 일` counts unresolved required learning items, `새 소식` counts current-Workspace unread notifications, and the Sidebar badge is their sum. The tab labels expose those definitions to assistive technology.
- P1 resolved — accessibility: the bespoke drawer lacked a focus trap, Escape handling, scroll lock, and focus restoration. The shared `Drawer` foundation now provides all four; tabs also support left/right arrow navigation.
- P1 resolved — notification navigation: newly created review notifications lead to the matching Library session and sync failures lead to Settings data/sync. The Library member flow still owns the common pre-submission warning, so Activity cannot bypass it.
- P2 resolved — content hierarchy: the redundant `학습 소식` eyebrow was removed. Todo rows now present title → remaining required item(s) → nearest deadline, while news rows present event → summary → friendly time.
- P2 resolved — read state: unread uses title weight, a small indicator, and an accessible `읽지 않음` label. Read rows keep normal contrast rather than dimming the entire row.
- P2 resolved — responsive behavior: Desktop remains a 400px right Drawer; below the App Shell breakpoint the surface becomes a `100dvh` full-screen Sheet with safe-area-aware list padding and no horizontal overflow.

## Visual comparison review

- The final Drawer stays within the existing neutral surface, divider, radius, icon, and Purple active-state tokens. It introduces no cards, gradient, or competing primary action.
- The Desktop comparison confirms a simpler header, tighter row composition, explicit deadline, and unchanged right-drawer context.
- Mobile captures confirm full-width layout, readable two-line summaries, aligned unread/chevron controls, and no clipped timestamp or metadata.
- No source image assets were required; existing Lucide icons remain type cues with a single neutral treatment.

## Automated QA

- Desktop: panel `400 × 1050`, no page overflow, focus trap pass, Escape close pass, focus restore pass, zero console/page errors.
- Mobile: panel `390 × 844`, no page overflow, focus trap pass, Escape close pass, focus restore pass, zero console/page errors.
- Timestamp output: `오늘 21:35`, `오늘 21:30`; seconds removed.
- Review deep link: `/library/sessions/2026-07-23`; common pre-submission warning visible after member selection on Desktop and Mobile.
- Empty Todo and News copy are distinct in implementation; no fake CTA or mock-only empty route was added.

## Verification result

- ESLint: pass
- TypeScript: pass
- Frontend production build: pass
- Frontend Node tests: 10 pass, 0 fail
- Backend Gradle tests: 74 total, 73 pass, 1 skipped, 0 fail
- Sandbox containers: frontend/backend/gateway healthy

final result: passed

# Study-ing Settings Semantic / Interaction / Visual Polish — Design QA

## Source and implementation evidence

- Source of truth: `docs/design-system.md` and the accepted Settings IA
- Source visual truth: `artifacts/settings-redesign-qa/desktop/*.png`, `artifacts/settings-redesign-qa/mobile/*.png`
- Rendered implementation: `artifacts/settings-polish-qa/desktop/*.png`, `artifacts/settings-polish-qa/mobile/*.png`
- Full-view comparison: `artifacts/settings-polish-qa/comparison-general-desktop.png`, `artifacts/settings-polish-qa/comparison-general-mobile.png`
- Desktop viewport: `1440 × 1050`, `deviceScaleFactor: 1`
- Mobile viewport: `390 × 844`, `deviceScaleFactor: 1`
- Density normalization: source and implementation are browser-rendered 1× captures; comparisons resize both sides to the same `1440 × 900` or `390 × 844` top-aligned canvas.
- States: General unchanged/dirty/saving/success/error, notification saving, repository connected/reauthorize, connected account, member permissions, migration ready/empty/blocked/confirm/saving/success/failure/restricted, profile, appearance, and both deletion dialogs.

## Interaction and semantic verification

- General and Profile Save actions are disabled when unchanged, enabled when dirty, and expose saving plus Toast/inline error feedback.
- Unsaved General changes block Settings links, the Mobile section selector, browser history, page unload, and Workspace switching until confirmed. Immediate-save toggles do not register this guard.
- Workspace and profile timezones use an IANA timezone select; the Backend independently rejects invalid zones with `INVALID_TIMEZONE`.
- `ACTIVE` is presented as the Workspace lifecycle state `활성`, separate from current Workspace selection and Repository connection status.
- Owner/Manager can edit Workspace general settings, notifications, Repository sync, and member sync. Only Owner can change App roles, migrate storage, or soft-delete the Workspace. Member direct access to migration and danger routes resolves to a permission state without calling the privileged API.
- Notification switches wait for the existing PATCH response before updating, lock while saving, show the shared success Toast, and retain the previous state with an inline error on failure.
- Connected Account reauthorization returns to `/settings/accounts` and does not mutate the Workspace Repository connection model.
- Migration covers empty, ready, blocker, final confirmation, execution loading, success, and failure states. Raw paths remain exclusive to this technical workflow.

## Fidelity review and comparison history

- Typography: shared UI typography is unchanged. Save state and permission descriptions use metadata/body-small tokens; headings retain the accepted hierarchy.
- Spacing/layout: the accepted Settings IA and route layout are unchanged. Form actions now share one aligned save-state row, while Mobile stacks feedback and CTA without horizontal overflow.
- Colors/tokens: inactive navigation icons were lowered to the faint neutral token; only active icon/text use Purple. Lifecycle success, warning, error, and disabled states retain semantic tokens and text labels.
- Images/icons: no photographic assets are part of Settings. Existing Lucide icons remain aligned and no custom SVG, emoji, gradient, or placeholder artwork was introduced.
- Copy/content: Workspace lifecycle, Workspace vs personal timezone, Connected Account vs Repository, and Owner/Manager/Member permission copy matches actual domain behavior.
- Accessibility: native labeled select/switch controls, `aria-live` save feedback, associated inline errors, keyboard secondary navigation, Modal focus behavior, and non-color state labels were checked. Automated capture found no horizontal overflow or console/page error.
- Focused comparison: General form/action state and Mobile restricted Migration were opened at full size in addition to the full-view comparison because control affordance and wrapping were too small to judge from the combined Desktop image alone.

Pass 1 found one P2 Mobile issue: the initial direct-route Migration restriction combined a centered state container with a horizontal restricted row, compressing the title and action into narrow columns. The message and action were grouped into one content column. Pass 2 recaptured all states; the restriction now reads as a stable one-column notice and no actionable P0/P1/P2 finding remains.

## Verification result

- Browser QA: 26 Desktop + 26 Mobile captures; zero failures; zero console/page errors
- ESLint: pass
- TypeScript: pass
- Frontend production build: pass
- Frontend Node tests: 10 passed
- Backend Gradle tests: pass

final result: passed

---

# Study-ing Settings Structural Redesign — Design QA

## Comparison target

- Source visual truth: `docs/images/screenshots/settings.png` and `docs/design-system.md`
- Rendered implementation: `artifacts/settings-redesign-qa/desktop/*.png` and `artifacts/settings-redesign-qa/mobile/*.png`
- Full-view side-by-side evidence: `artifacts/settings-redesign-qa/comparison-before-after.png` (source on the left, implementation on the right)
- Source pixels: `1440 × 900`, 1× density
- Desktop implementation CSS viewport: `1440 × 1050`, `deviceScaleFactor: 1`; comparison uses the top `1440 × 900` crop to match the source
- Mobile implementation CSS viewport: `390 × 844`, `deviceScaleFactor: 1`; full-page evidence preserves each content height
- State: authenticated Owner, connected GitLab Repository, three Workspace members, current legacy storage structure, light theme, Purple accent

## Findings and fixes

- P2 resolved — Scope collision: the source placed Repository, members, notifications, security, personal account, and Workspace deletion on one long page. The implementation separates these into URL-addressable Workspace, personal, and advanced Settings scopes while retaining the shared App Shell.
- P2 resolved — Technical-first repository surface: Project ID, internal path, Provider account, and raw status were primary source content. The implementation shows Provider/path/branch/health first and moves technical values into `저장소 세부 정보`.
- P2 resolved — Member role ambiguity: App Role and GitLab permission shared one compact badge hierarchy. The implementation labels `Study-ing 역할` and `GitLab 권한` independently and localizes App Role values.
- P2 resolved — Migration modal density: the multi-step, path-heavy migration task was a centered modal. It now uses `/settings/data/migrate` as a full page with summary, paths, blockers, and one primary execution action.
- P2 resolved — Personal/Workspace danger mixing: account deletion and Workspace deletion now live in separate Settings routes and separate confirmation dialogs with accurate backend impact copy.
- P2 resolved in QA pass 1 — the Mobile migration action bar overlapped the second path in the full-page evidence. Sticky positioning was removed; pass 2 shows both paths and the final action without obstruction.

## Required fidelity surfaces

- Typography: the shared page/section/body/metadata hierarchy is retained. The Settings content title is clearly subordinate to the global page title, and technical metadata uses the tertiary/monospace treatment only where needed.
- Spacing/layout: Desktop uses a 210px local navigation and a readable 820px content column. Mobile replaces it with one 44px section selector and stacks rows without horizontal scrolling. Sections use rows and dividers rather than repeated cards.
- Colors/tokens: Neutral surfaces dominate; Purple is limited to active navigation and the single primary action. Green, Amber, and Red remain semantic status colors. No gradient or new color system was introduced.
- Image quality/assets: Settings contains no photographic assets. Existing Lucide icons and provider iconography remain crisp and consistently sized; no placeholder, emoji, CSS illustration, or handcrafted SVG was added.
- Copy/content: Workspace, Connected Account, Repository Connection, App Role, and GitLab permission are explicitly separated. Unsupported Score toggles, Join/Discovery, Repository disconnect, GitHub, and Managed Storage UI are absent.

## Interaction and accessibility checks

- Desktop Settings navigation, deep links, browser route changes, and Profile-menu → `/settings/profile` work.
- Mobile section selector changes routes without a horizontal tab strip.
- Notification switches expose accessible labels and persist their checked state optimistically.
- Role selects have member-specific accessible names; App Role labels are Korean while GitLab permission remains explicit.
- Repository technical details are hidden by default and disclosed on demand.
- Workspace and account delete dialogs retain focus-trapped Modal behavior, Escape close, explicit cancel, and danger actions.
- Migration loading/success/blocked foundation and retry/action states are present; the actual API contract is reused.
- 36 browser-rendered screenshots produced zero horizontal-overflow failures and zero console/page errors.

## Comparison history

- Pass 1 compared the supplied 1440px Settings source with the normalized Desktop General implementation and inspected all Desktop/Mobile routes individually. It found one P2 Mobile migration overlap.
- The Mobile sticky action was removed and the build was recaptured at the same viewport/state.
- Pass 2 shows full source/target paths, the note surface, and the final action without overlap. No actionable P0/P1/P2 finding remains.
- Focused crops were not required because the route navigation, form labels, member permissions, technical disclosure, migration paths, and dialog copy are legible in the individual full-size Desktop/Mobile captures.

## Verification

- Frontend ESLint: pass
- TypeScript: pass
- Frontend build and 9 Node tests: pass
- Backend Gradle tests in Java 21 container: pass
- Browser interaction/overflow/console QA: pass

final result: passed

---

# Study-ing Workspace / Onboarding Semantic Consistency + Visual Polish — Design QA

## Comparison target

- Source visual truth: `artifacts/workspace-redesign-qa/desktop/*.png`, `artifacts/workspace-redesign-qa/mobile/*.png`, and `docs/design-system.md`
- Rendered implementation: `artifacts/workspace-polish-after/desktop/*.png` and `artifacts/workspace-polish-after/mobile/*.png`
- Side-by-side evidence: `artifacts/workspace-polish-after/comparisons/*.png` (before on the left, polished implementation on the right)
- Desktop CSS viewport/pixels: `1440 × 1050`, `deviceScaleFactor: 1`
- Mobile CSS viewport: `390 × 844`, `deviceScaleFactor: 1`; full-page evidence is content-height PNG (`390 × 908` for the Hub after polish)
- Normalization: same browser, locale, timezone, fixture data, route, interaction state, and 1× pixel density. Side-by-side Hub evidence is `2904 × 1050` including a 24px gutter.
- Compared states: Hub, Switcher, search, selected, permission loading/success/denied, existing/new/conflicted analysis, restore, first Workspace, Profile disabled/active/advanced, and already-connected repository.

## Findings and fixes

- P2 resolved — Permission and analysis semantics: permission success no longer claims that the complete Workspace connection is possible. It now reads `프로젝트 권한을 확인했어요`, while analysis independently resolves to ready, existing-data, or conflict copy.
- P2 resolved — Raw permission exposure: `Maintainer` and `Developer` moved from the primary success/error line into collapsed `권한 세부 정보`; the default UI communicates `쓰기 권한 확인됨`.
- P2 resolved — Role and current-state language: App roles are localized as `소유자`, `관리자`, and `멤버`, while `현재 사용 중` uses the Purple active treatment instead of a green success badge.
- P2 resolved — Analysis nesting: three bordered mini-cards were replaced by one compact metric surface with internal dividers; mobile stacks the same metrics as readable label/value rows.
- P2 resolved — Duplicate prevention: an already-connected Repository skips permission/analysis/create states and exposes only `Workspace로 이동`; the create form and connection CTA are absent.
- P2 resolved — Profile hierarchy: `GitLab 계정 연결 완료` is secondary to the Study-ing title, provider-neutral advanced settings remain collapsed, and the terms CTA keeps recognizable disabled and enabled states.

## Required fidelity surfaces

- Typography: shared product type tokens and hierarchy remain unchanged; provider and technical metadata are intentionally lower weight than task titles.
- Spacing/layout: the existing IA and route flow are preserved. The Hub uses a slightly more readable compact max-width, and analysis density improves without new cards or shadows.
- Colors/tokens: Purple is used for selected/current states, Green only for verified permission/success icons, Amber for permission warnings, and Red for blocking conflict/denied states. No gradient was introduced.
- Image quality/assets: these screens contain no photographic assets. Existing Lucide icons and the provider icon remain sharp and consistent; no placeholder or handcrafted visual asset was added.
- Copy/content: Workspace is consistently retained as the product term; GitLab project terminology is used only where the active provider context is explicit. Raw paths remain inside disclosures.

## Interaction and accessibility checks

- Keyboard-selectable Repository rows retain visible selected state and a check mark; selection is not color-only.
- Permission loading, success, denial, analysis, conflict, disabled CTA, and profile consent states were exercised.
- Conflict never renders `연결할 수 있습니다`, and its primary connection CTA is disabled.
- Raw conflict paths are visible only after opening `문제 상세 보기`.
- Already-connected navigation routes to the existing Workspace `/today` context and cannot reach Workspace creation.
- Profile advanced settings open/close correctly; terms change the submit CTA from disabled to active.
- Automated browser run produced 32 screenshots with zero horizontal-overflow failures and zero console/page errors.

## Comparison history

- Pass 1 identified the six P2 semantic/visual issues above in the pre-polish captures.
- The targeted copy, state, surface, and role-label changes were applied without changing IA, APIs, domain enums, or provider abstractions.
- Pass 2 compared the same Desktop states side by side and opened the corresponding Mobile full-page captures. No actionable P0/P1/P2 finding remains.
- Focused crops were not required because the permission copy, analysis metrics, conflict disclosure, connected-state action, and Profile controls are legible in the same-state full-view comparisons; Mobile captures were additionally inspected individually at full size.

## Final result

final result: passed

---

# Study-ing Workspace Entry & Onboarding — Design QA

## Source and scope

- Source of truth: `docs/design-system.md` and the current `/today`, `/schedule`, `/library`, `/records` product patterns
- Source visual truth: `artifacts/workspace-onboarding-captures/*.png` (the pre-redesign implementation supplied as the actual UI reference)
- Rendered implementation: `artifacts/workspace-redesign-qa/desktop/*.png` and `artifacts/workspace-redesign-qa/mobile/*.png`
- Full-view side-by-side evidence: `artifacts/workspace-redesign-qa/comparisons/*.png` (before on the left, implementation on the right)
- Public browser target: `https://sandbox.withroro.com/workspaces`
- Desktop: `1440 × 1050`; Mobile: `390 × 844`
- Evidence: `artifacts/workspace-redesign-qa/desktop/`, `artifacts/workspace-redesign-qa/mobile/`
- Pixel/density normalization: source and Desktop implementation use a `1440px` canvas at `deviceScaleFactor: 1`; full-page heights are preserved and the shorter side is extended with the neutral canvas for each comparison. Example search is `1440 × 1050` on both sides, selected-data is `1440 × 1093` vs `1440 × 1582`, and Profile is `1440 × 1050` on both sides. Mobile implementation uses a `390px` CSS/pixel canvas at 1×; full-page height varies by content (`1010px` for initial search).

## Domain checks

- The backend enforces a unique GitLab project ID across active and soft-deleted Workspaces. A Repository cannot create a duplicate Workspace.
- Active Workspace membership and GitLab project membership are separate. App roles are Owner / Manager / Member; GitLab access levels are Guest / Reporter / Developer / Maintainer / Owner.
- Workspace creation initializes the OAuth user as Owner. Repository writes require Developer-level GitLab access; project list/connection responses now expose the effective project/group access level so the frontend can stop Reporter-level users before creation.
- Soft-delete restore is Owner-only and expires after seven days.
- No Workspace join/discovery API exists for a GitLab-accessible project whose user is not already an App member. No fake join UI was added.

## Product flow

- `/workspaces`: active Workspace rows, current marker, App role, provider/path metadata, new connection CTA, and Owner-restorable recently deleted rows.
- Switcher: current/recent Workspaces plus `모든 Workspace` and `새 Workspace 연결`; Mobile exposes the Hub from the drawer.
- `/workspaces/new`: Repository selection → permission/branch check → import analysis → connection. Restore is no longer part of this flow.
- Existing Workspace: a repository already present in the user’s Workspace list resolves to `Workspace로 이동`.
- Analysis: empty, compatible, conflict, permission denied, loading, retry, and provider reconnect states are distinct. Conflict paths are only in the disclosure detail.
- First Workspace: the same `WorkspaceConnectionFlow` renders inside a standalone onboarding shell.
- Profile: provider-neutral display-name copy, advanced `학습 기록 이름` and editable timezone, linked terms, and a recognizable disabled CTA before consent.

## Provider boundary and routing

- New UI concepts use `Repository`, `RepositoryConnection`, and `RepositoryProvider`; current user copy accurately says GitLab.
- Unsupported GitHub and Study-ing Managed Storage options are not exposed.
- OAuth gating remains ordered as profile completion → Workspace availability → requested route. An account with zero Workspaces receives the shared first-Workspace flow instead of an empty `/today`.
- Sidebar provider status describes the current Workspace connection only.

## Browser QA

Each Desktop/Mobile folder contains:

1. Workspace Hub
2. Workspace Switcher / Mobile Workspace navigation
3. Repository Search
4. Repository Selected
5. Permission Loading
6. Permission Success
7. Existing Study Data
8. New Repository
9. Conflict
10. Permission Denied
11. Restore
12. First Workspace
13. Profile Onboarding

Automated browser result: 26 screenshots, zero horizontal overflow failures, zero console/page errors. A first visual pass found a legacy fixed-height `.repository-search` collision on Mobile and a too-weak disabled profile CTA; both were corrected before the final capture set.

## Fidelity review and comparison history

- Typography: final screens keep the shared Pretendard/system stack and product title/section/body tokens. The redesign lowers provider metadata below the task title and replaces raw enum/path copy with user-facing Korean labels.
- Spacing/layout: the source’s single centered card mixed search, creation, analysis, and restore. The final comparison intentionally uses a full-page Section → Row → Divider flow and moves restore to the Hub; this is the requested structural difference, not visual drift.
- Color/tokens: neutral surfaces and dividers dominate; Purple is limited to selection and the one available primary action, Green to connection success, Amber to insufficient readiness, and Red to blocking permission/conflict states. No new gradient was introduced.
- Images/icons: these flows have no photographic or brand-image assets. Existing Lucide icons and the GitLab provider mark are used consistently; no placeholder, emoji, or handcrafted SVG substitute was added.
- Copy/content: visibility, permission, analysis, conflict, first Workspace, and Profile strings match the actual behavior. Unsupported Join, GitHub, and Managed Storage choices are absent.
- Focused comparison: no separate crop was needed because form labels, permission text, analysis counts, and Profile controls were readable in the full-view 1440px comparison inputs; individual 390px Mobile captures were additionally opened at full size to check wrapping and controls.

Comparison pass 1 found two P2 issues: the legacy global `.repository-search` height caused the Mobile search button to overlap the first Repository row, and the Profile CTA lost recognizable button affordance while disabled. The fixed height/margin were reset in the scoped connection flow and the disabled CTA received a neutral surface, border, text contrast, and disabled cursor. Pass 2 recaptured all 26 states and the combined comparison set; no actionable P0/P1/P2 finding remains.

## Verification result

- ESLint: pass
- TypeScript: pass
- Frontend production build: pass
- Frontend Node tests: pass
- Backend Gradle tests: pass
- Public sandbox health: pass

final result: passed
