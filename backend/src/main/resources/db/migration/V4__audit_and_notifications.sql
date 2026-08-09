CREATE TABLE in_app_notifications (
    id VARCHAR(36) PRIMARY KEY,
    recipient_gitlab_user_id BIGINT NOT NULL,
    workspace_id VARCHAR(64),
    notification_type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message VARCHAR(2000) NOT NULL,
    action_path VARCHAR(1024),
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT fk_notification_workspace FOREIGN KEY (workspace_id) REFERENCES workspace_metadata(id) ON DELETE CASCADE
);

CREATE INDEX idx_notifications_recipient_created
    ON in_app_notifications(recipient_gitlab_user_id, created_at);

