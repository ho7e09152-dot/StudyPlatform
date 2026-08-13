package com.studyworkspace.gitlab.client;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;

import com.studyworkspace.common.exception.GitLabApiException;
import com.studyworkspace.gitlab.config.GitLabProperties;
import com.studyworkspace.gitlab.dto.GitLabBranch;
import com.studyworkspace.gitlab.dto.GitLabFileResponse;
import com.studyworkspace.gitlab.dto.GitLabProject;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.util.StringUtils;
import org.springframework.web.reactive.function.client.WebClient;

/**
 * 실제 GitLab 프로젝트에서 쓰기 권한과 Repository Files API 동작을 확인하는 수동 스파이크입니다.
 *
 * <p>기본 테스트 실행에서는 건너뜁니다. {@code GITLAB_WRITE_SPIKE_ENABLED=true}일 때만
 * 고유한 임시 브랜치를 만들며, 기본 브랜치에는 절대 커밋하지 않습니다.</p>
 */
@EnabledIfEnvironmentVariable(named = "GITLAB_WRITE_SPIKE_ENABLED", matches = "true")
class GitLabWriteSpikeTests {

	private static final String SPIKE_FILE_PATH = ".study-workspace-spike/write-check.md";

	@Test
	void createsUpdatesReadsAndCleansUpFileOnDisposableBranch() {
		GitLabProperties properties = propertiesFromEnvironment();
		GitLabClient client = new GitLabClient(WebClient.builder(), properties);
		GitLabProject project = client.getConfiguredProject();
		String baseRef = StringUtils.hasText(properties.defaultRef())
			? properties.defaultRef()
			: project.defaultBranch();
		String branchName = "codex-write-spike-" + System.currentTimeMillis();
		boolean branchCreated = false;

		assertThat(baseRef)
			.as("기준 브랜치는 환경변수 또는 프로젝트 기본 브랜치에서 확인되어야 합니다.")
			.isNotBlank();

		try {
			GitLabBranch branch = client.createBranch(branchName, baseRef);
			branchCreated = true;

			assertThat(branch.name()).isEqualTo(branchName);
			assertThat(branch.defaultBranch()).isFalse();
			assertThat(branch.canPush()).isTrue();

			String firstContent = "# Study-ing write spike\n\nphase: created\n";
			client.createRepositoryFile(
				SPIKE_FILE_PATH,
				branchName,
				firstContent,
				"test: create GitLab write spike file"
			);

			GitLabFileResponse created = client.getRepositoryFile(SPIKE_FILE_PATH, branchName);
			assertThat(decode(created)).isEqualTo(firstContent);

			String secondContent = "# Study-ing write spike\n\nphase: updated\n";
			client.updateRepositoryFile(
				SPIKE_FILE_PATH,
				branchName,
				secondContent,
				"test: update GitLab write spike file",
				created.lastCommitId()
			);

			GitLabFileResponse updated = client.getRepositoryFile(SPIKE_FILE_PATH, branchName);
			assertThat(decode(updated)).isEqualTo(secondContent);
			assertThat(updated.lastCommitId()).isNotEqualTo(created.lastCommitId());

			client.deleteRepositoryFile(
				SPIKE_FILE_PATH,
				branchName,
				"test: clean up GitLab write spike file",
				updated.lastCommitId()
			);

			assertThatThrownBy(
				() -> client.getRepositoryFile(SPIKE_FILE_PATH, branchName)
			)
				.isInstanceOf(GitLabApiException.class)
				.extracting(exception -> ((GitLabApiException) exception).code())
				.isEqualTo("GITLAB_RESOURCE_NOT_FOUND");
		} finally {
			if (branchCreated) {
				client.deleteBranch(branchName);
			}
		}
	}

	private GitLabProperties propertiesFromEnvironment() {
		return new GitLabProperties(
			System.getenv().getOrDefault("GITLAB_BASE_URL", "https://lab.ssafy.com"),
			System.getenv().getOrDefault("GITLAB_ACCESS_TOKEN", ""),
			System.getenv().getOrDefault("GITLAB_PROJECT_ID", ""),
			System.getenv().getOrDefault("GITLAB_DEFAULT_REF", ""),
			Duration.ofSeconds(15)
		);
	}

	private String decode(GitLabFileResponse file) {
		return new String(
			Base64.getMimeDecoder().decode(file.content()),
			StandardCharsets.UTF_8
		);
	}
}
