# GitHub Frontend Integration Plan

- Status: Multi-provider foundation complete; GitHub Connected Account linking implemented and capability-gated
- Based on: `docs/github/frontend-readiness-audit.md`
- Current visible providers: GitLab globally; GitHub only in Connected Accounts when linking capability is enabled
- Goal: add GitHub without changing the established Study-ing IA or regressing GitLab

## Guardrails

1. Authentication Provider and Workspace Repository Provider remain independent.
2. A Study-ing Account has a stable Study-ing user id; Provider identities are linked accounts.
3. A Workspace selects a RepositoryConnection, not the provider used for the current login.
4. Frontend permission is display guidance only. Backend revalidates every protected action.
5. Provider UI is rendered only when backend capability enables it.
6. GitHub is exposed only in Settings > 연결된 계정 when `accountLinkProviders` enables it.
7. Existing GitLab routes and behavior remain compatible until the normalized contract is deployed and migrated.
8. No new state-management or UI framework is introduced.

## 2026-08-13 Progress

- Completed: stable session identity, ProviderAccount and credential ownership, Provider Account list API,
  normalized RepositoryConnection persistence/DTO, repository summary adapter, descriptor/icon foundation,
  capability API, Connected Accounts list rendering, provider-aware StorageDetails copy.
- Compatibility retained: GitLab OAuth routes, raw GitLab project analysis/write endpoints, legacy Workspace and
  member fields, GitLab-only reconnect hook.
- Completed GitHub Account Linking Phase 1: authenticated-only OAuth App flow, state + PKCE, collision rejection,
  credential reauthorization, capability-gated Settings Row, account-deletion cascade and legal inventory.
- Still disabled: GitHub login and every GitHub repository/Workspace capability.
- Recommended next: implement the GitHub Repository Adapter after deciding OAuth App `repo` scope versus a
  fine-grained GitHub App. GitHub Login adds little product value before a GitHub account can power a Workspace.

## Target Invariants

The integration is complete only when all of these hold.

- A GitLab-authenticated user can connect a GitHub account and use a GitHub Workspace.
- A GitHub-authenticated user can connect a GitLab account and use a GitLab Workspace.
- Switching Workspace changes repository provider status without changing the Study-ing login session.
- Reauthorizing one Provider Account does not modify any Workspace RepositoryConnection.
- GitLab and GitHub repositories with equal external id strings never collide.
- GitLab/GitHub raw permission models never reach common UI decision logic.
- One Provider outage does not mark the other Provider unavailable.
- GitHub UI is absent while the capability is off.

## Scope Estimate

The estimate is a change-surface estimate, not a commitment to exact line counts.

| Phase | Frontend surface | Backend dependency | Relative risk |
|---|---|---|---|
| 1. Provider-neutral refactor | about 12–18 existing frontend files, 6–10 small shared files, 3+ tests | none; legacy GitLab adapter retained | medium |
| 2. Contract integration | auth/workspace/repository API types and contexts | high: account, credential, Workspace DTO, capabilities | high |
| 3. GitHub authentication | Login, callback, Profile, Connected Accounts | high: GitHub OAuth and safe account linking | high |
| 4. Repository + Workspace | Connect, selector, status, Settings, StorageDetails | high: GitHub repositories/permissions/read-write/analyze | high |
| 5. Discovery / Join | Hub, Discovery, Connect existing-state integration | high: multi-provider discovery/revalidation | high |
| 6. Regression / release | public copy, legal review, fixtures, cross-provider E2E | capability on and production provider configuration | medium |

The P0 effort is primarily backend/domain migration. The visible frontend IA should remain stable.

## Phase 1 — Provider-neutral Frontend Refactor

### Objective

Move current GitLab presentation and DTO adaptation behind provider-neutral boundaries without changing visible behavior. Only `GITLAB` is registered and enabled.

### Frontend files

New or extracted:

