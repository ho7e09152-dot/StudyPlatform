package com.studyworkspace.workspace.infrastructure;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "audit_events")
public class AuditEventEntity {
	@Id
	@Column(length = 36)
	private String id;
	@Column(name = "workspace_id", length = 64)
	private String workspaceId;
	@Column(name = "actor_user_id", length = 36)
	private String actorUserId;
	@Column(name = "event_type", nullable = false, length = 100)
	private String eventType;
	@Column(name = "target_type", length = 100)
	private String targetType;
	@Column(name = "target_id")
	private String targetId;
	@Column(name = "details_json", nullable = false, columnDefinition = "TEXT")
	private String detailsJson;
	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	protected AuditEventEntity() { }

	public static AuditEventEntity create(String workspaceId, String actorUserId, String eventType, String targetType, String targetId, String detailsJson) {
		AuditEventEntity event = new AuditEventEntity();
		event.id = UUID.randomUUID().toString();
		event.workspaceId = workspaceId;
		event.actorUserId = actorUserId;
		event.eventType = eventType;
		event.targetType = targetType;
		event.targetId = targetId;
		event.detailsJson = detailsJson;
		event.createdAt = Instant.now();
		return event;
	}

	public String id() { return id; }
	public String workspaceId() { return workspaceId; }
	public String actorUserId() { return actorUserId; }
	public String eventType() { return eventType; }
	public String targetType() { return targetType; }
	public String targetId() { return targetId; }
	public String detailsJson() { return detailsJson; }
	public Instant createdAt() { return createdAt; }
}

