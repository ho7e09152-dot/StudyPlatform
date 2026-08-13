package com.studyworkspace.auth.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDate;

import com.studyworkspace.auth.dto.GitLabOAuthSession;
import com.studyworkspace.auth.persistence.UserAccountRepository;
import com.studyworkspace.gitlab.dto.GitLabUser;
import com.studyworkspace.provider.ProviderIdentity;
import com.studyworkspace.provider.ProviderOAuthCredential;
import com.studyworkspace.workspace.domain.RepositoryProvider;
import com.studyworkspace.workspace.infrastructure.AuditEventEntity;
import com.studyworkspace.workspace.infrastructure.AuditEventRepository;
import com.studyworkspace.workspace.infrastructure.InAppNotificationEntity;
import com.studyworkspace.workspace.infrastructure.InAppNotificationRepository;
import com.studyworkspace.workspace.infrastructure.WorkspaceAnnouncementEntity;
import com.studyworkspace.workspace.infrastructure.WorkspaceAnnouncementRepository;
import com.studyworkspace.workspace.infrastructure.WorkspaceDocumentEntity;
import com.studyworkspace.workspace.infrastructure.WorkspaceDocumentRepository;
import com.studyworkspace.workspace.infrastructure.WorkspaceMessageEntity;
import com.studyworkspace.workspace.infrastructure.WorkspaceMessageRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional
class AccountDeletionServiceTests {
	@Autowired private OAuthAccountService accountService;
	@Autowired private ProviderAccountLinkingService linkingService;
	@Autowired private AccountDeletionService deletionService;
	@Autowired private UserAccountRepository userRepository;
	@Autowired private InAppNotificationRepository notificationRepository;
	@Autowired private WorkspaceAnnouncementRepository announcementRepository;
	@Autowired private WorkspaceMessageRepository messageRepository;
	@Autowired private WorkspaceDocumentRepository documentRepository;
	@Autowired private AuditEventRepository auditEventRepository;
	@Autowired private JdbcClient jdbcClient;
	@Autowired private EntityManager entityManager;

	@Test
	void removesPersonalDataAndCredentialsWhileAnonymizingSharedAttribution() {
		long gitLabUserId = 7654321L;
		Instant now = Instant.parse("2026-08-13T00:00:00Z");
		accountService.upsert(new GitLabOAuthSession(
			new GitLabUser(gitLabUserId, "delete-me", "삭제 전 이름", "https://example/avatar", "https://example/user"),
			"access-secret", "refresh-secret", now.plusSeconds(3600), "api"
		));
		entityManager.flush();
		String userId = jdbcClient.sql("SELECT id FROM user_accounts WHERE gitlab_user_id = :gitLabUserId")
			.param("gitLabUserId", gitLabUserId).query(String.class).single();
		linkingService.link(userId,
			new ProviderIdentity(RepositoryProvider.GITHUB, "998877", "delete-github", "Delete GitHub", null, null),
			new ProviderOAuthCredential("github-access-secret", null, null, "read:user"));
		entityManager.flush();
		assertThat(jdbcClient.sql("SELECT COUNT(*) FROM provider_accounts WHERE user_id = :userId")
			.param("userId", userId).query(Long.class).single()).isEqualTo(2);
		insertWorkspace(now);

		var notification = notificationRepository.saveAndFlush(
			InAppNotificationEntity.create(gitLabUserId, "delete-workspace", "TEST", "개인 알림", "삭제 대상", null));
		var announcement = announcementRepository.saveAndFlush(WorkspaceAnnouncementEntity.create(
			"delete-workspace", userId, "삭제 전 이름", "공지", "공동 콘텐츠", false, now, null));
		var message = messageRepository.saveAndFlush(WorkspaceMessageEntity.create(
			"delete-workspace", userId, "삭제 전 이름", LocalDate.parse("2026-08-13"), "공동 메시지"));
		var document = documentRepository.saveAndFlush(WorkspaceDocumentEntity.create(
			"delete-workspace", userId, "삭제 전 이름", "공동 문서", "본문"));
		var audit = auditEventRepository.saveAndFlush(AuditEventEntity.create(
			"delete-workspace", userId, "TEST", "USER", Long.toString(gitLabUserId), "{}"));

		deletionService.delete(gitLabUserId);
		entityManager.flush();
		entityManager.clear();

		assertThat(userRepository.findByGitLabUserId(gitLabUserId)).isEmpty();
		assertThat(accountService.findOAuthSession(gitLabUserId)).isEmpty();
		assertThat(jdbcClient.sql("SELECT COUNT(*) FROM provider_accounts WHERE user_id = :userId")
			.param("userId", userId).query(Long.class).single()).isZero();
		assertThat(jdbcClient.sql("SELECT COUNT(*) FROM oauth_credentials c JOIN provider_accounts p ON p.id = c.provider_account_id WHERE p.user_id = :userId")
			.param("userId", userId).query(Long.class).single()).isZero();
		assertThat(notificationRepository.existsById(notification.id())).isFalse();
		assertThat(announcementRepository.findById(announcement.id()).orElseThrow().authorUserId()).isNull();
		assertThat(announcementRepository.findById(announcement.id()).orElseThrow().authorDisplayName()).isEqualTo("탈퇴한 사용자");
		assertThat(messageRepository.findById(message.id()).orElseThrow().authorDisplayName()).isEqualTo("탈퇴한 사용자");
		assertThat(documentRepository.findById(document.id()).orElseThrow().authorDisplayName()).isEqualTo("탈퇴한 사용자");
		assertThat(auditEventRepository.findById(audit.id()).orElseThrow().actorUserId()).isNull();
		assertThat(auditEventRepository.findById(audit.id()).orElseThrow().targetId()).isEqualTo("deleted-user");
	}

	private void insertWorkspace(Instant now) {
		jdbcClient.sql("""
			INSERT INTO workspace_metadata (
				id, name, gitlab_project_id, gitlab_project_path, default_branch, timezone, status,
				created_at, updated_at, state_json, repository_base_path, repository_schema_version,
				import_mode, entity_version
			) VALUES (
				'delete-workspace', 'Delete', 999992, 'test/delete', 'main', 'Asia/Seoul', 'ACTIVE',
				:now, :now, :stateJson, '', 2, 'NEW', 0
			)
			""")
			.param("now", now)
			.param("stateJson", """
				{"id":"delete-workspace","name":"Delete","gitlabProjectId":999992,"gitlabProjectPath":"test/delete","defaultBranch":"main","repositoryBasePath":"","repositorySchemaVersion":2,"importMode":"NEW","status":"ACTIVE","lastSyncedAt":null,"members":[],"sessions":{},"submissions":{},"settings":{"timezone":"Asia/Seoul","requireChangeNoteWhenSubmitted":true,"notifications":{"scheduleChanges":true,"submissionMismatch":true,"syncFailures":true}}}
				""")
			.update();
	}
}
