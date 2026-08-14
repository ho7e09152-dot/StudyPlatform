package com.studyworkspace.workspace.domain;

import java.util.List;
import java.util.Map;

public final class WorkspaceModels {

	private WorkspaceModels() {
	}

	public record StudyMember(
		String id,
		long gitlabUserId,
		String username,
		String displayName,
		String avatar,
		String color,
		String fileName,
		String role,
		String status,
		int accessLevel,
		String userId
	) {
		public StudyMember(String id, long gitlabUserId, String username, String displayName, String avatar,
			String color, String fileName, String role, String status, int accessLevel) {
			this(id, gitlabUserId, username, displayName, avatar, color, fileName, role, status, accessLevel, null);
		}
	}

	public record SessionItem(
		String id,
		int order,
		String title,
		String type,
		String source,
		String url,
		String submitType,
		boolean required,
		String status,
		String replaces,
		String replacedBy
	) {
		public SessionItem(
			String id, int order, String title, String source, String url, String submitType,
			boolean required, String status, String replaces, String replacedBy
		) {
			this(id, order, title, "algorithm", source, url, submitType, required, status, replaces, replacedBy);
		}
	}

	public record SessionChange(boolean changed, String message, String reason) {
	}

	public record StudySession(
		String date,
		String folder,
		int revision,
		String type,
		String title,
		String description,
		String status,
		String deadline,
		String secondaryDeadline,
		String createdAt,
		String createdBy,
		String updatedAt,
		String updatedBy,
		SessionChange change,
		List<SessionItem> items,
		List<SessionItem> archivedItems,
		String lastCommitId
	) {
	}

	public record SubmissionEntry(
		String itemId,
		String type,
		String value,
		String language,
		String submittedAt,
		String updatedAt
	) {
	}

	public record MemberSubmissionFile(
		int version,
		String memberId,
		long gitlabUserId,
		String username,
		String date,
		int sessionRevision,
		String sessionType,
		String updatedAt,
		List<SubmissionEntry> submissions,
		String reflection,
		String lastCommitId,
		String lastCommitMessage
	) {
	}

	public record Notifications(
		boolean scheduleChanges,
		boolean submissionMismatch,
		boolean syncFailures
	) {
	}

	public record CommitRules(
		String submissionTemplate,
		String submissionGuidance
	) {
		public static final String DEFAULT_SUBMISSION_TEMPLATE = "{action}: {name} · {date} · {item}";
		public static final String DEFAULT_SUBMISSION_GUIDANCE =
			"기본 규칙을 그대로 사용하거나 알아보기 쉽게 수정할 수 있습니다.";

		public CommitRules {
			submissionTemplate = submissionTemplate == null
				? DEFAULT_SUBMISSION_TEMPLATE : submissionTemplate;
			submissionGuidance = submissionGuidance == null
				? DEFAULT_SUBMISSION_GUIDANCE : submissionGuidance;
		}

		public static CommitRules defaults() {
			return new CommitRules(DEFAULT_SUBMISSION_TEMPLATE, DEFAULT_SUBMISSION_GUIDANCE);
		}
	}

	public record WorkspaceSettings(
		String timezone,
		boolean requireChangeNoteWhenSubmitted,
		Notifications notifications,
		CommitRules commitRules
	) {
		public WorkspaceSettings {
			commitRules = commitRules == null ? CommitRules.defaults() : commitRules;
		}

		public WorkspaceSettings(
			String timezone,
			boolean requireChangeNoteWhenSubmitted,
			Notifications notifications
		) {
			this(timezone, requireChangeNoteWhenSubmitted, notifications, CommitRules.defaults());
		}
	}

	public record RepositoryIdentity(
		String provider,
		String externalRepositoryId,
		String fullName,
		String webUrl,
		String visibility,
		String defaultBranch,
		boolean canRead,
		boolean canWrite,
		boolean canManage,
		String providerPermission
	) { }

