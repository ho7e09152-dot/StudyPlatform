package com.studyworkspace.workspace.infrastructure;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "in_app_notifications")
public class InAppNotificationEntity {
	@Id
	@Column(length = 36)
	private String id;
	@Column(name = "recipient_gitlab_user_id", nullable = false)
	private long recipientGitLabUserId;
	@Column(name = "workspace_id", length = 64)
	private String workspaceId;
	@Column(name = "notification_type", nullable = false, length = 100)
	private String type;
	@Column(nullable = false)
	private String title;
	@Column(nullable = false, length = 2000)
	private String message;
	@Column(name = "action_path", length = 1024)
	private String actionPath;
	@Column(name = "read_at")
	private Instant readAt;
	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	protected InAppNotificationEntity() { }

	public static InAppNotificationEntity create(long recipientGitLabUserId, String workspaceId, String type, String title, String message, String actionPath) {
		InAppNotificationEntity notification = new InAppNotificationEntity();
		notification.id = UUID.randomUUID().toString();
		notification.recipientGitLabUserId = recipientGitLabUserId;
		notification.workspaceId = workspaceId;
		notification.type = type;
		notification.title = title;
		String safeMessage = message == null ? "" : message;
		notification.message = safeMessage.substring(0, Math.min(safeMessage.length(), 2000));
		notification.actionPath = actionPath;
		notification.createdAt = Instant.now();
		return notification;
	}

	public void markRead() { if (readAt == null) readAt = Instant.now(); }
	public String id() { return id; }
	public long recipientGitLabUserId() { return recipientGitLabUserId; }
	public String workspaceId() { return workspaceId; }
	public String type() { return type; }
	public String title() { return title; }
	public String message() { return message; }
	public String actionPath() { return actionPath; }
	public Instant readAt() { return readAt; }
	public Instant createdAt() { return createdAt; }
}
