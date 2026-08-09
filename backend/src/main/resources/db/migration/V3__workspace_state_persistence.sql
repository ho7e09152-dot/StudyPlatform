ALTER TABLE workspace_metadata ADD COLUMN last_synced_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE workspace_metadata ADD COLUMN state_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE workspace_metadata ADD COLUMN deletion_expires_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX idx_workspace_metadata_status ON workspace_metadata(status);

CREATE TABLE audit_events (
    id VARCHAR(36) PRIMARY KEY,
    workspace_id VARCHAR(64),
    actor_user_id VARCHAR(36),
    event_type VARCHAR(100) NOT NULL,
    target_type VARCHAR(100),
    target_id VARCHAR(255),
    details_json TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT fk_audit_workspace FOREIGN KEY (workspace_id) REFERENCES workspace_metadata(id) ON DELETE SET NULL,
    CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES user_accounts(id) ON DELETE SET NULL
);

CREATE INDEX idx_audit_events_workspace_created ON audit_events(workspace_id, created_at);
