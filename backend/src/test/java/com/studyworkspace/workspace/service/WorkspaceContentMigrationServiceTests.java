package com.studyworkspace.workspace.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

import com.studyworkspace.workspace.domain.WorkspaceException;
import com.studyworkspace.workspace.domain.WorkspaceModels.MemberSubmissionFile;
import com.studyworkspace.workspace.domain.WorkspaceModels.Notifications;
import com.studyworkspace.workspace.domain.WorkspaceModels.SessionChange;
import com.studyworkspace.workspace.domain.WorkspaceModels.SessionItem;
import com.studyworkspace.workspace.domain.WorkspaceModels.StudyMember;
import com.studyworkspace.workspace.domain.WorkspaceModels.StudySession;
import com.studyworkspace.workspace.domain.WorkspaceModels.SubmissionEntry;
import com.studyworkspace.workspace.domain.WorkspaceModels.WorkspaceSettings;
import com.studyworkspace.workspace.domain.WorkspaceModels.WorkspaceState;
import com.studyworkspace.workspace.infrastructure.WorkspaceStateEntity;
import com.studyworkspace.workspace.infrastructure.WorkspaceStateRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest
@Transactional
class WorkspaceContentMigrationServiceTests {
	@Autowired private WorkspaceContentMigrationService migrationService;
	@Autowired private WorkspaceStateRepository stateRepository;
	@Autowired private ObjectMapper objectMapper;
	@Autowired private JdbcClient jdbcClient;
	@Autowired private EntityManager entityManager;

	@Test
	void stagesAndVerifiesLegacySnapshotIdempotentlyWithoutChangingStorageMode() {
		WorkspaceState source = insertSourceWorkspace("workspace-content-backfill", 880001L);

		var first = migrationService.stageLegacySnapshot(source.id());
		var second = migrationService.stageLegacySnapshot(source.id());

		assertThat(first.status()).isEqualTo("BACKFILL_VERIFIED");
		assertThat(first.sessionCount()).isEqualTo(1);
		assertThat(first.itemCount()).isEqualTo(2);
		assertThat(first.threadCount()).isEqualTo(1);
		assertThat(first.submissionCount()).isEqualTo(2);
		assertThat(first.reflectionCount()).isEqualTo(1);
		assertThat(first.sourceFingerprint()).isEqualTo(first.databaseFingerprint());
		assertThat(second.sourceFingerprint()).isEqualTo(first.sourceFingerprint());
		assertThat(second.databaseFingerprint()).isEqualTo(first.databaseFingerprint());
		assertThat(second.reviewsPending()).isTrue();
		assertThat(stateRepository.findById(source.id()).orElseThrow().storageMode()).isEqualTo("REPOSITORY_PRIMARY");
		assertThat(jdbcClient.sql("SELECT COUNT(*) FROM workspace_sessions WHERE workspace_id = :workspaceId")
			.param("workspaceId", source.id()).query(Long.class).single()).isEqualTo(1);
		assertThat(jdbcClient.sql("SELECT COUNT(*) FROM workspace_submissions WHERE workspace_id = :workspaceId")
			.param("workspaceId", source.id()).query(Long.class).single()).isEqualTo(2);
		assertThat(jdbcClient.sql("""
			SELECT COUNT(*) FROM workspace_memberships
			WHERE workspace_id = :workspaceId AND user_id = 'user-content-backfill'
			""").param("workspaceId", source.id()).query(Long.class).single()).isEqualTo(1);
		assertThat(jdbcClient.sql("""
			SELECT member_id FROM workspace_submissions
			WHERE workspace_id = :workspaceId FETCH FIRST 1 ROW ONLY
			""").param("workspaceId", source.id()).query(String.class).single())
			.isNotEqualTo("member-880001");
		assertThat(jdbcClient.sql("""
			SELECT link_url FROM workspace_submissions
			WHERE workspace_id = :workspaceId AND answer_type = 'LINK'
			""").param("workspaceId", source.id()).query(String.class).single())
			.isEqualTo("https://example.test/answer");
		assertThat(jdbcClient.sql("""
			SELECT text_answer FROM workspace_submissions
			WHERE workspace_id = :workspaceId AND answer_type = 'TEXT'
			""").param("workspaceId", source.id()).query(String.class).single())
			.isEqualTo("정규화된 답변");
		assertThat(jdbcClient.sql("""
			SELECT COUNT(*) FROM workspace_content_migration_reports
			WHERE workspace_id = :workspaceId AND status = 'BACKFILL_VERIFIED'
				AND source_fingerprint = database_fingerprint AND reviews_pending = TRUE
			""").param("workspaceId", source.id()).query(Long.class).single()).isEqualTo(1);
	}

