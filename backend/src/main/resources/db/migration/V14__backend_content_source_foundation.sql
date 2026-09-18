-- Additive foundation for moving Study-ing-managed content from Repository files to PostgreSQL.
-- Existing workspaces remain REPOSITORY_PRIMARY until the application completes a verified backfill.
ALTER TABLE workspace_metadata ADD COLUMN storage_mode VARCHAR(32) NOT NULL DEFAULT 'REPOSITORY_PRIMARY';
ALTER TABLE workspace_metadata ADD COLUMN content_schema_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE workspace_metadata ADD COLUMN content_migration_started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE workspace_metadata ADD COLUMN content_migration_completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE workspace_metadata ADD CONSTRAINT chk_workspace_metadata_storage_mode
    CHECK (storage_mode IN ('REPOSITORY_PRIMARY', 'MIGRATING', 'DATABASE_PRIMARY'));
ALTER TABLE workspace_metadata ADD CONSTRAINT chk_workspace_metadata_content_schema_version
    CHECK (content_schema_version > 0);

CREATE INDEX idx_workspace_metadata_storage_mode ON workspace_metadata(storage_mode, status);

CREATE TABLE workspace_sessions (
    id VARCHAR(36) PRIMARY KEY,
    workspace_id VARCHAR(64) NOT NULL,
    session_date DATE NOT NULL,
    revision INTEGER NOT NULL,
    session_type VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(32) NOT NULL,
    deadline_at TIMESTAMP WITH TIME ZONE,
    secondary_deadline_at TIMESTAMP WITH TIME ZONE,
    created_by_user_id VARCHAR(36),
    created_by_name VARCHAR(255),
    updated_by_user_id VARCHAR(36),
    updated_by_name VARCHAR(255),
    change_message VARCHAR(500),
    change_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    legacy_repository_path VARCHAR(2048),
    legacy_repository_commit_id VARCHAR(128),
    legacy_import_hash VARCHAR(64),
    entity_version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT fk_workspace_sessions_workspace FOREIGN KEY (workspace_id) REFERENCES workspace_metadata(id) ON DELETE CASCADE,
    CONSTRAINT fk_workspace_sessions_created_by_membership FOREIGN KEY (workspace_id, created_by_user_id) REFERENCES workspace_memberships(workspace_id, user_id),
    CONSTRAINT fk_workspace_sessions_updated_by_membership FOREIGN KEY (workspace_id, updated_by_user_id) REFERENCES workspace_memberships(workspace_id, user_id),
    CONSTRAINT uk_workspace_sessions_date UNIQUE (workspace_id, session_date),
    CONSTRAINT uk_workspace_sessions_id_workspace UNIQUE (id, workspace_id)
);

CREATE INDEX idx_workspace_sessions_workspace_status_date
    ON workspace_sessions(workspace_id, status, session_date);

