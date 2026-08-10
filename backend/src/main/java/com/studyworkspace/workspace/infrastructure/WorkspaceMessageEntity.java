package com.studyworkspace.workspace.infrastructure;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "workspace_messages")
public class WorkspaceMessageEntity {
	@Id
	@Column(length = 36)
	private String id;
	@Column(name = "workspace_id", nullable = false, length = 64)
	private String workspaceId;
	@Column(name = "author_user_id", length = 36)
	private String authorUserId;
	@Column(name = "author_display_name", nullable = false)
	private String authorDisplayName;
	@Column(name = "context_date", nullable = false)
	private LocalDate contextDate;
	@Column(nullable = false, length = 4000)
	private String body;
	@Column(name = "created_at", nullable = false)
	private Instant createdAt;
	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;
	@Column(name = "deleted_at")
	private Instant deletedAt;

	protected WorkspaceMessageEntity() { }

	public static WorkspaceMessageEntity create(String workspaceId, String authorUserId, String authorDisplayName, LocalDate contextDate, String body) {
		WorkspaceMessageEntity entity = new WorkspaceMessageEntity();
		entity.id = UUID.randomUUID().toString();
		entity.workspaceId = workspaceId;
		entity.authorUserId = authorUserId;
		entity.authorDisplayName = authorDisplayName;
		entity.contextDate = contextDate;
		entity.body = body;
		entity.createdAt = Instant.now();
		entity.updatedAt = entity.createdAt;
		return entity;
	}

	public void updateBody(String body) { this.body = body; this.updatedAt = Instant.now(); }
	public void softDelete() { if (deletedAt == null) { deletedAt = Instant.now(); updatedAt = deletedAt; } }
	public String id() { return id; }
	public String workspaceId() { return workspaceId; }
	public String authorUserId() { return authorUserId; }
	public String authorDisplayName() { return authorDisplayName; }
	public LocalDate contextDate() { return contextDate; }
	public String body() { return body; }
	public Instant createdAt() { return createdAt; }
	public Instant updatedAt() { return updatedAt; }
	public Instant deletedAt() { return deletedAt; }
}
