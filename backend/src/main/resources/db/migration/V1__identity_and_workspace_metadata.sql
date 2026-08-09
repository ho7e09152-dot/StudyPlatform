CREATE TABLE user_accounts (
    id VARCHAR(36) PRIMARY KEY,
    gitlab_user_id BIGINT NOT NULL UNIQUE,
    username VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(2048),
    web_url VARCHAR(2048),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE oauth_credentials (
    user_id VARCHAR(36) PRIMARY KEY,
    access_token_ciphertext VARCHAR(8192) NOT NULL,
    refresh_token_ciphertext VARCHAR(8192),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    scope VARCHAR(1000),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT fk_oauth_credentials_user FOREIGN KEY (user_id) REFERENCES user_accounts(id) ON DELETE CASCADE
);

CREATE TABLE workspace_metadata (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    gitlab_project_id BIGINT NOT NULL UNIQUE,
    gitlab_project_path VARCHAR(1024) NOT NULL,
    default_branch VARCHAR(255) NOT NULL,
    timezone VARCHAR(100) NOT NULL,
    status VARCHAR(32) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE workspace_memberships (
    workspace_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    role VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY (workspace_id, user_id),
    CONSTRAINT fk_workspace_membership_workspace FOREIGN KEY (workspace_id) REFERENCES workspace_metadata(id) ON DELETE CASCADE,
    CONSTRAINT fk_workspace_membership_user FOREIGN KEY (user_id) REFERENCES user_accounts(id) ON DELETE CASCADE
);

CREATE INDEX idx_workspace_memberships_user ON workspace_memberships(user_id, status);

CREATE TABLE sync_jobs (
    id VARCHAR(36) PRIMARY KEY,
    workspace_id VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL,
    job_type VARCHAR(64) NOT NULL,
    error_code VARCHAR(255),
    error_message VARCHAR(2000),
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_sync_jobs_workspace FOREIGN KEY (workspace_id) REFERENCES workspace_metadata(id) ON DELETE CASCADE
);

CREATE INDEX idx_sync_jobs_workspace_started ON sync_jobs(workspace_id, started_at);
