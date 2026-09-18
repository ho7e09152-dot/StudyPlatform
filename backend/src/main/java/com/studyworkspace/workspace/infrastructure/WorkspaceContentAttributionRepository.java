package com.studyworkspace.workspace.infrastructure;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Keeps shared DB-primary content while removing attribution for a deleted account. */
@Repository
public class WorkspaceContentAttributionRepository {
	private static final String DELETED_USER_NAME = "탈퇴한 사용자";

	private final JdbcClient jdbcClient;

	public WorkspaceContentAttributionRepository(JdbcClient jdbcClient) {
		this.jdbcClient = jdbcClient;
	}

	public int anonymizeUser(String userId) {
		int updated = jdbcClient.sql("""
			UPDATE workspace_sessions
			SET created_by_name = CASE WHEN created_by_user_id = :userId THEN :deletedName ELSE created_by_name END,
				created_by_user_id = CASE WHEN created_by_user_id = :userId THEN NULL ELSE created_by_user_id END,
				updated_by_name = CASE WHEN updated_by_user_id = :userId THEN :deletedName ELSE updated_by_name END,
				updated_by_user_id = CASE WHEN updated_by_user_id = :userId THEN NULL ELSE updated_by_user_id END
			WHERE created_by_user_id = :userId OR updated_by_user_id = :userId
			""")
			.param("userId", userId)
			.param("deletedName", DELETED_USER_NAME)
			.update();
		updated += jdbcClient.sql("""
			UPDATE workspace_submission_threads
			SET member_user_id = NULL, member_display_name = :deletedName
			WHERE member_user_id = :userId
			""")
			.param("userId", userId)
			.param("deletedName", DELETED_USER_NAME)
			.update();
		updated += jdbcClient.sql("""
			UPDATE workspace_submissions
			SET member_user_id = NULL, member_display_name = :deletedName
			WHERE member_user_id = :userId
			""")
			.param("userId", userId)
			.param("deletedName", DELETED_USER_NAME)
			.update();
		updated += jdbcClient.sql("""
			UPDATE workspace_session_reflections
			SET member_user_id = NULL, member_display_name = :deletedName
			WHERE member_user_id = :userId
			""")
			.param("userId", userId)
			.param("deletedName", DELETED_USER_NAME)
			.update();
		updated += jdbcClient.sql("""
			UPDATE workspace_submission_reviews
			SET author_user_id = NULL, author_name = :deletedName, author_username = 'deleted-user',
				author_provider_external_id = NULL, author_avatar_url = NULL
			WHERE author_user_id = :userId
			""")
			.param("userId", userId)
			.param("deletedName", DELETED_USER_NAME)
			.update();
		return updated;
	}
}
