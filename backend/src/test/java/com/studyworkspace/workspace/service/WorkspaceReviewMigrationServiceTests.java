package com.studyworkspace.workspace.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

import com.studyworkspace.workspace.domain.RepositoryProvider;
import com.studyworkspace.workspace.domain.WorkspaceModels.MemberSubmissionFile;
import com.studyworkspace.workspace.domain.WorkspaceModels.Notifications;
import com.studyworkspace.workspace.domain.WorkspaceModels.SessionItem;
import com.studyworkspace.workspace.domain.WorkspaceModels.StudyMember;
import com.studyworkspace.workspace.domain.WorkspaceModels.StudySession;
import com.studyworkspace.workspace.domain.WorkspaceModels.SubmissionEntry;
import com.studyworkspace.workspace.domain.WorkspaceModels.WorkspaceSettings;
import com.studyworkspace.workspace.domain.WorkspaceModels.WorkspaceState;
import com.studyworkspace.workspace.infrastructure.WorkspaceStateEntity;
import com.studyworkspace.workspace.infrastructure.WorkspaceStateRepository;
import com.studyworkspace.workspace.port.RepositoryDataPort;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest
@Transactional
class WorkspaceReviewMigrationServiceTests {
	@Autowired private WorkspaceContentMigrationService contentMigrationService;
	@Autowired private WorkspaceStateRepository stateRepository;
	@Autowired private NamedParameterJdbcTemplate namedJdbcTemplate;
	@Autowired private JdbcClient jdbcClient;
	@Autowired private ObjectMapper objectMapper;
	@Autowired private PlatformTransactionManager transactionManager;

	@Test
	void importsCommitCommentsIntoSubmissionThreadIdempotently() {
		WorkspaceState workspace = insertSourceWorkspace();
		contentMigrationService.stageLegacySnapshot(workspace.id());
		RepositoryDataPort port = mock(RepositoryDataPort.class);
		when(port.provider()).thenReturn(RepositoryProvider.GITLAB);
		when(port.listCommitComments(eq("token"), any(), eq("review-commit-1"))).thenReturn(List.of(
			new RepositoryDataPort.CommitComment(
				"comment-1", "좋은 풀이입니다.", "9901", "reviewer", "리뷰어", "https://example.test/reviewer.png",
				"2026-09-13T13:00:00+09:00"
			),
			new RepositoryDataPort.CommitComment(
				"comment-2", "다음 풀이도 확인해 주세요.", "9999", "outside", "외부 리뷰어", null,
				"2026-09-13T13:30:00+09:00"
			)
		));
		WorkspaceReviewMigrationService service = new WorkspaceReviewMigrationService(
			new RepositoryDataService(List.of(port)), stateRepository, namedJdbcTemplate, objectMapper, transactionManager
		);

		var first = service.importLegacyReviews("token", workspace.id());
		contentMigrationService.stageLegacySnapshot(workspace.id());
		assertThat(jdbcClient.sql("""
			SELECT COUNT(*) FROM workspace_submission_reviews WHERE workspace_id = :workspaceId
			""").param("workspaceId", workspace.id()).query(Long.class).single()).isEqualTo(2);
		assertThat(jdbcClient.sql("""
			SELECT COUNT(*) FROM workspace_content_migration_reports
			WHERE workspace_id = :workspaceId AND review_count IS NULL
				AND review_fingerprint IS NULL AND reviews_pending = TRUE
			""").param("workspaceId", workspace.id()).query(Long.class).single()).isEqualTo(1);
		var second = service.importLegacyReviews("token", workspace.id());

		assertThat(first.reviewCount()).isEqualTo(2);
		assertThat(first.sourceFingerprint()).isEqualTo(first.databaseFingerprint());
		assertThat(second.sourceFingerprint()).isEqualTo(first.sourceFingerprint());
		assertThat(second.reviewsPending()).isFalse();
		assertThat(jdbcClient.sql("""
			SELECT COUNT(*) FROM workspace_submission_reviews WHERE workspace_id = :workspaceId
			""").param("workspaceId", workspace.id()).query(Long.class).single()).isEqualTo(2);
		assertThat(jdbcClient.sql("""
			SELECT author_user_id FROM workspace_submission_reviews WHERE provider_comment_id = 'comment-1'
			""").query(String.class).single()).isEqualTo("user-review-migration");
		assertThat(jdbcClient.sql("""
			SELECT COUNT(*) FROM workspace_submission_reviews
			WHERE provider_comment_id = 'comment-1' AND author_username = 'reviewer'
				AND author_provider_external_id = '9901'
				AND author_avatar_url = 'https://example.test/reviewer.png'
			""").query(Long.class).single()).isEqualTo(1);
		assertThat(jdbcClient.sql("""
			SELECT COUNT(*) FROM workspace_submission_reviews
			WHERE provider_comment_id = 'comment-2' AND author_user_id IS NULL
				AND author_name = '외부 사용자' AND author_username IS NULL
				AND author_provider_external_id IS NULL AND author_avatar_url IS NULL
			""").query(Long.class).single()).isEqualTo(1);
		assertThat(jdbcClient.sql("""
			SELECT COUNT(*) FROM workspace_content_migration_reports
			WHERE workspace_id = :workspaceId AND review_count = 2
				AND review_fingerprint IS NOT NULL AND reviews_pending = FALSE
			""").param("workspaceId", workspace.id()).query(Long.class).single()).isEqualTo(1);
	}

