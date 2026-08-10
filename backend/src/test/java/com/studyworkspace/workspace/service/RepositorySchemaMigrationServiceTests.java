package com.studyworkspace.workspace.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;

import com.studyworkspace.gitlab.dto.GitLabBatchCommitResponse;
import com.studyworkspace.gitlab.dto.GitLabCommitAction;
import com.studyworkspace.gitlab.dto.GitLabTreeItem;
import com.studyworkspace.gitlab.service.GitLabOAuthProjectService;
import com.studyworkspace.workspace.domain.WorkspaceModels.Notifications;
import com.studyworkspace.workspace.domain.WorkspaceModels.WorkspaceSettings;
import com.studyworkspace.workspace.domain.WorkspaceModels.WorkspaceState;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class RepositorySchemaMigrationServiceTests {
	@Test
	void previewsAndCommitsLegacyFilesAsOneAtomicV2Migration() {
		GitLabOAuthProjectService gitLab = mock(GitLabOAuthProjectService.class);
		List<GitLabTreeItem> tree = List.of(
			blob("README.md"),
			blob("260809/session.yml"),
			blob("260809/김서연.md")
		);
		when(gitLab.getAllRepositoryTree("token", 12, "main")).thenReturn(tree);
		when(gitLab.createCommit(eq("token"), eq(12L), eq("main"), any(), any(), eq("김서연")))
			.thenReturn(new GitLabBatchCommitResponse("commit-v2", "commit-v", "migration", "migration", "https://gitlab/commit-v2"));
		RepositorySchemaMigrationService service = new RepositorySchemaMigrationService(gitLab);

		var preview = service.preview("token", workspace());
		var result = service.migrate("token", workspace(), preview.treeFingerprint(), "김서연");

		assertThat(preview.ready()).isTrue();
		assertThat(preview.sessionFiles()).isEqualTo(1);
		assertThat(preview.submissionFiles()).isEqualTo(1);
		assertThat(preview.moves()).extracting("targetPath").containsExactly(
			".study-workspace/sessions/2026/2026-08-09/session.yml",
			".study-workspace/sessions/2026/2026-08-09/submissions/김서연.md"
		);
		assertThat(result.commitId()).isEqualTo("commit-v2");
		assertThat(result.movedFiles()).isEqualTo(2);

		@SuppressWarnings("unchecked")
		ArgumentCaptor<List<GitLabCommitAction>> actions = ArgumentCaptor.forClass(List.class);
		verify(gitLab).createCommit(eq("token"), eq(12L), eq("main"), any(), actions.capture(), eq("김서연"));
		assertThat(actions.getValue()).extracting(GitLabCommitAction::action).containsExactly("move", "move", "create");
		assertThat(actions.getValue().getLast().filePath()).isEqualTo(".study-workspace/config.yml");
		assertThat(actions.getValue().getLast().content()).contains("repositorySchemaVersion: 2", "workspaceId: \"workspace-1\"");
	}

	@Test
	void blocksMigrationWhenManagedTargetPathIsAlreadyInUse() {
		GitLabOAuthProjectService gitLab = mock(GitLabOAuthProjectService.class);
		when(gitLab.getAllRepositoryTree("token", 12, "main")).thenReturn(List.of(
			blob("260809/session.yml"),
			blob(".study-workspace/notes.md")
		));

		var preview = new RepositorySchemaMigrationService(gitLab).preview("token", workspace());

		assertThat(preview.ready()).isFalse();
		assertThat(preview.blockers()).extracting("code").contains("TARGET_BASE_PATH_IN_USE");
	}

	private static GitLabTreeItem blob(String path) {
		String name = path.substring(path.lastIndexOf('/') + 1);
		return new GitLabTreeItem("blob-" + path, name, "blob", path, "100644");
	}

	private static WorkspaceState workspace() {
		return new WorkspaceState(
			"workspace-1", "Study", 12, "team/study", "main", "", 1, "COMPATIBLE", "ACTIVE", null,
			List.of(), Map.of(), Map.of(),
			new WorkspaceSettings("Asia/Seoul", true, new Notifications(true, true, true))
		);
	}
}
