package com.studyworkspace.workspace.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional
class BackendContentSourceMigrationTests {

	@Autowired
	private NamedParameterJdbcTemplate jdbcTemplate;

	@Test
	void existingCompatibleWorkspaceDefaultsToRepositoryPrimaryUntilBackfillCompletes() {
		insertWorkspace("workspace-storage-migration-test");

		Map<String, Object> storageState = jdbcTemplate.queryForMap("""
			SELECT storage_mode, content_schema_version, content_migration_started_at, content_migration_completed_at
			FROM workspace_metadata
			WHERE id = :id
			""", Map.of("id", "workspace-storage-migration-test"));

		assertThat(storageState.get("storage_mode")).isEqualTo("REPOSITORY_PRIMARY");
		assertThat(((Number) storageState.get("content_schema_version")).intValue()).isEqualTo(1);
		assertThat(storageState.get("content_migration_started_at")).isNull();
		assertThat(storageState.get("content_migration_completed_at")).isNull();
	}

	@Test
	void normalizedBackendContentTablesAreAvailable() {
		for (String table : new String[] {
			"workspace_sessions",
			"workspace_session_items",
			"workspace_submission_threads",
			"workspace_submissions",
			"workspace_session_reflections",
			"workspace_submission_artifacts",
			"workspace_submission_reviews"
		}) {
			Integer rowCount = jdbcTemplate.getJdbcTemplate().queryForObject("SELECT COUNT(*) FROM " + table, Integer.class);
			assertThat(rowCount).isZero();
		}
	}

