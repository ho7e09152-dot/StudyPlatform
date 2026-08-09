package com.studyworkspace.workspace.service;

import static com.studyworkspace.workspace.domain.WorkspaceModels.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;

import com.studyworkspace.gitlab.dto.GitLabFileContent;
import com.studyworkspace.gitlab.service.GitLabOAuthProjectService;
import com.studyworkspace.gitlab.service.RepositoryPathPolicy;
import com.studyworkspace.workspace.domain.WorkspaceException;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class GitLabSubmissionFileServiceTests {
	private final GitLabOAuthProjectService gitLab = mock(GitLabOAuthProjectService.class);
	private final GitLabSubmissionFileService service = new GitLabSubmissionFileService(
		gitLab, new RepositoryPathPolicy(), new SubmissionMarkdownCodec(new ObjectMapper())
	);

	@Test
	void createsAUserMappedMarkdownFile() {
		when(gitLab.createRepositoryFile(anyString(), anyLong(), anyString(), anyString(), anyString(), anyString(), anyString()))
			.thenReturn(file("new-sha"));

		String sha = service.write(
			"token", workspace(), SubmissionMarkdownCodecTests.session(), member(), null,
			SubmissionMarkdownCodecTests.submission(null), "submit: code"
		);

		assertThat(sha).isEqualTo("new-sha");
		verify(gitLab).createRepositoryFile(
			eq("token"), eq(42L), eq("260809/owner.md"), eq("main"),
			contains("memberId: \"member-7\""), eq("submit: code"), eq("Owner")
		);
	}

	@Test
	void rejectsAnUpdateWhenTheRemoteCommitChanged() {
		when(gitLab.getRepositoryFile("token", 42, "260809/owner.md", "main"))
			.thenReturn(file("external-sha"));

		assertThatThrownBy(() -> service.write(
			"token", workspace(), SubmissionMarkdownCodecTests.session(), member(),
			SubmissionMarkdownCodecTests.submission("known-sha"), SubmissionMarkdownCodecTests.submission(null), "update: code"
		))
			.isInstanceOf(WorkspaceException.class)
			.extracting("code")
			.isEqualTo("SUBMISSION_CONFLICT");
	}

	private static WorkspaceState workspace() {
		return new WorkspaceState(
			"workspace", "Study", 42, "team/study", "main", "ACTIVE", "2026-08-09T00:00:00Z",
			List.of(member()), Map.of(), Map.of(),
			new WorkspaceSettings("Asia/Seoul", true, new Notifications(true, true, true))
		);
	}

	private static StudyMember member() {
		return new StudyMember("member-7", 7, "owner", "Owner", "O", "#000", "owner.md", "OWNER", "ACTIVE", 40);
	}

	private static GitLabFileContent file(String sha) {
		return new GitLabFileContent("owner.md", "260809/owner.md", 10, "---\n---\n", "main", "blob", sha, sha);
	}
}
