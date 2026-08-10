package com.studyworkspace.workspace.infrastructure;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

@Entity
@Table(name = "workspace_documents")
public class WorkspaceDocumentEntity {
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
	@Column(name = "body_markdown", nullable = false, columnDefinition = "TEXT")
	private String bodyMarkdown;
	@Version
	@Column(nullable = false)
	private int version;
	@Column(name = "created_at", nullable = false)
	private Instant createdAt;
	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;
	@Column(name = "deleted_at")
	private Instant deletedAt;

	protected WorkspaceDocumentEntity() { }

	public static WorkspaceDocumentEntity create(String workspaceId, String authorUserId, String authorDisplayName, String title, String bodyMarkdown) {
		WorkspaceDocumentEntity entity = new WorkspaceDocumentEntity();
		entity.id = UUID.randomUUID().toString();
		entity.workspaceId = workspaceId;
		entity.authorUserId = authorUserId;
		entity.authorDisplayName = authorDisplayName;
		entity.title = title;
		entity.bodyMarkdown = bodyMarkdown;
		entity.createdAt = Instant.now();
		entity.updatedAt = entity.createdAt;
		return entity;
	}

	public void update(String title, String bodyMarkdown) { this.title = title; this.bodyMarkdown = bodyMarkdown; this.updatedAt = Instant.now(); }
	public void softDelete() { if (deletedAt == null) { deletedAt = Instant.now(); updatedAt = deletedAt; } }
	public String id() { return id; }
	public String workspaceId() { return workspaceId; }
	public String authorUserId() { return authorUserId; }
	public String authorDisplayName() { return authorDisplayName; }
	public String title() { return title; }
	public String bodyMarkdown() { return bodyMarkdown; }
	public int version() { return version; }
	public Instant createdAt() { return createdAt; }
	public Instant updatedAt() { return updatedAt; }
	public Instant deletedAt() { return deletedAt; }
}
