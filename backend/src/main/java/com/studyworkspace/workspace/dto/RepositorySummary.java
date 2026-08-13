package com.studyworkspace.workspace.dto;

import com.studyworkspace.gitlab.dto.GitLabProject;
import com.studyworkspace.workspace.domain.RepositoryProvider;

public record RepositorySummary(
	RepositoryProvider provider,
	String externalId,
	String name,
	String fullName,
	String visibility,
	String defaultBranch,
	String webUrl,
	Capabilities capabilities,
	String providerPermission,
	String connectionState
) {
	public record Capabilities(boolean canRead, boolean canWrite, boolean canManage) { }

	public static RepositorySummary fromGitLab(GitLabProject project) {
		int level = project.accessLevel() == null ? 0 : project.accessLevel();
		return new RepositorySummary(
			RepositoryProvider.GITLAB, Long.toString(project.id()), project.name(), project.pathWithNamespace(),
			project.visibility(), project.defaultBranch(), project.webUrl(),
			new Capabilities(level >= 20, level >= 30, level >= 40), Integer.toString(level), "AVAILABLE"
		);
	}
}
