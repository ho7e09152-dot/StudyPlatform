ALTER TABLE user_accounts RENAME COLUMN terms_accepted_at TO terms_agreed_at;
ALTER TABLE user_accounts ADD COLUMN privacy_version VARCHAR(32);
ALTER TABLE user_accounts ADD COLUMN privacy_agreed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE user_accounts ADD COLUMN minimum_age_confirmed_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX idx_notifications_created_at ON in_app_notifications(created_at);
CREATE INDEX idx_sync_jobs_started_at ON sync_jobs(started_at);
CREATE INDEX idx_audit_events_created_at ON audit_events(created_at);
