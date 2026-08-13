package com.studyworkspace.policy;

import java.time.Duration;

/**
 * Product retention defaults for the current free, non-commercial Study-ing service.
 * These durations are operational choices, not statutory retention periods.
 */
public final class DataRetentionPolicy {
	public static final Duration NOTIFICATIONS = Duration.ofDays(90);
	public static final Duration SYNC_JOBS = Duration.ofDays(30);
	public static final Duration AUDIT_EVENTS = Duration.ofDays(180);
	public static final Duration WORKSPACE_SOFT_DELETE = Duration.ofDays(7);
	public static final Duration BACKUP_ROTATION_TARGET = Duration.ofDays(7);
	public static final Duration APPLICATION_LOG_TARGET = Duration.ofDays(30);

	private DataRetentionPolicy() {
	}
}