- `frontend/lib/providers/types.ts`
- `frontend/lib/providers/descriptors.ts`
- `frontend/lib/providers/display.ts`
- `frontend/lib/api/types/repository.ts`
- `frontend/components/providers/ProviderIcon.tsx`
- `frontend/components/providers/ProviderReconnectNotice.tsx`
- `frontend/components/repositories/RepositoryIdentity.tsx`
- `frontend/components/repositories/RepositoryStorageDetails.tsx`
- `frontend/components/settings/ProviderAccountRow.tsx`

Primary existing files:

- `frontend/lib/domain/repository.ts`
- `frontend/lib/api/types/gitlab.ts`
- `frontend/lib/api/services/gitlabApi.ts`
- `frontend/lib/api/hooks/useGitLabConnection.tsx`
- `frontend/components/shell/RootShell.tsx`
- `frontend/components/shell/AppShell.tsx`
- `frontend/components/shell/WorkspaceSwitcher.tsx`
- `frontend/components/marketing/LoginPage.tsx`
- `frontend/components/auth/OAuthCallbackPage.tsx`
- `frontend/components/ui/AppLoadingScreen.tsx`
- `frontend/components/auth/ProfileSetupPage.tsx`
- `frontend/components/onboarding/WorkspaceOnboarding.tsx`
- `frontend/components/workspaces/WorkspaceHub.tsx`
- `frontend/components/workspaces/DiscoverableWorkspaceSection.tsx`
- `frontend/components/settings/SettingsWorkspace.tsx`
- `frontend/components/today/SubmissionDialog.tsx`
- `frontend/components/today/MemberDetailDialog.tsx`
- `frontend/components/schedule/ScheduleDetailPage.tsx`
- `frontend/components/library/LibrarySessionPage.tsx`
- `frontend/lib/api/errors.ts`
- `frontend/lib/auth/loginState.ts`

### Work

1. Add a descriptor registry containing GITLAB only.
2. Move provider icon/name/auth/reconnect/repository labels out of page components.
3. Normalize GitLab project responses into a repository view model at the API adapter boundary.
4. Treat repository external id as an opaque string inside generic UI. Convert to the legacy numeric API argument only in `gitlabApi.ts` compatibility code.
5. Replace common UI raw `accessLevel >= 30` checks with adapter-produced `canWrite`. Retain backend action validation.
6. Add a provider-neutral `useRepositoryConnection` façade. It may dispatch to the current GitLab hook internally during this phase.
7. Make AppShell, Settings Repository, Library origin links and StorageDetails consume the façade.
8. Make Hub, Switcher, Discovery and Profile onboarding use descriptor-rendered metadata.
9. Parameterize error/reconnect presentation by provider while retaining existing GitLab error codes.
10. Remove no-longer-used GitLab-specific CSS selectors only after usage verification.

### Backend dependency

None. Existing GitLab endpoints and DTOs remain in use through an adapter. Do not rename backend fields or expose GitHub.

### Risks

- A generic type name can hide a still-GitLab-specific value. Keep compatibility types explicitly marked.
- Changing numeric repository IDs too early can alter API URLs. Convert only at the adapter edge.
- Replacing the connection provider can regress join-time Workspace state refresh. Keep it keyed by Workspace id/repository identity.

### Acceptance criteria

- Current UI text and all GitLab actions are unchanged.
- No GitHub button, row, icon or copy is rendered.
- AppShell/Settings/Library do not import `useGitLabConnection` directly.
- Common UI does not compare raw GitLab access-level numbers.
- StorageDetails titles and origin labels come from current provider context.
- Existing frontend lint/build/tests/E2E pass.
- New parametric component tests pass for a non-enabled synthetic descriptor without rendering it in production.

## Phase 2 — Backend Contract Integration

### Objective

Introduce the stable account, Provider Account, capability and Workspace RepositoryConnection contracts required for more than one Provider. Integrate them in frontend while GitHub capability remains off.

### Required backend contracts

