package com.studyworkspace.workspace.infrastructure;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "sync_jobs")
public class SyncJobEntity {
	@Id
	@Column(length = 36)
	private String id;
	@Column(name = "workspace_id", nullable = false, length = 64)
	private String workspaceId;
	@Column(nullable = false, length = 32)
	private String status;
	@Column(name = "job_type", nullable = false, length = 64)
	private String jobType;
	@Column(name = "error_code")
	private String errorCode;
	@Column(name = "error_message", length = 2000)
	private String errorMessage;
	@Column(name = "started_at", nullable = false)
	private Instant startedAt;
	@Column(name = "completed_at")
	private Instant completedAt;

	protected SyncJobEntity() { }

	public static SyncJobEntity start(String workspaceId, String jobType) {
		SyncJobEntity job = new SyncJobEntity();
		job.id = UUID.randomUUID().toString();
		job.workspaceId = workspaceId;
		job.status = "RUNNING";
		job.jobType = jobType;
		job.startedAt = Instant.now();
		return job;
	}

	public void complete(boolean partial) {
		status = partial ? "PARTIAL" : "SUCCESS";
		completedAt = Instant.now();
	}

	public void fail(String code, String message) {
		status = "FAILED";
		errorCode = code;
		errorMessage = message == null ? null : message.substring(0, Math.min(2000, message.length()));
		completedAt = Instant.now();
	}

	public String id() { return id; }
	public String workspaceId() { return workspaceId; }
	public String status() { return status; }
	public String jobType() { return jobType; }
	public String errorCode() { return errorCode; }
	public String errorMessage() { return errorMessage; }
	public Instant startedAt() { return startedAt; }
	public Instant completedAt() { return completedAt; }
}
