CREATE TABLE provider_accounts (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    provider VARCHAR(32) NOT NULL,
    external_user_id VARCHAR(255) NOT NULL,
    username VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    avatar_url VARCHAR(2048),
    web_url VARCHAR(2048),
    status VARCHAR(32) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT fk_provider_accounts_user FOREIGN KEY (user_id) REFERENCES user_accounts(id) ON DELETE CASCADE,
    CONSTRAINT uk_provider_external_user UNIQUE (provider, external_user_id),
    CONSTRAINT uk_provider_user UNIQUE (user_id, provider)
);

CREATE INDEX idx_provider_accounts_user ON provider_accounts(user_id, status);

-- Existing ids are reused deliberately: credential ciphertext never moves through application memory.
INSERT INTO provider_accounts (
    id, user_id, provider, external_user_id, username, display_name,
    avatar_url, web_url, status, created_at, updated_at
)
SELECT
    id, id, 'GITLAB', CAST(gitlab_user_id AS VARCHAR(255)), username, display_name,
    avatar_url, web_url, 'CONNECTED', created_at, updated_at
FROM user_accounts;

ALTER TABLE oauth_credentials DROP CONSTRAINT fk_oauth_credentials_user;
ALTER TABLE oauth_credentials RENAME COLUMN user_id TO provider_account_id;
ALTER TABLE oauth_credentials ADD CONSTRAINT fk_oauth_credentials_provider_account
    FOREIGN KEY (provider_account_id) REFERENCES provider_accounts(id) ON DELETE CASCADE;
-- Transitional mirror for read-only legacy diagnostics. New code resolves credentials by provider_account_id.
ALTER TABLE oauth_credentials ADD COLUMN user_id VARCHAR(36);
UPDATE oauth_credentials SET user_id = provider_account_id;
ALTER TABLE oauth_credentials ADD CONSTRAINT fk_oauth_credentials_legacy_user
    FOREIGN KEY (user_id) REFERENCES user_accounts(id) ON DELETE CASCADE;

CREATE TABLE repository_connections (
    workspace_id VARCHAR(64) PRIMARY KEY,
    provider VARCHAR(32) NOT NULL,
    external_repository_id VARCHAR(255) NOT NULL,
    full_name VARCHAR(1024) NOT NULL,
    web_url VARCHAR(2048),
    visibility VARCHAR(32),
    default_branch VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT fk_repository_connections_workspace FOREIGN KEY (workspace_id) REFERENCES workspace_metadata(id) ON DELETE CASCADE,
    CONSTRAINT uk_repository_provider_external UNIQUE (provider, external_repository_id)
);

INSERT INTO repository_connections (
    workspace_id, provider, external_repository_id, full_name, default_branch, created_at, updated_at
)
SELECT
    id, 'GITLAB', CAST(gitlab_project_id AS VARCHAR(255)), gitlab_project_path,
    default_branch, created_at, updated_at
FROM workspace_metadata;

-- Compatibility columns remain readable by the current GitLab adapter. Future providers use
-- repository_connections and may leave these legacy columns null.
ALTER TABLE workspace_metadata ALTER COLUMN gitlab_project_id DROP NOT NULL;
ALTER TABLE workspace_metadata ALTER COLUMN gitlab_project_path DROP NOT NULL;

ALTER TABLE user_accounts ALTER COLUMN gitlab_user_id DROP NOT NULL;
