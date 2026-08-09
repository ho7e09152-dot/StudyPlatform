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
import com.studyworkspace.workspace.domain.WorkspaceException;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class GitLabSessionFileServiceTests {

	private final GitLabOAuthProjectService gitLab = mock(GitLabOAuthProjectService.class);
	private final GitLabSessionFileService service = new GitLabSessionFileService(
		gitLab,
		new SessionYamlSerializer(new ObjectMapper())
	);

	@Test
	void createsTheFirstSessionFileAndReturnsTheRealCommitSha() {
		StudySession next = session(1, null, "active");
		when(gitLab.createRepositoryFile(anyString(), eq(42L), eq("260809/session.yml"), eq("main"), anyString(), anyString()))
			.thenReturn(file("new-sha"));

		String commitId = service.write("oauth-token", workspace(), null, next);

		assertThat(commitId).isEqualTo("new-sha");
		verify(gitLab).createRepositoryFile(
			eq("oauth-token"), eq(42L), eq("260809/session.yml"), eq("main"),
			contains("title: \"OAuth session\""), eq("study: create session 2026-08-09")
		);
	}

	@Test
	void rejectsAnUpdateWhenGitLabChangedAfterTheLastKnownCommit() {
		StudySession current = session(1, "known-sha", "active");
		StudySession next = session(2, null, "active");
		when(gitLab.getRepositoryFile("oauth-token", 42L, "260809/session.yml", "main"))
			.thenReturn(file("external-sha"));

		assertThatThrownBy(() -> service.write("oauth-token", workspace(), current, next))
			.isInstanceOf(WorkspaceException.class)
			.extracting("code")
			.isEqualTo("SESSION_REVISION_CONFLICT");
	}

	@Test
	void updatesWithLastCommitIdAndReturnsTheNewSha() {
		StudySession current = session(1, "known-sha", "active");
		StudySession next = session(2, null, "cancelled");
		when(gitLab.getRepositoryFile("oauth-token", 42L, "260809/session.yml", "main"))
			.thenReturn(file("known-sha"));
		when(gitLab.updateRepositoryFile(anyString(), anyLong(), anyString(), anyString(), anyString(), anyString(), anyString()))
			.thenReturn(file("cancel-sha"));

		String commitId = service.write("oauth-token", workspace(), current, next);

		assertThat(commitId).isEqualTo("cancel-sha");
		verify(gitLab).updateRepositoryFile(
			eq("oauth-token"), eq(42L), eq("260809/session.yml"), eq("main"),
			contains("status: \"cancelled\""), eq("study: cancel session 2026-08-09"), eq("known-sha")
		);
	}

	private static WorkspaceState workspace() {
		return new WorkspaceState(
			"workspace-one", "Study", 42, "group/study", "main", "ACTIVE", "2026-08-09T00:00:00Z",
			List.of(), Map.of(), Map.of(),
			new WorkspaceSettings("Asia/Seoul", true, new Notifications(true, true, true))
		);
	}

	private static StudySession session(int revision, String commitId, String status) {
		return new StudySession(
			"2026-08-09", "260809", revision, "algorithm", "OAuth session", "description", status,
			"2026-08-09T23:59:00+09:00", null,
			"2026-08-09T00:00:00Z", "lhc0688", "2026-08-09T00:00:00Z", "lhc0688", null,
			List.of(new SessionItem("item-one", 1, "Problem", null, null, "link", true, "active", null, null)),
			List.of(), commitId
		);
	}

	private static GitLabFileContent file(String commitId) {
		return new GitLabFileContent(
			"session.yml", "260809/session.yml", 10, "version: 1\n", "main", "blob", commitId, commitId
		);
	}
}
