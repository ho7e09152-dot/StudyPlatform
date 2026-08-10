package com.studyworkspace.workspace.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;

import com.studyworkspace.gitlab.dto.GitLabCommitComment;
import com.studyworkspace.gitlab.dto.GitLabUser;
import com.studyworkspace.gitlab.service.GitLabOAuthProjectService;
import com.studyworkspace.workspace.domain.WorkspaceException;
import com.studyworkspace.workspace.domain.WorkspaceModels.MemberSubmissionFile;
import com.studyworkspace.workspace.domain.WorkspaceModels.Notifications;
import com.studyworkspace.workspace.domain.WorkspaceModels.StudyMember;
import com.studyworkspace.workspace.domain.WorkspaceModels.StudySession;
import com.studyworkspace.workspace.domain.WorkspaceModels.WorkspaceSettings;
import com.studyworkspace.workspace.domain.WorkspaceModels.WorkspaceState;
import org.junit.jupiter.api.Test;

class SubmissionReviewServiceTests {
	@Test
	void readsGitLabCommitCommentsForTheMappedSubmissionFile() {
		GitLabOAuthProjectService gitLab = mock(GitLabOAuthProjectService.class);
		when(gitLab.getCommitComments("token", 42, "submission-sha")).thenReturn(List.of(
			new GitLabCommitComment(
				"좋은 풀이예요.", new GitLabUser(9, "reviewer", "리뷰어", "avatar", null),
				"2026-08-10T12:00:00Z", null, null, null
			)
		));

		var result = new SubmissionReviewService(gitLab).list("token", workspace(), "2026-08-09", "member-7");

		assertThat(result.filePath()).isEqualTo(".study-workspace/sessions/2026/2026-08-09/submissions/Owner.md");
		assertThat(result.commitId()).isEqualTo("submission-sha");
		assertThat(result.comments()).singleElement().satisfies(comment -> {
			assertThat(comment.body()).isEqualTo("좋은 풀이예요.");
			assertThat(comment.authorName()).isEqualTo("리뷰어");
		});
	}

	@Test
	void createsACommentAndReloadsTheGitLabThread() {
		GitLabOAuthProjectService gitLab = mock(GitLabOAuthProjectService.class);
		when(gitLab.getCommitComments("token", 42, "submission-sha")).thenReturn(List.of());

		new SubmissionReviewService(gitLab).add(
			"token", workspace(), "2026-08-09", "member-7", "  시간 복잡도도 적어주세요.  "
		);

		verify(gitLab).createCommitComment("token", 42, "submission-sha", "시간 복잡도도 적어주세요.");
	}

	@Test
	void rejectsAReviewWhenTheMemberHasNoSubmissionCommit() {
		WorkspaceState workspace = workspace();
		WorkspaceState empty = new WorkspaceState(
			workspace.id(), workspace.name(), workspace.gitlabProjectId(), workspace.gitlabProjectPath(), workspace.defaultBranch(),
			workspace.repositoryBasePath(), workspace.repositorySchemaVersion(), workspace.importMode(), workspace.status(), workspace.lastSyncedAt(),
			workspace.members(), workspace.sessions(), Map.of(), workspace.settings()
		);

		assertThatThrownBy(() -> new SubmissionReviewService(mock(GitLabOAuthProjectService.class))
			.list("token", empty, "2026-08-09", "member-7"))
			.isInstanceOf(WorkspaceException.class)
			.extracting("code").isEqualTo("SUBMISSION_NOT_FOUND");
	}

	private static WorkspaceState workspace() {
		StudySession session = SessionYamlParserTests.validSession();
		StudyMember member = new StudyMember(
			"member-7", 7, "owner", "Owner", "O", "#6750a4", "Owner.md", "OWNER", "ACTIVE", 40
		);
		MemberSubmissionFile submission = new MemberSubmissionFile(
			1, member.id(), member.gitlabUserId(), member.displayName(), session.folder(), session.revision(), session.type(),
			"2026-08-10T12:00:00Z", List.of(), null, "submission-sha", "submit: Owner"
		);
		return new WorkspaceState(
			"workspace", "Study", 42, "team/study", "main", ".study-workspace", 2, "EMPTY", "ACTIVE", null,
			List.of(member), Map.of(session.date(), session), Map.of(session.folder() + "/" + member.id(), submission),
			new WorkspaceSettings("Asia/Seoul", true, new Notifications(true, true, true))
		);
	}
}
