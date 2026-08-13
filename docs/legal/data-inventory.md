# External Provider Data Inventory

Status: draft operational inventory
Updated: 2026-08-13

This file records implementation facts for connected external accounts. Legal classification remains subject to the existing review items in `implementation-facts.md`.

| Provider | Feature status | Data received and stored | Credential | Purpose | Deletion |
|---|---|---|---|---|---|
| GitLab | Login and repository operations | external user ID, username, display name, avatar URL, profile URL; project/repository data described in the main inventory | access/refresh token, expiry and scope encrypted with existing AES-GCM policy | authentication and current GitLab-backed Workspace functions | logout/account deletion behavior follows the current GitLab policy; account deletion removes the ProviderAccount and credential |
| GitHub | Connected Account linking only | GitHub user ID, login/username, optional display name, avatar URL and profile URL | OAuth App access token, optional refresh/expiry metadata and granted scope encrypted with existing AES-GCM policy | explicitly link and reauthorize a GitHub identity | Study-ing account deletion removes the GitHub ProviderAccount and credential; standalone disconnect is not yet provided |

GitHub email is not requested or stored. GitHub Repository metadata, files, permissions, commits, reviews and Workspace data are not processed by this phase.

GitHub is an external service for account linking. Whether the relationship is a third-party provision, processing delegation, or another legal category and whether overseas transfer provisions apply remain `LEGAL REVIEW REQUIRED` until production infrastructure and operator arrangements are confirmed.
