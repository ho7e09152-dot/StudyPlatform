# Multi-provider Migration Plan

Status: V11 implemented and verified on H2 PostgreSQL mode; production backup/restore rehearsal required
Updated: 2026-08-13

## Pre-migration checks

- Count `user_accounts`, `workspace_metadata`, and `oauth_credentials`.
- Confirm every credential `user_id` resolves to one user.
- Confirm every non-null `gitlab_user_id` and `gitlab_project_id` is unique.
- Take an encrypted database backup and verify restore credentials.
- Stop concurrent application writes during the V11 deployment window.

## V11 stages

1. Add `provider_accounts` and its external identity constraints.
2. Backfill one GITLAB account per existing user, preserving user UUIDs.
3. Repoint credential ownership to Provider Account without decrypting ciphertext.
4. Keep a deprecated user-id mirror for one compatibility release.
5. Add `repository_connections` and backfill every Workspace as GITLAB.
6. Relax legacy GitLab columns for future non-GitLab rows; do not drop them yet.
7. Deploy code that reads normalized fields first and compatibility fields second.

## Post-migration verification

The following counts must match pre-migration values:

- users
- Workspaces
- credentials
- active memberships

Additionally verify:

- exactly one GITLAB Provider Account per legacy GitLab user
- no orphan Provider Account or credential
- one Repository Connection per existing Workspace
- credential decrypt/refresh succeeds for a sampled account
- Login resolves the existing Study-ing UUID rather than creating a duplicate
- Workspace Discovery, Join, repository write, and account deletion regression tests pass

## Rollback

Before accepting new multi-provider writes, restore the pre-migration backup or run a reviewed reverse migration that restores credential `user_id` from Provider Account ownership. Never drop Provider Accounts after new providers are linked. From that point the safe recovery path is roll-forward.
