package com.studyworkspace.workspace.infrastructure;

import java.time.Instant;

import com.studyworkspace.workspace.domain.WorkspaceModels.WorkspaceState;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import tools.jackson.databind.ObjectMapper;

@Entity
@Table(name = "workspace_metadata")
public class WorkspaceStateEntity {
	@Id
	@Column(length = 64)
	private String id;

	@Column(nullable = false, length = 120)
	private String name;

	@Column(name = "gitlab_project_id", nullable = false, unique = true)
	private long gitLabProjectId;

	@Column(name = "gitlab_project_path", nullable = false, length = 1024)
	private String gitLabProjectPath;

	@Column(name = "default_branch", nullable = false)
	private String defaultBranch;

	@Column(name = "repository_base_path", nullable = false, length = 255)
	private String repositoryBasePath;

	@Column(name = "repository_schema_version", nullable = false)
	private int repositorySchemaVersion;

	@Column(name = "import_mode", nullable = false, length = 32)
	private String importMode;

	@Column(nullable = false, length = 100)
	private String timezone;

	@Column(nullable = false, length = 32)
	private String status;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	@Column(name = "deleted_at")
	private Instant deletedAt;

	@Column(name = "deletion_expires_at")
	private Instant deletionExpiresAt;

	@Column(name = "last_synced_at")
	private Instant lastSyncedAt;

	@Column(name = "state_json", nullable = false, columnDefinition = "TEXT")
	private String stateJson;

	@Version
	@Column(name = "entity_version", nullable = false)
	private Long entityVersion;

	protected WorkspaceStateEntity() {
	}

	public static WorkspaceStateEntity create(WorkspaceState state, ObjectMapper objectMapper, WorkspaceStateEntity previous) {
		try {
			WorkspaceStateEntity entity = new WorkspaceStateEntity();
			Instant now = Instant.now();
			entity.id = state.id();
			entity.name = state.name();
			entity.gitLabProjectId = state.gitlabProjectId();
			entity.gitLabProjectPath = state.gitlabProjectPath();
			entity.defaultBranch = state.defaultBranch();
			entity.repositoryBasePath = state.repositoryBasePath() == null ? "" : state.repositoryBasePath();
			entity.repositorySchemaVersion = state.repositorySchemaVersion() == null || state.repositorySchemaVersion() < 1 ? 1 : state.repositorySchemaVersion();
			entity.importMode = state.importMode() == null ? "COMPATIBLE" : state.importMode();
			entity.timezone = state.settings().timezone();
			entity.status = state.status();
			entity.createdAt = previous == null ? now : previous.createdAt;
			entity.entityVersion = previous == null ? null : previous.entityVersion;
			entity.updatedAt = now;
			entity.deletedAt = "SOFT_DELETED".equals(state.status())
				? previous != null && previous.deletedAt != null ? previous.deletedAt : now
				: null;
			entity.deletionExpiresAt = entity.deletedAt == null ? null : entity.deletedAt.plusSeconds(7 * 24 * 60 * 60L);
			entity.lastSyncedAt = parseInstant(state.lastSyncedAt());
			entity.stateJson = objectMapper.writeValueAsString(state);
			return entity;
		} catch (Exception exception) {
			throw new IllegalStateException("Workspace 상태를 DB 형식으로 변환하지 못했습니다.", exception);
		}
	}

	public WorkspaceState toState(ObjectMapper objectMapper) {
		try {
			return objectMapper.readValue(stateJson, WorkspaceState.class);
		} catch (Exception exception) {
			throw new IllegalStateException("DB의 Workspace 상태를 읽지 못했습니다: " + id, exception);
		}
	}

	public String id() {
		return id;
	}

	public Instant deletionExpiresAt() {
		return deletionExpiresAt;
	}

	public Instant deletedAt() {
		return deletedAt;
	}

	public String status() {
		return status;
	}

	private static Instant parseInstant(String value) {
		if (value == null || value.isBlank()) return null;
		return java.time.OffsetDateTime.parse(value).toInstant();
	}
}