CREATE TABLE workspace_session_items (
    session_id VARCHAR(36) NOT NULL,
    item_id VARCHAR(128) NOT NULL,
    lifecycle VARCHAR(32) NOT NULL,
    item_order INTEGER NOT NULL,
    title VARCHAR(500) NOT NULL,
    item_type VARCHAR(64) NOT NULL,
    source_name VARCHAR(255),
    source_url VARCHAR(2048),
    submit_type VARCHAR(64),
    required BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(32) NOT NULL,
    replaces_item_id VARCHAR(128),
    replaced_by_item_id VARCHAR(128),
    legacy_import_hash VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY (session_id, item_id, lifecycle),
    CONSTRAINT fk_workspace_session_items_session FOREIGN KEY (session_id) REFERENCES workspace_sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_workspace_session_items_order
    ON workspace_session_items(session_id, lifecycle, item_order);

CREATE TABLE workspace_submission_threads (
    id VARCHAR(36) PRIMARY KEY,
    workspace_id VARCHAR(64) NOT NULL,
    session_id VARCHAR(36) NOT NULL,
    member_id VARCHAR(64) NOT NULL,
    member_user_id VARCHAR(36),
    member_display_name VARCHAR(255),
    source_session_revision INTEGER,
    legacy_repository_path VARCHAR(2048),
    legacy_repository_commit_id VARCHAR(128),
    legacy_repository_commit_message VARCHAR(500),
    legacy_import_hash VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    entity_version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT fk_workspace_submission_threads_session_workspace FOREIGN KEY (session_id, workspace_id) REFERENCES workspace_sessions(id, workspace_id) ON DELETE CASCADE,
    CONSTRAINT fk_workspace_submission_threads_membership FOREIGN KEY (workspace_id, member_user_id) REFERENCES workspace_memberships(workspace_id, user_id),
    CONSTRAINT uk_workspace_submission_threads_member UNIQUE (session_id, member_id),
    CONSTRAINT uk_workspace_submission_threads_id_workspace UNIQUE (id, workspace_id),
    CONSTRAINT uk_workspace_submission_threads_id_workspace_session UNIQUE (id, workspace_id, session_id)
);

CREATE INDEX idx_workspace_submission_threads_workspace_member
    ON workspace_submission_threads(workspace_id, member_id, updated_at);

CREATE TABLE workspace_submissions (
    id VARCHAR(36) PRIMARY KEY,
    workspace_id VARCHAR(64) NOT NULL,
    session_id VARCHAR(36) NOT NULL,
    thread_id VARCHAR(36) NOT NULL,
    item_id VARCHAR(128) NOT NULL,
    member_id VARCHAR(64) NOT NULL,
    member_user_id VARCHAR(36),
    member_display_name VARCHAR(255),
    answer_type VARCHAR(64) NOT NULL,
    text_answer TEXT,
    link_url VARCHAR(4096),
    language VARCHAR(100),
    status VARCHAR(32) NOT NULL,
    source_session_revision INTEGER,
    legacy_repository_path VARCHAR(2048),
    legacy_repository_commit_id VARCHAR(128),
    legacy_repository_commit_message VARCHAR(500),
    legacy_import_hash VARCHAR(64),
    submitted_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    entity_version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT fk_workspace_submissions_workspace FOREIGN KEY (workspace_id) REFERENCES workspace_metadata(id) ON DELETE CASCADE,
    CONSTRAINT fk_workspace_submissions_session_workspace FOREIGN KEY (session_id, workspace_id) REFERENCES workspace_sessions(id, workspace_id) ON DELETE CASCADE,
    CONSTRAINT fk_workspace_submissions_thread_workspace_session FOREIGN KEY (thread_id, workspace_id, session_id) REFERENCES workspace_submission_threads(id, workspace_id, session_id) ON DELETE CASCADE,
    CONSTRAINT fk_workspace_submissions_membership FOREIGN KEY (workspace_id, member_user_id) REFERENCES workspace_memberships(workspace_id, user_id),
    CONSTRAINT uk_workspace_submissions_thread_item UNIQUE (thread_id, item_id),
    CONSTRAINT uk_workspace_submissions_id_workspace UNIQUE (id, workspace_id)
);

CREATE INDEX idx_workspace_submissions_workspace_member
    ON workspace_submissions(workspace_id, member_id, updated_at);
CREATE INDEX idx_workspace_submissions_session_item
    ON workspace_submissions(session_id, item_id, status);

CREATE TABLE workspace_session_reflections (
    thread_id VARCHAR(36) NOT NULL,
    session_id VARCHAR(36) NOT NULL,
    workspace_id VARCHAR(64) NOT NULL,
    member_id VARCHAR(64) NOT NULL,
    member_user_id VARCHAR(36),
    member_display_name VARCHAR(255),
    body TEXT NOT NULL,
    source_session_revision INTEGER,
    legacy_repository_path VARCHAR(2048),
    legacy_repository_commit_id VARCHAR(128),
    legacy_import_hash VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    entity_version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (thread_id),
    CONSTRAINT fk_workspace_session_reflections_session_workspace FOREIGN KEY (session_id, workspace_id) REFERENCES workspace_sessions(id, workspace_id) ON DELETE CASCADE,
    CONSTRAINT fk_workspace_session_reflections_thread_workspace_session FOREIGN KEY (thread_id, workspace_id, session_id) REFERENCES workspace_submission_threads(id, workspace_id, session_id) ON DELETE CASCADE,
    CONSTRAINT fk_workspace_session_reflections_membership FOREIGN KEY (workspace_id, member_user_id) REFERENCES workspace_memberships(workspace_id, user_id)
);

CREATE TABLE workspace_submission_artifacts (
    id VARCHAR(36) PRIMARY KEY,
    workspace_id VARCHAR(64) NOT NULL,
    submission_id VARCHAR(36) NOT NULL,
    provider VARCHAR(32) NOT NULL,
    external_repository_id VARCHAR(255) NOT NULL,
    repository_path VARCHAR(2048) NOT NULL,
    repository_branch VARCHAR(255) NOT NULL,
    provider_blob_id VARCHAR(255),
    provider_commit_sha VARCHAR(128),
    original_file_name VARCHAR(512) NOT NULL,
    mime_type VARCHAR(255),
    size_bytes BIGINT NOT NULL,
    sha256 VARCHAR(64) NOT NULL,
    storage_status VARCHAR(32) NOT NULL,
    failure_code VARCHAR(128),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT chk_workspace_submission_artifacts_size CHECK (size_bytes >= 0),
    CONSTRAINT chk_workspace_submission_artifacts_status CHECK (storage_status IN ('PENDING', 'AVAILABLE', 'FAILED')),
    CONSTRAINT fk_workspace_submission_artifacts_submission_workspace FOREIGN KEY (submission_id, workspace_id) REFERENCES workspace_submissions(id, workspace_id) ON DELETE CASCADE,
    CONSTRAINT uk_workspace_submission_artifacts_path UNIQUE (workspace_id, provider, external_repository_id, repository_path)
);

CREATE INDEX idx_workspace_submission_artifacts_submission
    ON workspace_submission_artifacts(workspace_id, submission_id, storage_status);

CREATE TABLE workspace_submission_reviews (
    id VARCHAR(36) PRIMARY KEY,
    workspace_id VARCHAR(64) NOT NULL,
    thread_id VARCHAR(36) NOT NULL,
    author_user_id VARCHAR(36),
    author_name VARCHAR(255),
    author_username VARCHAR(255),
    author_provider_external_id VARCHAR(255),
    author_avatar_url VARCHAR(2048),
    body TEXT NOT NULL,
    status VARCHAR(32) NOT NULL,
    provider VARCHAR(32) NOT NULL,
    external_repository_id VARCHAR(255) NOT NULL,
    provider_comment_id VARCHAR(255) NOT NULL,
    legacy_repository_commit_id VARCHAR(128) NOT NULL,
    legacy_import_hash VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    entity_version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT fk_workspace_submission_reviews_workspace FOREIGN KEY (workspace_id) REFERENCES workspace_metadata(id) ON DELETE CASCADE,
    CONSTRAINT fk_workspace_submission_reviews_thread_workspace FOREIGN KEY (thread_id, workspace_id) REFERENCES workspace_submission_threads(id, workspace_id) ON DELETE CASCADE,
    CONSTRAINT fk_workspace_submission_reviews_author_membership FOREIGN KEY (workspace_id, author_user_id) REFERENCES workspace_memberships(workspace_id, user_id),
    CONSTRAINT uk_workspace_submission_reviews_provider_comment UNIQUE (provider, external_repository_id, provider_comment_id, legacy_repository_commit_id)
);

CREATE INDEX idx_workspace_submission_reviews_thread
    ON workspace_submission_reviews(thread_id, created_at);
CREATE INDEX idx_workspace_submission_reviews_workspace
    ON workspace_submission_reviews(workspace_id);

CREATE TABLE workspace_content_migration_reports (
    workspace_id VARCHAR(64) PRIMARY KEY,
    status VARCHAR(32) NOT NULL,
    source_last_synced_at TIMESTAMP WITH TIME ZONE,
    session_count INTEGER NOT NULL,
    item_count INTEGER NOT NULL,
    thread_count INTEGER NOT NULL,
    submission_count INTEGER NOT NULL,
    reflection_count INTEGER NOT NULL,
    review_count INTEGER,
    source_fingerprint VARCHAR(64) NOT NULL,
    database_fingerprint VARCHAR(64) NOT NULL,
    review_fingerprint VARCHAR(64),
    reviews_pending BOOLEAN NOT NULL DEFAULT TRUE,
    verified_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT chk_workspace_content_migration_status CHECK (status IN ('BACKFILL_VERIFIED')),
    CONSTRAINT fk_workspace_content_migration_workspace FOREIGN KEY (workspace_id) REFERENCES workspace_metadata(id) ON DELETE CASCADE
);
