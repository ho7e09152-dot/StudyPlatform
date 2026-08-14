# External Provider Data Inventory

Status: draft operational inventory
Updated: 2026-08-13

This file records implementation facts for connected external accounts. Legal classification remains subject to the existing review items in `implementation-facts.md`.

| Provider | Feature status | Data received and stored | Credential | Purpose | Deletion |
|---|---|---|---|---|---|
| GitLab | Login and repository operations | external user ID, username, display name, avatar URL, profile URL; project/repository data described in the main inventory | access/refresh token, expiry and scope encrypted with existing AES-GCM policy | authentication and current GitLab-backed Workspace functions | logout/account deletion behavior follows the current GitLab policy; account deletion removes the ProviderAccount and credential |
| GitHub | Connected Account linking; repository operations when capability is enabled | GitHub user ID, login/username, optional display name, avatar/profile URL; installed repository ID/name/visibility/branch/permission; files, commits and commit comments needed for Workspace actions | GitHub App user access token, optional refresh/expiry metadata encrypted with existing AES-GCM policy; App private key is a mounted server secret, not user data | explicitly link/reauthorize identity and perform user-requested Workspace repository operations | account deletion removes the GitHub ProviderAccount and credential; Workspace deletion removes Study-ing connection data but not GitHub repository history; standalone disconnect is not yet provided |

GitHub email is not requested or stored. Repository content remains in GitHub; Study-ing reads it and may store derived Workspace state in its database in the same manner as the GitLab adapter.

GitHub is an external service for account linking and capability-gated repository storage. Whether the relationship is a third-party provision, processing delegation, or another legal category and whether overseas transfer provisions apply remain `LEGAL REVIEW REQUIRED` until production infrastructure and operator arrangements are confirmed.
