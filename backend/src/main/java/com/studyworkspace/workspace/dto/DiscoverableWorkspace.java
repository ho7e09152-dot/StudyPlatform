package com.studyworkspace.workspace.dto;

public record DiscoverableWorkspace(
	String workspaceId,
	String workspaceName,
	String provider,
	String externalRepositoryId,
	String repositoryFullName,
	String repositoryId,
	String repositoryPath,
	String defaultBranch,
	String eligibility
) {
	public DiscoverableWorkspace(String workspaceId, String workspaceName, String provider,
		String repositoryId, String repositoryPath, String defaultBranch, String eligibility) {
		this(workspaceId, workspaceName, provider, repositoryId, repositoryPath, repositoryId,
			repositoryPath, defaultBranch, eligibility);
	}
}
