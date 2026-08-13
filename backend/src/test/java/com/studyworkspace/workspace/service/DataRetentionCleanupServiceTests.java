package com.studyworkspace.workspace.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;

import com.studyworkspace.workspace.infrastructure.AuditEventEntity;
import com.studyworkspace.workspace.infrastructure.AuditEventRepository;
import com.studyworkspace.workspace.infrastructure.InAppNotificationEntity;
import com.studyworkspace.workspace.infrastructure.InAppNotificationRepository;
import com.studyworkspace.workspace.infrastructure.SyncJobEntity;
import com.studyworkspace.workspace.infrastructure.SyncJobRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional
class DataRetentionCleanupServiceTests {
	@Autowired private DataRetentionCleanupService cleanupService;
	@Autowired private InAppNotificationRepository notificationRepository;
	@Autowired private SyncJobRepository syncJobRepository;
	@Autowired private AuditEventRepository auditEventRepository;
	@Autowired private JdbcClient jdbcClient;
	@Autowired private EntityManager entityManager;

	@Test
	void deletesOnlyRecordsOlderThanEachProductRetentionPeriod() {
		Instant now = Instant.parse("2026-08-13T00:00:00Z");
		insertWorkspace(now);

		InAppNotificationEntity notification89 = notificationRepository.saveAndFlush(
			InAppNotificationEntity.create(101, null, "TEST", "유지", "89일", null));
		InAppNotificationEntity notification91 = notificationRepository.saveAndFlush(
			InAppNotificationEntity.create(101, null, "TEST", "삭제", "91일", null));
		SyncJobEntity sync29 = syncJobRepository.saveAndFlush(SyncJobEntity.start("retention-workspace", "TEST"));
		SyncJobEntity sync31 = syncJobRepository.saveAndFlush(SyncJobEntity.start("retention-workspace", "TEST"));
		AuditEventEntity audit179 = auditEventRepository.saveAndFlush(
			AuditEventEntity.create(null, null, "TEST", null, null, "{}"));
		AuditEventEntity audit181 = auditEventRepository.saveAndFlush(
			AuditEventEntity.create(null, null, "TEST", null, null, "{}"));

		setInstant("in_app_notifications", "created_at", notification89.id(), now.minusSeconds(89L * 86_400));
		setInstant("in_app_notifications", "created_at", notification91.id(), now.minusSeconds(91L * 86_400));
		setInstant("sync_jobs", "started_at", sync29.id(), now.minusSeconds(29L * 86_400));
		setInstant("sync_jobs", "started_at", sync31.id(), now.minusSeconds(31L * 86_400));
		setInstant("audit_events", "created_at", audit179.id(), now.minusSeconds(179L * 86_400));
		setInstant("audit_events", "created_at", audit181.id(), now.minusSeconds(181L * 86_400));
		entityManager.clear();

		var result = cleanupService.cleanupExpiredData(now);

		assertThat(result.notifications()).isEqualTo(1);
		assertThat(result.syncJobs()).isEqualTo(1);
		assertThat(result.auditEvents()).isEqualTo(1);
		assertThat(notificationRepository.existsById(notification89.id())).isTrue();
		assertThat(notificationRepository.existsById(notification91.id())).isFalse();
		assertThat(syncJobRepository.existsById(sync29.id())).isTrue();
		assertThat(syncJobRepository.existsById(sync31.id())).isFalse();
		assertThat(auditEventRepository.existsById(audit179.id())).isTrue();
		assertThat(auditEventRepository.existsById(audit181.id())).isFalse();
	}

	private void setInstant(String table, String column, String id, Instant value) {
		jdbcClient.sql("UPDATE " + table + " SET " + column + " = :value WHERE id = :id")
			.param("value", value)
			.param("id", id)
			.update();
	}

	private void insertWorkspace(Instant now) {
		jdbcClient.sql("""
			INSERT INTO workspace_metadata (
				id, name, gitlab_project_id, gitlab_project_path, default_branch, timezone, status,
				created_at, updated_at, state_json, repository_base_path, repository_schema_version,
				import_mode, entity_version
			) VALUES (
				'retention-workspace', 'Retention', 999991, 'test/retention', 'main', 'Asia/Seoul', 'ACTIVE',
				:now, :now, '{}', '', 2, 'NEW', 0
			)
			""").param("now", now).update();
	}
}