	@Test
	void crossWorkspaceSubmissionReferenceIsRejected() {
		insertWorkspace("workspace-storage-owner");
		insertWorkspace("workspace-storage-other");
		insertSession("session-storage-owner", "workspace-storage-owner");
		insertThread("thread-storage-owner", "workspace-storage-owner", "session-storage-owner");

		assertThatThrownBy(() -> insertSubmission(
			"submission-cross-workspace",
			"workspace-storage-other",
			"session-storage-owner",
			"thread-storage-owner"
		)).isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void crossWorkspaceMemberAttributionIsRejected() {
		insertWorkspace("workspace-content-owner");
		insertWorkspace("workspace-member-owner");
		insertUserWithMembership("user-wrong-workspace", "workspace-member-owner");
		insertSession("session-content-owner", "workspace-content-owner");

		assertThatThrownBy(() -> jdbcTemplate.update("""
			INSERT INTO workspace_submission_threads (
				id, workspace_id, session_id, member_id, member_user_id, created_at, updated_at, entity_version
			) VALUES (
				'thread-wrong-member', 'workspace-content-owner', 'session-content-owner', 'member-1',
				'user-wrong-workspace', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0
			)
			""", Map.of())).isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void nonMemberSessionActorIsRejected() {
		insertWorkspace("workspace-session-owner");
		insertWorkspace("workspace-actor-owner");
		insertUserWithMembership("user-wrong-actor", "workspace-actor-owner");

		assertThatThrownBy(() -> jdbcTemplate.update("""
			INSERT INTO workspace_sessions (
				id, workspace_id, session_date, revision, session_type, title, status,
				created_by_user_id, created_at, updated_at, entity_version
			) VALUES (
				'session-wrong-actor', 'workspace-session-owner', DATE '2026-09-13', 1, 'ALGORITHM',
				'Session', 'ACTIVE', 'user-wrong-actor', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0
			)
			""", Map.of())).isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void crossWorkspaceArtifactReferenceIsRejected() {
		insertWorkspace("workspace-artifact-owner");
		insertWorkspace("workspace-artifact-other");
		insertSession("session-artifact-owner", "workspace-artifact-owner");
		insertThread("thread-artifact-owner", "workspace-artifact-owner", "session-artifact-owner");
		insertSubmission(
			"submission-artifact-owner", "workspace-artifact-owner", "session-artifact-owner", "thread-artifact-owner"
		);

		assertThatThrownBy(() -> jdbcTemplate.update("""
			INSERT INTO workspace_submission_artifacts (
				id, workspace_id, submission_id, provider, external_repository_id, repository_path,
				repository_branch, original_file_name, size_bytes, sha256, storage_status, created_at, updated_at
			) VALUES (
				'artifact-cross-workspace', 'workspace-artifact-other', 'submission-artifact-owner',
				'GITLAB', 'repository-1', 'artifacts/file.pdf', 'main', 'file.pdf', 100,
				'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
				'AVAILABLE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
			)
			""", Map.of())).isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void deletingWorkspaceCascadesAllNormalizedContent() {
		String workspaceId = "workspace-storage-cascade";
		String sessionId = "session-storage-cascade";
		String threadId = "thread-storage-cascade";
		String submissionId = "submission-storage-cascade";
		insertWorkspace(workspaceId);
		insertSession(sessionId, workspaceId);
		jdbcTemplate.update("""
			INSERT INTO workspace_session_items (
				session_id, item_id, lifecycle, item_order, title, item_type, required, status, created_at, updated_at
			) VALUES (
				:sessionId, 'item-1', 'ACTIVE', 1, 'Item', 'algorithm', TRUE, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
			)
			""", Map.of("sessionId", sessionId));
		insertThread(threadId, workspaceId, sessionId);
		insertSubmission(submissionId, workspaceId, sessionId, threadId);
		jdbcTemplate.update("""
			INSERT INTO workspace_session_reflections (
				thread_id, session_id, workspace_id, member_id, body, created_at, updated_at, entity_version
			) VALUES (
				:threadId, :sessionId, :workspaceId, 'member-1', 'Reflection', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0
			)
			""", Map.of("threadId", threadId, "sessionId", sessionId, "workspaceId", workspaceId));
		jdbcTemplate.update("""
			INSERT INTO workspace_submission_artifacts (
				id, workspace_id, submission_id, provider, external_repository_id, repository_path, repository_branch,
				original_file_name, size_bytes, sha256, storage_status, created_at, updated_at
			) VALUES (
				'artifact-storage-cascade', :workspaceId, :submissionId, 'GITLAB', 'repository-1', 'artifacts/file.pdf', 'main',
				'file.pdf', 100, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
				'AVAILABLE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
			)
			""", Map.of("workspaceId", workspaceId, "submissionId", submissionId));
		jdbcTemplate.update("""
			INSERT INTO workspace_submission_reviews (
				id, workspace_id, thread_id, author_name, body, status, provider, external_repository_id, provider_comment_id,
				legacy_repository_commit_id, created_at, updated_at, entity_version
			) VALUES (
				'review-storage-cascade', :workspaceId, :threadId, 'Reviewer', 'Review', 'ACTIVE',
				'GITLAB', 'repository-1', 'comment-1', 'commit-1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0
			)
			""", Map.of("workspaceId", workspaceId, "threadId", threadId));

		jdbcTemplate.update("DELETE FROM workspace_metadata WHERE id = :id", Map.of("id", workspaceId));

		for (String table : new String[] {
			"workspace_sessions",
			"workspace_session_items",
			"workspace_submission_threads",
			"workspace_submissions",
			"workspace_session_reflections",
			"workspace_submission_artifacts",
			"workspace_submission_reviews"
		}) {
			Integer rowCount = jdbcTemplate.getJdbcTemplate().queryForObject("SELECT COUNT(*) FROM " + table, Integer.class);
			assertThat(rowCount).isZero();
		}
	}

	private void insertWorkspace(String id) {
		jdbcTemplate.update("""
			INSERT INTO workspace_metadata (
				id, name, default_branch, repository_base_path, repository_schema_version, import_mode,
				timezone, status, created_at, updated_at, state_json, entity_version
			) VALUES (
				:id, 'Migration fixture', 'main', '', 1, 'COMPATIBLE',
				'Asia/Seoul', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '{}', 0
			)
			""", Map.of("id", id));
	}

	private void insertSession(String id, String workspaceId) {
		jdbcTemplate.update("""
			INSERT INTO workspace_sessions (
				id, workspace_id, session_date, revision, session_type, title, status, created_at, updated_at, entity_version
			) VALUES (
				:id, :workspaceId, DATE '2026-09-12', 1, 'ALGORITHM', 'Session', 'ACTIVE',
				CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0
			)
			""", Map.of("id", id, "workspaceId", workspaceId));
	}

	private void insertUserWithMembership(String userId, String workspaceId) {
		jdbcTemplate.update("""
			INSERT INTO user_accounts (id, username, display_name, created_at, updated_at)
			VALUES (:userId, :userId, 'Migration user', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
			""", Map.of("userId", userId));
		jdbcTemplate.update("""
			INSERT INTO workspace_memberships (workspace_id, user_id, role, status, joined_at)
			VALUES (:workspaceId, :userId, 'MEMBER', 'ACTIVE', CURRENT_TIMESTAMP)
			""", Map.of("workspaceId", workspaceId, "userId", userId));
	}

	private void insertThread(String id, String workspaceId, String sessionId) {
		jdbcTemplate.update("""
			INSERT INTO workspace_submission_threads (
				id, workspace_id, session_id, member_id, created_at, updated_at, entity_version
			) VALUES (
				:id, :workspaceId, :sessionId, 'member-1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0
			)
			""", Map.of("id", id, "workspaceId", workspaceId, "sessionId", sessionId));
	}

	private void insertSubmission(String id, String workspaceId, String sessionId, String threadId) {
		jdbcTemplate.update("""
			INSERT INTO workspace_submissions (
				id, workspace_id, session_id, thread_id, item_id, member_id, answer_type, text_answer, status,
				submitted_at, updated_at, entity_version
			) VALUES (
				:id, :workspaceId, :sessionId, :threadId, 'item-1', 'member-1', 'TEXT', 'Answer', 'SUBMITTED',
				CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0
			)
			""", Map.of("id", id, "workspaceId", workspaceId, "sessionId", sessionId, "threadId", threadId));
	}
}