	public record WorkspaceState(
		String id,
		String name,
		long gitlabProjectId,
		String gitlabProjectPath,
		String defaultBranch,
		String repositoryBasePath,
		Integer repositorySchemaVersion,
		String importMode,
		String status,
		String lastSyncedAt,
		List<StudyMember> members,
		Map<String, StudySession> sessions,
		Map<String, MemberSubmissionFile> submissions,
		WorkspaceSettings settings,
		RepositoryIdentity repository
	) {
		public WorkspaceState(
			String id, String name, long gitlabProjectId, String gitlabProjectPath, String defaultBranch,
			String repositoryBasePath, Integer repositorySchemaVersion, String importMode,
			String status, String lastSyncedAt, List<StudyMember> members, Map<String, StudySession> sessions,
			Map<String, MemberSubmissionFile> submissions, WorkspaceSettings settings
		) {
			this(id, name, gitlabProjectId, gitlabProjectPath, defaultBranch, repositoryBasePath,
				repositorySchemaVersion, importMode, status, lastSyncedAt, members, sessions, submissions, settings,
				gitlabProjectId > 0 ? new RepositoryIdentity("GITLAB", Long.toString(gitlabProjectId), gitlabProjectPath,
					null, null, defaultBranch, true, true, false, null) : null);
		}

		public WorkspaceState(
			String id, String name, long gitlabProjectId, String gitlabProjectPath, String defaultBranch,
			String status, String lastSyncedAt, List<StudyMember> members, Map<String, StudySession> sessions,
			Map<String, MemberSubmissionFile> submissions, WorkspaceSettings settings
		) {
			this(id, name, gitlabProjectId, gitlabProjectPath, defaultBranch, "", 1, "COMPATIBLE",
				status, lastSyncedAt, members, sessions, submissions, settings);
		}
	}

	public record SessionDraft(
		String date,
		String type,
		String title,
		String description,
		String deadline,
		String secondaryDeadline,
		String changeReason,
		List<SessionItem> items,
		Integer expectedRevision
	) {
	}

	public record SubmissionRequest(
		String type,
		String value,
		String language,
		String expectedFileCommitId,
		String commitMessage
	) {
	}

	public record CreateWorkspaceRequest(
		String name,
		long gitlabProjectId,
		String gitlabProjectPath,
		String defaultBranch,
		String timezone,
		String repositoryBasePath,
		Integer repositorySchemaVersion,
		String importMode,
		String expectedTreeFingerprint,
		String ownerRepositoryFileName,
		String repositoryWebUrl,
		String repositoryVisibility,
		String provider,
		String externalRepositoryId
	) {
		public CreateWorkspaceRequest(
			String name, long gitlabProjectId, String gitlabProjectPath, String defaultBranch, String timezone,
			String repositoryBasePath, Integer repositorySchemaVersion, String importMode,
			String expectedTreeFingerprint, String ownerRepositoryFileName
		) {
			this(name, gitlabProjectId, gitlabProjectPath, defaultBranch, timezone, repositoryBasePath,
				repositorySchemaVersion, importMode, expectedTreeFingerprint, ownerRepositoryFileName, null, null, null, null);
		}

		public CreateWorkspaceRequest(
			String name, long gitlabProjectId, String gitlabProjectPath, String defaultBranch, String timezone,
			String repositoryBasePath, Integer repositorySchemaVersion, String importMode,
			String expectedTreeFingerprint, String ownerRepositoryFileName, String repositoryWebUrl,
			String repositoryVisibility
		) {
			this(name, gitlabProjectId, gitlabProjectPath, defaultBranch, timezone, repositoryBasePath,
				repositorySchemaVersion, importMode, expectedTreeFingerprint, ownerRepositoryFileName,
				repositoryWebUrl, repositoryVisibility, null, null);
		}

		public CreateWorkspaceRequest(
			String name, long gitlabProjectId, String gitlabProjectPath, String defaultBranch, String timezone
		) {
			this(name, gitlabProjectId, gitlabProjectPath, defaultBranch, timezone, "", 1, "COMPATIBLE", null, null, null, null, null, null);
		}
	}

	public record UpdateWorkspaceRequest(
		String name,
		WorkspaceSettings settings
	) {
	}
}
