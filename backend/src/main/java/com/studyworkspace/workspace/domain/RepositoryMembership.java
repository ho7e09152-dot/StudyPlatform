package com.studyworkspace.workspace.domain;

public record RepositoryMembership(
	RepositoryProvider provider,
	String repositoryId,
	String repositoryName,
	String repositoryPath,
	String defaultBranch,
	Integer accessLevel
) {
}