1. Stable Study-ing account id independent of external provider user id.
2. `ProviderAccount[]` with provider, external account id, username, display metadata and status.
3. Multiple encrypted OAuth credentials keyed by Provider Account, not by User alone.
4. Workspace `RepositoryConnection` with provider + opaque external repository id + full name.
5. Workspace/member/review author DTOs using Study-ing user ids.
6. Provider-neutral repository capability and connection status.
7. Public/authenticated supported-provider capabilities.
8. Server-side selection of the correct Provider Account credential for a Workspace action.

### Frontend files

- `frontend/lib/api/services/authApi.ts`
- `frontend/lib/api/services/workspaceApi.ts`
- new `frontend/lib/api/services/providerAccountsApi.ts`
- new `frontend/lib/api/services/repositoriesApi.ts`
- `frontend/lib/domain/types.ts`
- `frontend/lib/domain/repository.ts`
- `frontend/components/providers/AuthProvider.tsx`
- `frontend/components/providers/WorkspaceProvider.tsx`
- `frontend/components/settings/SettingsWorkspace.tsx`
- `frontend/components/review/SubmissionReviewPanel.tsx`
- `frontend/components/today/MemberDetailDialog.tsx`

### Work

1. Replace `AuthenticatedGitLabUser` with a `CurrentAccount` response containing Study-ing id/profile and provider accounts.
2. Keep `authenticatedVia` as optional display/audit metadata; never use it as Workspace provider.
3. Match current Workspace member by Study-ing `userId`, not `gitlabUserId`.
4. Read repository metadata from `workspace.repositoryConnection`.
5. Replace `authorGitLabUserId` with `authorUserId` for “나” rendering.
6. Load Connected Accounts from its own endpoint, independent of current Workspace.
7. Load supported providers and intersect them with the local descriptor registry.
8. Preserve legacy fields for a staged rollout only if backend returns both shapes. Log/monitor legacy fallback use and remove it after migration.

### Backend dependency

Blocking. Phase 2 cannot be faked by renaming frontend fields. The backend data migration must preserve existing GitLab users, memberships, workspaces, submissions and reviews.

### Compatibility rollout

Recommended order:

1. Add normalized fields/tables and migrate existing GitLab data.
2. Backend returns normalized DTO plus temporary legacy fields.
3. Frontend switches to normalized DTO and reports incompatible responses clearly.
4. Verify no legacy fallback in production.
5. Remove legacy frontend types, then remove legacy backend fields in a later release.

Do not deploy a frontend that requires normalized fields before the compatible backend is live.

### Risks

- Existing GitLab user ids may be mistaken for Study-ing account ids.
- Membership/history attribution can split during migration.
- Credential lookup can use the login Provider instead of Workspace Provider.
- composite repository uniqueness can be migrated incorrectly.

### Acceptance criteria

- Existing GitLab account retains the same profile, memberships, roles, submissions and reviews.
- `/auth/me` exposes a stable Study-ing account and GitLab Provider Account separately.
- Connected Accounts status does not change when switching Workspace.
- Workspace DTO has provider-aware RepositoryConnection.
- Current user/member/review attribution uses Study-ing ids.
- capability response returns GitLab only; GitHub remains absent from UI.
- backend migration, authorization and account-deletion tests pass.

## Phase 3 — GitHub Authentication

Status: account-linking subphase complete; GitHub login/signup remains pending.

### Objective

First support GitHub as an explicitly linked account without enabling GitHub repositories. Initial GitHub login/signup is a separate remaining subphase and must not be inferred from account-link capability.

### Frontend files

- `frontend/components/marketing/LoginPage.tsx`
- `frontend/components/auth/AuthProviderButton.tsx`
- `frontend/components/auth/OAuthCallbackPage.tsx`
- `frontend/components/ui/AppLoadingScreen.tsx`
- `frontend/components/auth/ProfileSetupPage.tsx`
- `frontend/components/providers/AuthProvider.tsx`
- `frontend/components/settings/SettingsWorkspace.tsx`
- `frontend/components/settings/ProviderAccountRow.tsx`
- `frontend/lib/api/services/authApi.ts`
- `frontend/lib/api/services/providerAccountsApi.ts`
- `frontend/lib/auth/loginState.ts`
- `frontend/lib/api/errors.ts`

