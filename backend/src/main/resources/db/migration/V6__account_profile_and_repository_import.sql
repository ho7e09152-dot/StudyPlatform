ALTER TABLE user_accounts ADD COLUMN profile_completed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE user_accounts ADD COLUMN repository_file_name VARCHAR(120);
ALTER TABLE user_accounts ADD COLUMN timezone VARCHAR(100) NOT NULL DEFAULT 'Asia/Seoul';
ALTER TABLE user_accounts ADD COLUMN terms_version VARCHAR(32);
ALTER TABLE user_accounts ADD COLUMN terms_accepted_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE workspace_metadata ADD COLUMN repository_base_path VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE workspace_metadata ADD COLUMN repository_schema_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE workspace_metadata ADD COLUMN import_mode VARCHAR(32) NOT NULL DEFAULT 'COMPATIBLE';

