package com.studyworkspace.workspace.infrastructure;

import java.time.Instant;

import com.studyworkspace.workspace.domain.WorkspaceModels.RepositoryIdentity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(name = "repository_connections", uniqueConstraints = @UniqueConstraint(
	name = "uk_repository_provider_external", columnNames = {"provider", "external_repository_id"}
))
public class RepositoryConnectionEntity {
	@Id
	@Column(name = "workspace_id", length = 64)
	private String workspaceId;

	@Column(nullable = false, length = 32)
	private String provider;

	@Column(name = "external_repository_id", nullable = false, length = 255)
	private String externalRepositoryId;

	@Column(name = "full_name", nullable = false, length = 1024)
	private String fullName;

	@Column(name = "web_url", length = 2048)
	private String webUrl;

	@Column(length = 32)
	private String visibility;

	@Column(name = "default_branch")
	private String defaultBranch;

	@Column(name = "can_read", nullable = false)
	private boolean canRead;

	@Column(name = "can_write", nullable = false)
	private boolean canWrite;

	@Column(name = "can_manage", nullable = false)
	private boolean canManage;

	@Column(name = "provider_permission", length = 64)
	private String providerPermission;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	protected RepositoryConnectionEntity() { }

	public static RepositoryConnectionEntity from(String workspaceId, RepositoryIdentity repository,
		RepositoryConnectionEntity previous) {
		RepositoryConnectionEntity entity = new RepositoryConnectionEntity();
		entity.workspaceId = workspaceId;
		entity.provider = repository.provider();
		entity.externalRepositoryId = repository.externalRepositoryId();
		entity.fullName = repository.fullName();
		entity.webUrl = repository.webUrl();
		entity.visibility = repository.visibility();
		entity.defaultBranch = repository.defaultBranch();
		entity.canRead = repository.canRead();
		entity.canWrite = repository.canWrite();
		entity.canManage = repository.canManage();
		entity.providerPermission = repository.providerPermission();
		entity.createdAt = previous == null ? Instant.now() : previous.createdAt;
		entity.updatedAt = Instant.now();
		return entity;
	}

	public String workspaceId() { return workspaceId; }
	public String provider() { return provider; }
	public String externalRepositoryId() { return externalRepositoryId; }
	public RepositoryIdentity toIdentity() {
		return new RepositoryIdentity(provider, externalRepositoryId, fullName, webUrl, visibility,
			defaultBranch, canRead, canWrite, canManage, providerPermission);
	}
}
