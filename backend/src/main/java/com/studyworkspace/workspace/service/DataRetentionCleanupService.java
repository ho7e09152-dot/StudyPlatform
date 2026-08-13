package com.studyworkspace.workspace.service;

import static com.studyworkspace.policy.DataRetentionPolicy.AUDIT_EVENTS;
import static com.studyworkspace.policy.DataRetentionPolicy.NOTIFICATIONS;
import static com.studyworkspace.policy.DataRetentionPolicy.SYNC_JOBS;

import java.time.Instant;

import com.studyworkspace.workspace.infrastructure.AuditEventRepository;
import com.studyworkspace.workspace.infrastructure.InAppNotificationRepository;
import com.studyworkspace.workspace.infrastructure.SyncJobRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DataRetentionCleanupService {
	private static final Logger log = LoggerFactory.getLogger(DataRetentionCleanupService.class);

	private final InAppNotificationRepository notificationRepository;
	private final SyncJobRepository syncJobRepository;
	private final AuditEventRepository auditEventRepository;

	public DataRetentionCleanupService(
		InAppNotificationRepository notificationRepository,
		SyncJobRepository syncJobRepository,
		AuditEventRepository auditEventRepository
	) {
		this.notificationRepository = notificationRepository;
		this.syncJobRepository = syncJobRepository;
		this.auditEventRepository = auditEventRepository;
	}

	@Scheduled(cron = "0 27 3 * * *")
	@Transactional
	public void cleanupExpiredData() {
		CleanupResult result = cleanupExpiredData(Instant.now());
		if (result.totalDeleted() > 0) {
			log.info(
				"Retention cleanup completed: notifications={}, syncJobs={}, auditEvents={}",
				result.notifications(), result.syncJobs(), result.auditEvents()
			);
		}
	}

	@Transactional
	public CleanupResult cleanupExpiredData(Instant now) {
		int notifications = notificationRepository.deleteExpired(now.minus(NOTIFICATIONS));
		int syncJobs = syncJobRepository.deleteExpired(now.minus(SYNC_JOBS));
		int auditEvents = auditEventRepository.deleteExpired(now.minus(AUDIT_EVENTS));
		return new CleanupResult(notifications, syncJobs, auditEvents);
	}

	public record CleanupResult(int notifications, int syncJobs, int auditEvents) {
		public int totalDeleted() {
			return notifications + syncJobs + auditEvents;
		}
	}
}