	@Test
	void rejectsRestagingAfterWorkspaceBecomesDatabasePrimary() {
		WorkspaceState source = insertSourceWorkspace("workspace-content-primary", 880002L);
		jdbcClient.sql("""
			UPDATE workspace_metadata SET storage_mode = 'DATABASE_PRIMARY' WHERE id = :workspaceId
			""").param("workspaceId", source.id()).update();
		entityManager.clear();

		assertThatThrownBy(() -> migrationService.stageLegacySnapshot(source.id()))
			.isInstanceOfSatisfying(WorkspaceException.class, exception ->
				assertThat(exception.code()).isEqualTo("CONTENT_MIGRATION_MODE_CONFLICT"));
	}

	private WorkspaceState insertSourceWorkspace(String workspaceId, long projectId) {
		String userId = "user-" + workspaceId.substring("workspace-".length());
		OffsetDateTime now = OffsetDateTime.parse("2026-09-13T09:00:00+09:00");
		jdbcClient.sql("""
			INSERT INTO user_accounts (id, gitlab_user_id, username, display_name, created_at, updated_at)
			VALUES (:id, :gitLabUserId, 'legacy-user', '기존 사용자', :now, :now)
			""")
			.param("id", userId)
			.param("gitLabUserId", projectId + 1000)
			.param("now", now)
			.update();
		StudyMember member = new StudyMember(
			"member-" + projectId, projectId + 1000, "legacy-user", "기존 사용자", "기", "#6d52b5",
			"legacy-user.md", "OWNER", "ACTIVE", 40, userId
		);
		SessionItem active = new SessionItem(
			"item-link", 1, "링크 항목", "algorithm", "BOJ", "https://example.test/problem",
			"link", true, "active", null, null
		);
		SessionItem archived = new SessionItem(
			"item-text", 2, "텍스트 항목", "algorithm", "Note", null,
			"text", false, "cancelled", null, null
		);
		StudySession session = new StudySession(
			"2026-09-13", "260913", 2, "algorithm", "전환 일정", "기존 Repository 일정", "active",
			"2026-09-13T23:59:00+09:00", null,
			"2026-09-13T09:00:00+09:00", "legacy-user",
			"2026-09-13T10:00:00+09:00", "기존 사용자",
			new SessionChange(true, "일정 수정", "범위 조정"), List.of(active), List.of(archived), "session-commit-1"
		);
		MemberSubmissionFile submission = new MemberSubmissionFile(
			1, member.id(), member.gitlabUserId(), member.displayName(), session.folder(), session.revision(), session.type(),
			"2026-09-13T12:00:00+09:00",
			List.of(
				new SubmissionEntry(
					active.id(), "link", "https://example.test/answer", null,
					"2026-09-13T11:00:00+09:00", "2026-09-13T11:00:00+09:00"
				),
				new SubmissionEntry(
					archived.id(), "text", "정규화된 답변", null,
					"2026-09-13T11:30:00+09:00", "2026-09-13T11:30:00+09:00"
				)
			),
			"오늘의 회고", "submission-commit-1", "submit: legacy"
		);
		WorkspaceState state = new WorkspaceState(
			workspaceId, "전환 Workspace", projectId, "group/" + workspaceId, "main", "", 2, "COMPATIBLE",
			"ACTIVE", "2026-09-13T12:05:00+09:00", List.of(member), Map.of(session.date(), session),
			Map.of(session.folder() + "/" + member.id(), submission),
			new WorkspaceSettings("Asia/Seoul", true, new Notifications(true, true, true))
		);
		stateRepository.saveAndFlush(WorkspaceStateEntity.create(state, objectMapper, null));
		return state;
	}
}
