# Provider Identity Model

Status: implemented foundation; GitLab login plus capability-gated GitHub account linking
Updated: 2026-08-13

## Invariants

- `user_accounts.id` is the stable Study-ing user id. It is a UUID string and is not derived from a Provider id.
- `provider_accounts` owns external identity metadata. `(provider, external_user_id)` and `(user_id, provider)` are unique.
- `oauth_credentials.provider_account_id` owns encrypted credentials. A Workspace never owns or borrows a creator credential.
- The browser session stores `StudyIngPrincipal` and the Spring Session index is `study-ing:{userId}`.
- Provider email, username, and display name are never identity-linking proof.
- A future account link requires an authenticated Study-ing session and a separate successful Provider OAuth proof.

## Current login resolution

1. GitLab OAuth returns a verified GitLab identity.
2. The backend finds `provider_accounts(provider=GITLAB, external_user_id=...)`.
3. It loads the linked `user_accounts` row.
4. It rotates only that Provider Account's encrypted credential.
5. It stores a stable Study-ing principal in the session.

A new GitLab identity creates one Study-ing user, one GITLAB Provider Account, and one credential in a transaction. Repeated login resolves the same rows.

## Credential security

AES-GCM encryption, log redaction, HttpOnly session cookies, OAuth state validation, and callback query-log protection are unchanged. V11 rekeys the credential FK without decrypting or writing token plaintext. Account deletion cascades from Study-ing user to every Provider Account and credential.

## Transition fields

| Field | Status | Reason / removal gate |
|---|---|---|
| `user_accounts.gitlab_user_id` | DEPRECATED | Workspace JSON and operational attribution still use GitLab ids. Remove after member/submission attribution migration. |
| `user_accounts.username/avatar_url/web_url` | DEPRECATED as Provider identity | Retained for one-release API compatibility; `provider_accounts` is the external identity source. |
| `oauth_credentials.user_id` | DEPRECATED | Read-only compatibility mirror. New code keys by `provider_account_id`; remove after old diagnostics are retired. |
| `AuthSessionAttributes.GITLAB_USER` | DEPRECATED | Only accepted to upgrade an old session. New sessions write `STUDY_ING_USER`. |
| `StudyMember.gitlabUserId` | STILL REQUIRED | GitLab repository filenames, existing JSON, and member sync use it. New members also carry stable `userId`. |

## Non-goals in the current GitHub account-linking phase

- GitHub login or signup
- GitHub repository, Workspace, Discovery, Submission, Review, or Sync support
- Provider disconnect UI
- Multiple accounts for the same Provider
- Automatic identity merge
