package com.studyworkspace.gitlab.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.List;

import com.studyworkspace.gitlab.config.GitLabProperties;
import com.studyworkspace.gitlab.dto.GitLabFileResponse;
import com.studyworkspace.gitlab.dto.GitLabProject;
import com.studyworkspace.gitlab.dto.GitLabTreeItem;
import com.studyworkspace.gitlab.dto.GitLabUser;
import com.studyworkspace.gitlab.port.GitLabRepositoryPort;
import org.junit.jupiter.api.Test;

class GitLabConnectionServiceTests {

	@Test
	void returnsNotConfiguredWithoutCallingGitLab() {
		GitLabProperties properties = new GitLabProperties(
			"https://lab.ssafy.com",
			"",
			"",
			"",
			Duration.ofSeconds(1)
		);
		GitLabConnectionService service = new GitLabConnectionService(
			new FailingGitLabRepository(),
			properties,
			new RepositoryPathPolicy()
		);

		assertThat(service.checkConnection().status()).isEqualTo("NOT_CONFIGURED");
		assertThat(service.checkConnection().repositoryTree()).isEmpty();
	}

	private static final class FailingGitLabRepository implements GitLabRepositoryPort {
		@Override
		public GitLabUser getCurrentUser() {
			throw new AssertionError("GitLab must not be called");
		}

		@Override
		public GitLabProject getConfiguredProject() {
			throw new AssertionError("GitLab must not be called");
		}

		@Override
		public List<GitLabTreeItem> getRepositoryTree(String ref) {
			throw new AssertionError("GitLab must not be called");
		}

		@Override
		public GitLabFileResponse getRepositoryFile(String path, String ref) {
			throw new AssertionError("GitLab must not be called");
		}
	}
}
