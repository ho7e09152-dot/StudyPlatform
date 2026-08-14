package com.studyworkspace.github.service;

import java.util.List;

import com.studyworkspace.workspace.domain.RepositoryMembership;
import com.studyworkspace.workspace.domain.RepositoryProvider;
import com.studyworkspace.workspace.dto.RepositorySummary;
import com.studyworkspace.workspace.port.RepositoryMembershipPort;
import org.springframework.stereotype.Component;

@Component
public class GitHubRepositoryMembershipAdapter implements RepositoryMembershipPort {
	private final GitHubRepositoryService github;

	public GitHubRepositoryMembershipAdapter(GitHubRepositoryService github) { this.github = github; }

	@Override public RepositoryProvider provider() { return RepositoryProvider.GITHUB; }

	@Override
	public List<RepositoryMembership> listAccessibleRepositories(String accessToken) {
		return github.listRepositories(accessToken, null, 1, 10_000).stream()
			.map(GitHubRepositoryMembershipAdapter::membership).toList();
	}

	@Override
	public RepositoryMembership getRepositoryMembership(String accessToken, String repositoryId) {
		return membership(github.getRepository(accessToken, repositoryId));
	}

	private static RepositoryMembership membership(RepositorySummary repository) {
		int access = repository.capabilities().canManage() ? 40 : repository.capabilities().canWrite() ? 30
			: repository.capabilities().canRead() ? 20 : 0;
		return new RepositoryMembership(repository.provider(), repository.externalId(), repository.name(), repository.fullName(),
			repository.defaultBranch(), access);
	}
}
