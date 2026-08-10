CREATE TABLE workspace_documents (
    id VARCHAR(36) PRIMARY KEY,
    workspace_id VARCHAR(64) NOT NULL,
    author_user_id VARCHAR(36),
    author_display_name VARCHAR(255) NOT NULL,
    title VARCHAR(120) NOT NULL,
    body_markdown TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_document_workspace FOREIGN KEY (workspace_id) REFERENCES workspace_metadata(id) ON DELETE CASCADE,
    CONSTRAINT fk_document_author FOREIGN KEY (author_user_id) REFERENCES user_accounts(id) ON DELETE SET NULL
);

CREATE INDEX idx_documents_workspace_updated
    ON workspace_documents(workspace_id, deleted_at, updated_at DESC);