	private WorkspaceState insertSourceWorkspace() {
		OffsetDateTime now = OffsetDateTime.parse("2026-09-13T09:00:00+09:00");
		jdbcClient.sql("""
			INSERT INTO user_accounts (id, gitlab_user_id, username, display_name, created_at, updated_at)
			VALUES ('user-review-migration', 9901, 'reviewer', '리뷰어', :now, :now)
			""").param("now", now).update();
		jdbcClient.sql("""
			INSERT INTO provider_accounts (
				id, user_id, provider, external_user_id, username, display_name, status, created_at, updated_at
			) VALUES (
				'provider-review-migration', 'user-review-migration', 'GITLAB', '9901',
				'reviewer', '리뷰어', 'CONNECTED', :now, :now
			)
			""").param("now", now).update();
		StudyMember member = new StudyMember(
			"member-review", 9901, "reviewer", "리뷰어", "리", "#6d52b5", "reviewer.md",
			"OWNER", "ACTIVE", 40, "user-review-migration"
		);
		SessionItem item = new SessionItem(
			"item-review", 1, "리뷰 항목", "algorithm", "BOJ", "https://example.test/problem",
			"text", true, "active", null, null
		);
		StudySession session = new StudySession(
			"2026-09-13", "260913", 1, "algorithm", "리뷰 일정", null, "active",
			"2026-09-13T23:59:00+09:00", null,
			"2026-09-13T09:00:00+09:00", "reviewer",
			"2026-09-13T09:00:00+09:00", "reviewer", null, List.of(item), List.of(), "session-review-1"
		);
		MemberSubmissionFile submission = new MemberSubmissionFile(
			1, member.id(), member.gitlabUserId(), member.displayName(), session.folder(), 1, session.type(),
			"2026-09-13T12:00:00+09:00",
			List.of(new SubmissionEntry(
				item.id(), "text", "리뷰 대상", null,
				"2026-09-13T11:00:00+09:00", "2026-09-13T11:00:00+09:00"
			)), null, "review-commit-1", "submit: review"
		);
		WorkspaceState workspace = new WorkspaceState(
			"workspace-review-migration", "리뷰 전환", 99001, "group/review", "main", "", 2, "COMPATIBLE",
			"ACTIVE", "2026-09-13T12:05:00+09:00", List.of(member), Map.of(session.date(), session),
			Map.of(session.folder() + "/" + member.id(), submission),
			new WorkspaceSettings("Asia/Seoul", true, new Notifications(true, true, true))
		);
		stateRepository.saveAndFlush(WorkspaceStateEntity.create(workspace, objectMapper, null));
		return workspace;
	}
}
