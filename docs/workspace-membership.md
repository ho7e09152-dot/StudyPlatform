# Workspace Membership policy

## Membership boundaries

- Repository membership is external Provider access; Study-ing Workspace membership is an application membership.
- Discovery never auto-enrols a Repository member. A user explicitly joins and the server assigns `MEMBER`.
- Repository permission never promotes a user to Study-ing `MANAGER` or `OWNER`.

## Current GitLab permission policy

Study-ing currently treats a Workspace member as an active study participant who can submit learning work to the connected repository.

| Capability | Minimum GitLab permission | Study-ing role requirement |
|---|---:|---|
| Discover and join a Workspace | Developer (30) | Join always creates `MEMBER` |
| Read an already joined private Workspace | Any currently verified project access | Active Workspace membership |
| Submit or edit repository-backed learning data | Developer (30), enforced by the live GitLab write | Existing App action policy |
| Manage schedules and Workspace settings | Repository write access plus the action's live write where applicable | `OWNER` or `MANAGER` |
| Delete a Workspace | Repository access | `OWNER` |

Developer is the Join minimum because the current product models every newly joined Workspace member as a submitting participant. A future explicit Viewer/read-only Study-ing role may allow GitLab Reporter access; that is a follow-up and is not emulated by the current UI.

## Existing-member access revalidation

- Login/bootstrap: accessible GitLab projects are fetched once and bulk-matched by external project ID before Workspace content is returned.
- Workspace switch and scoped API access: membership is checked through a five-minute server TTL. It is not checked on every page request.
- Provider connection status: the selected Workspace is checked immediately on switch; confirmed `403`/project absence blocks its content in the client.
- Repository writes: Schedule, Submission, Review, Sync, and Migration still execute against GitLab and therefore verify current write permission at the time of the action.

Confirmed `403` or project absence becomes `REPOSITORY_ACCESS_REVOKED`. GitLab timeout, rate limiting, and 5xx errors become `REPOSITORY_PROVIDER_UNAVAILABLE` and do not mutate or remove Study-ing membership. Repository access recovery therefore preserves the user's Study-ing role, submissions, and review history.

When verification is required but GitLab is unavailable, the server fails that verification with `503` instead of returning private Workspace content from an unverified bootstrap. This state is temporary and is never persisted as a membership revocation.