### Completed account-linking foundation

- Authenticated-only GitHub OAuth App start/callback with session-bound `LINK` intent, expiring state, and PKCE S256.
- Safe existing-account linking, cross-account collision rejection, encrypted credential rotation, and account-delete cascade.
- Provider Account list/status/link/reauthorize foundation.
- `accountLinkProviders` enables GitHub independently of both `authProviders` and `repositoryProviders`.
- Settings renders GitHub only when account-link capability is enabled.

### Remaining backend dependency for GitHub login

- A distinct GitHub login start/callback flow and `LOGIN` pending intent.
- New-user onboarding and existing ProviderAccount login resolution through GitHub.
- `authProviders` capability enabling GitHub independently of repository support.
- Login cancellation/failure/returnTo regression coverage.

### Work

1. **Completed:** add the GITHUB descriptor/icon and capability-gated Connected Account row/link/reauthorize action.
2. **Pending:** render one AuthProviderButton per enabled login provider.
3. **Pending:** make login callback/loading/notice copy provider-aware.
4. **Pending:** reuse Profile onboarding for either initial login provider.
5. **Pending:** preserve safe `returnTo` and already-authenticated behavior for GitHub login.
6. Keep GitHub repository capability off until repository support is complete.

### Risks

- Account takeover through unsafe linking.
- An already-authenticated link callback being treated as a new login.
- Duplicate Study-ing accounts for the same person.
- Provider error query parameters being trusted without a server-side pending flow.

### Acceptance criteria

- **Complete:** linking GitHub to a GitLab-created Study-ing account does not create a second account.
- **Complete:** reauthorization only replaces the selected Provider Account credential.
- **Complete:** account-link cancellation/failure preserves the Study-ing session and current Workspace repository.
- **Complete:** capability off exposes no GitHub UI; capability on exposes GitHub only in Connected Accounts.
- **Pending login subphase:** GitHub button appears only when `authProviders` enables it.
- **Pending login subphase:** GitLab and GitHub initial login both reach the same Profile/Workspace routing.
- **Pending login subphase:** auth security, returnTo and session regression tests pass for GitHub login.

## Phase 4 — GitHub Repository and Workspace

### Objective

Allow a connected GitHub account to search/select/analyze/connect repositories and use GitHub-backed Workspaces through the existing app IA.

### Frontend files

- `frontend/components/onboarding/WorkspaceOnboarding.tsx`
- new `frontend/components/repositories/RepositoryAccountSelector.tsx`
- new `frontend/components/repositories/RepositorySelector.tsx`
- `frontend/components/workspaces/WorkspaceHub.tsx`
- `frontend/components/shell/WorkspaceSwitcher.tsx`
- `frontend/components/shell/AppShell.tsx`
- `frontend/components/settings/SettingsWorkspace.tsx`
- `frontend/components/settings/RepositoryMigrationPage.tsx`
- `frontend/components/today/SubmissionDialog.tsx`
- `frontend/components/today/MemberDetailDialog.tsx`
- `frontend/components/schedule/ScheduleDetailPage.tsx`
- `frontend/components/schedule/SessionEditorDialog.tsx`
- `frontend/components/library/LibrarySessionPage.tsx`
- `frontend/components/review/SubmissionReviewPanel.tsx`
- `frontend/lib/api/services/repositoriesApi.ts`
- `frontend/lib/api/services/workspaceApi.ts`
- `frontend/lib/api/hooks/useRepositoryConnection.tsx`

### Backend dependency

- GitHub repository list/search with pagination.
- normalized visibility and capability response.
- connection check and import analysis.
- Workspace create using provider, providerAccountId and externalRepositoryId.
- GitHub read/write/sync/session/submission/review adapter.
- provider-aware external resource URLs.
- `(provider, externalRepositoryId)` uniqueness.
- capability flags per repository feature, including migration/member sync if not initially supported.

