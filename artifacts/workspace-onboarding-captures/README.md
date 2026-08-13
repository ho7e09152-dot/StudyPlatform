# Workspace onboarding capture set

Captured on 2026-08-12 from the current STUDY Platform implementation.

The sandbox frontend is compiled in demo mode, so GitLab project, repository-analysis, deleted-workspace, and permission responses were controlled at the network boundary to render the existing UI states without changing product code or connecting another user's account. The no-Workspace and first-profile screens were rendered from a production-mode build with the existing `AuthProvider` and `WorkspaceProvider` behavior.

## Captures

1. `01-project-search-and-accessible-list.png` — `/workspaces/new`, project search, accessible projects, restore UI
2. `02-project-search-result.png` — filtered GitLab project search result
3. `03-repository-analysis-in-progress.png` — selected project, Workspace name, default branch, permission/repository check in progress
4. `04-selected-project-analysis-complete.png` — completed analysis, existing schedules/submissions/other files, connect button
5. `05-repository-conflict.png` — repository path/compatibility conflict and disabled connect action
6. `06-permission-denied.png` — inline GitLab permission error
7. `07-no-workspace-user.png` — authenticated user with zero Workspaces
8. `08-first-profile-setup.png` — first profile setup after GitLab OAuth

## Not present

- Standalone `/workspaces` index: not implemented; the route returns HTTP 404.
- Explicit GitLab access-level label in onboarding: not implemented. The list shows project visibility and the selected state shows connection readiness/default branch only.
- Separate connection-failure page: not implemented. Failures use the inline alert captured in `06-permission-denied.png`.

## Present but conditional

- Deleted Workspace restore UI exists and appears in `/workspaces/new` or the zero-Workspace onboarding when the deleted-workspace API returns restorable items.
- Repository issues are limited to four visible items by the current component.

Automated capture result: `capture-results.json`.
