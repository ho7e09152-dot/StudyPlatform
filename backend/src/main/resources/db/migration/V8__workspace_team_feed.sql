CREATE TABLE workspace_announcements (
    id VARCHAR(36) PRIMARY KEY,
    workspace_id VARCHAR(64) NOT NULL,
    author_user_id VARCHAR(36),
    author_display_name VARCHAR(255) NOT NULL,
    title VARCHAR(120) NOT NULL,
    body TEXT NOT NULL,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    published_at TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    archived_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_announcement_workspace FOREIGN KEY (workspace_id) REFERENCES workspace_metadata(id) ON DELETE CASCADE,
    CONSTRAINT fk_announcement_author FOREIGN KEY (author_user_id) REFERENCES user_accounts(id) ON DELETE SET NULL
);

CREATE INDEX idx_announcements_workspace_published
    ON workspace_announcements(workspace_id, archived_at, published_at DESC);

CREATE TABLE workspace_messages (
    id VARCHAR(36) PRIMARY KEY,
    workspace_id VARCHAR(64) NOT NULL,
    author_user_id VARCHAR(36),
    author_display_name VARCHAR(255) NOT NULL,
    context_date DATE NOT NULL,
    body VARCHAR(4000) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_message_workspace FOREIGN KEY (workspace_id) REFERENCES workspace_metadata(id) ON DELETE CASCADE,
    CONSTRAINT fk_message_author FOREIGN KEY (author_user_id) REFERENCES user_accounts(id) ON DELETE SET NULL
);

CREATE INDEX idx_messages_workspace_date_created
    ON workspace_messages(workspace_id, context_date, created_at DESC);

CREATE TABLE announcement_reads (
    announcement_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    read_at TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY (announcement_id, user_id),
    CONSTRAINT fk_announcement_read_announcement FOREIGN KEY (announcement_id) REFERENCES workspace_announcements(id) ON DELETE CASCADE,
    CONSTRAINT fk_announcement_read_user FOREIGN KEY (user_id) REFERENCES user_accounts(id) ON DELETE CASCADE
);