### Work

1. Add “저장소 계정” selection before Repository search when more than one eligible account exists.
2. Keep the established Select → Permission → Analysis → Connect flow.
3. Render the same Repository row for GitLab and GitHub normalized results.
4. Remove provider raw roles from primary UI; advanced details may show provider-specific display permission.
5. Use Workspace RepositoryConnection for Hub, Switcher, Sidebar, Settings and StorageDetails.
6. Make errors/reconnect/status provider-aware.
7. Use backend-provided externalUrl for origin links.
8. Hide provider-unsupported management actions rather than showing fake or permanently disabled controls.
9. Verify GitLab and GitHub Workspaces can coexist and switch without stale provider state.

### Risks

- GitHub repository ids represented as JS numbers.
- stale GitLab connection state shown after switching to GitHub.
- wrong Provider Account selected for organizations/repositories.
- GitLab-specific repository schema operations being assumed available on GitHub.
- provider URL format leaking back into page components.

### Acceptance criteria

- Repository search is account-scoped and provider-labelled.
- Permission UI consumes normalized capabilities; server still revalidates connect/write.
- GitLab repository connect behavior is unchanged.
- GitHub repository can complete select/check/analyze/connect.
- Sidebar, Settings, Hub, Switcher and StorageDetails all show the current Workspace provider.
- Login Provider and current Workspace Provider can differ in every combination.
- Today/Schedule/Library/Records/Activity render GitHub Workspace data with no GitLab status leakage.
- desktop/mobile/keyboard/overflow regression passes.

## Phase 5 — GitHub Discovery and Join

### Objective

Extend the existing explicit Discovery → Join flow to repositories accessible through connected GitHub accounts.

### Frontend files

- `frontend/components/workspaces/DiscoverableWorkspaceSection.tsx`
- `frontend/components/workspaces/WorkspaceHub.tsx`
- `frontend/components/onboarding/WorkspaceOnboarding.tsx`
- `frontend/components/providers/WorkspaceProvider.tsx`
- `frontend/lib/api/services/workspaceApi.ts`
- `frontend/lib/api/errors.ts`

### Backend dependency

- provider-aware Discovery over all eligible connected accounts.
- provider/account-specific status with partial success.
- GitHub membership/collaborator eligibility adapter.
- Join-time permission revalidation.
- provider-aware repository access revocation and outage distinction.
- idempotent membership uniqueness using Study-ing user id.

### Work

1. Render provider descriptor from each discovery item.
2. Show results from healthy providers even if another provider is unavailable.
3. Attach reconnect action to the exact Provider Account in error status.
4. Match already-connected repositories by provider + externalRepositoryId.
5. Keep join request workspace-centric and do not send role/permission.
6. Activate joined Workspace through the existing WorkspaceContext path and invalidate only workspace-scoped status/state.
7. Keep soft-deleted Workspace exclusion and MEMBER default role.

### Risks

- Repository id collision across providers.
- one provider outage clearing all discoverable items.
- stale discovery result accepted without server revalidation.
- join success followed by status check against the login provider.

### Acceptance criteria

- GitHub collaborator with eligible permission discovers and explicitly joins.
- GitHub and GitLab discovery results coexist with correct labels.
- one Provider outage is section-level and preserves healthy Provider results.
- stale/revoked permission is rejected by server at join.
- duplicate join creates no duplicate membership.
- joined Workspace immediately appears in Switcher and opens `/today` with correct provider status.
- `/workspaces/new` shows move/join/connect states correctly for both providers.

## Phase 6 — Regression, Legal, Landing, and Rollout

### Objective

Complete cross-provider regression and update public/legal facts only after GitHub is actually enabled.

### Frontend/doc files

