package com.studyworkspace.gitlab.service;

import java.util.List;

import com.studyworkspace.gitlab.dto.GitLabProject;
import com.studyworkspace.workspace.domain.RepositoryMembership;
import com.studyworkspace.workspace.domain.RepositoryProvider;
import com.studyworkspace.workspace.port.RepositoryMembershipPort;
import org.springframework.stereotype.Component;

@Component
public class GitLabRepositoryMembershipAdapter implements RepositoryMembershipPort {
	private final GitLabOAuthProjectService projects;

	public GitLabRepositoryMembershipAdapter(GitLabOAuthProjectService projects) {
		this.projects = projects;
	}

	@Override
	public RepositoryProvider provider() {
		return RepositoryProvider.GITLAB;
	}

	@Override
	public List<RepositoryMembership> listAccessibleRepositories(String accessToken) {
		return projects.listAllMembershipProjects(accessToken).stream().map(GitLabRepositoryMembershipAdapter::map).toList();
	}

	@Override
	public RepositoryMembership getRepositoryMembership(String accessToken, String repositoryId) {
		long projectId;
		try {
			projectId = Long.parseLong(repositoryId);
		} catch (NumberFormatException exception) {
			throw new IllegalArgumentException("GitLab project id must be numeric", exception);
		}
		return map(projects.getProject(accessToken, projectId));
	}

	private static RepositoryMembership map(GitLabProject project) {
		return new RepositoryMembership(
			RepositoryProvider.GITLAB,
			Long.toString(project.id()),
			project.name(),
			project.pathWithNamespace(),
			project.defaultBranch(),
			project.accessLevel()
		);
	}
}
