package com.studyworkspace.workspace.port;

import java.util.List;

import com.studyworkspace.workspace.domain.RepositoryMembership;
import com.studyworkspace.workspace.domain.RepositoryProvider;

public interface RepositoryMembershipPort {
	RepositoryProvider provider();

	List<RepositoryMembership> listAccessibleRepositories(String accessToken);

	RepositoryMembership getRepositoryMembership(String accessToken, String repositoryId);
}
