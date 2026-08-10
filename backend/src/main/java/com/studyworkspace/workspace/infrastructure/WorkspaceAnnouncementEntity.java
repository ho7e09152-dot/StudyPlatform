package com.studyworkspace.workspace.infrastructure;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "workspace_announcements")
public class WorkspaceAnnouncementEntity {
	@Id
	@Column(length = 36)
	private String id;
	@Column(name = "workspace_id", nullable = false, length = 64)
	private String workspaceId;
	@Column(name = "author_user_id", length = 36)
	private String authorUserId;
	@Column(name = "author_display_name", nullable = false)
	private String authorDisplayName;
	@Column(nullable = false, length = 120)
	private String title;
	@Column(nullable = false, columnDefinition = "TEXT")
	private String body;
	@Column(name = "is_pinned", nullable = false)
	private boolean pinned;
	@Column(name = "published_at", nullable = false)
	private Instant publishedAt;
	@Column(name = "expires_at")
	private Instant expiresAt;
	@Column(name = "created_at", nullable = false)
	private Instant createdAt;
	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;
	@Column(name = "archived_at")
	private Instant archivedAt;

	protected WorkspaceAnnouncementEntity() { }

	public static WorkspaceAnnouncementEntity create(String workspaceId, String authorUserId, String authorDisplayName, String title, String body, boolean pinned, Instant publishedAt, Instant expiresAt) {
		WorkspaceAnnouncementEntity entity = new WorkspaceAnnouncementEntity();
		entity.id = UUID.randomUUID().toString();
		entity.workspaceId = workspaceId;
		entity.authorUserId = authorUserId;
		entity.authorDisplayName = authorDisplayName;
		entity.title = title;
		entity.body = body;
		entity.pinned = pinned;
		entity.publishedAt = publishedAt;
		entity.expiresAt = expiresAt;
		entity.createdAt = Instant.now();
		entity.updatedAt = entity.createdAt;
		return entity;
	}

	public void update(String title, String body, boolean pinned, Instant publishedAt, Instant expiresAt) {
		this.title = title;
		this.body = body;
		this.pinned = pinned;
		this.publishedAt = publishedAt;
		this.expiresAt = expiresAt;
		this.updatedAt = Instant.now();
	}

	public void archive() { if (archivedAt == null) { archivedAt = Instant.now(); updatedAt = archivedAt; } }
	public String id() { return id; }
	public String workspaceId() { return workspaceId; }
	public String authorUserId() { return authorUserId; }
	public String authorDisplayName() { return authorDisplayName; }
	public String title() { return title; }
	public String body() { return body; }
	public boolean pinned() { return pinned; }
	public Instant publishedAt() { return publishedAt; }
	public Instant expiresAt() { return expiresAt; }
	public Instant createdAt() { return createdAt; }
	public Instant updatedAt() { return updatedAt; }
	public Instant archivedAt() { return archivedAt; }
}