- `frontend/components/marketing/LandingPage.tsx`
- `frontend/app/page.tsx`
- `frontend/app/terms/page.tsx` or approved legal content source
- `frontend/app/privacy/page.tsx` or approved legal content source
- `docs/legal/*`
- `frontend/tests/*.test.mjs`
- `frontend/e2e/*`
- relevant `scripts/capture-*.mjs`
- product screenshots/metadata where provider copy appears

### Backend / operational dependency

- GitHub capability enabled in the target environment.
- production GitHub OAuth app and redirect URLs.
- confirmed GitHub data flow, credential storage, processing region and deletion boundary.
- approved Terms/Privacy versions and consent/reconsent decision.

### Work

1. Change Landing primary entry to “Study-ing 시작하기” and let Login present enabled Providers.
2. Update Data & Trust and How It Works to “연결한 저장소” while accurately naming supported GitLab/GitHub services where needed.
3. Update Terms/Privacy draft and approved production content for GitHub OAuth, repository data, external service, deletion boundary and overseas-processing review.
4. Add current-version screenshot fixtures for GitLab/GitHub matrices.
5. Run full desktop/mobile accessibility and route regression.
6. Enable GitHub capability only after all release gates pass.

### Risks

- Public copy claiming GitHub before capability is available.
- legal policy version not matching onboarding consent version.
- outdated screenshots showing GitLab-only UI.
- enabling auth before repository or Discovery readiness.

### Acceptance criteria

- Landing/Login responsibilities remain distinct.
- Public UI only claims capabilities enabled in production.
- approved legal content names GitHub accurately and has a new version/effective date.
- GitHub and GitLab E2E matrices pass at 1440×900, 768×1024 and 390×844.
- no horizontal overflow, console error or accessibility regression.
- feature rollback is possible by disabling capability without redeploying frontend.

## Cross-phase Test Matrix

| Scenario | Phase gate |
|---|---|
| Existing GitLab login/workspace, capability off | every phase |
| GitLab login → GitHub account link | Phase 3 |
| GitHub login → GitLab account link | Phase 3 |
| GitLab login → GitHub Workspace | Phase 4 |
| GitHub login → GitLab Workspace | Phase 4 |
| same-looking repository id across providers | Phase 4 |
| Workspace switch GitLab ↔ GitHub | Phase 4 |
| GitHub access revoked vs GitHub outage | Phase 4 |
| GitHub discovery/join, stale permission | Phase 5 |
| GitLab outage with GitHub discovery available | Phase 5 |
| account delete revokes all linked provider credentials | Phase 6 |
| capability off hides GitHub everywhere | every phase |

## Release Gates

### Gate A — safe refactor

- Phase 1 acceptance complete.
- GitLab-only production behavior unchanged.

### Gate B — identity and contract

- Stable Study-ing account migration complete.
- Provider Account credential lookup and Workspace connection routing security-reviewed.
- Capability endpoint deployed with GitHub off.

### Gate C — authentication

- GitHub login/link/reauthorize/collision tests pass.
- Repository capability remains off.

### Gate D — repository

- Cross-login-provider/cross-workspace-provider matrix passes.
- No GitLab data/state leakage after Workspace switch.

### Gate E — discovery

- partial outage, revoked membership and idempotent join tests pass.

### Gate F — public release

- legal/public copy approved and versioned.
- production OAuth/infra configuration verified.
- GitHub capability enabled.

## Work Explicitly Deferred

- Multiple accounts of the same Provider in end-user UI. The data/UI keys should not prevent it, but it is not required for the first GitHub release.
- Study-ing Managed Storage eligibility/invite strategy.
- Invite tokens, email invites, auto-join.
- New Settings IA or Workspace Connect redesign.
- Provider brand-colored primary buttons.
- Frontend-generated GitHub mock behavior before backend integration.

## Definition of Done

GitHub frontend integration is done when a Provider can be added through descriptor + normalized contracts, the UI never infers Workspace Provider from login Provider, all protected actions use the correct server-selected credential, and disabling the GitHub capability removes every GitHub action without breaking GitLab.
