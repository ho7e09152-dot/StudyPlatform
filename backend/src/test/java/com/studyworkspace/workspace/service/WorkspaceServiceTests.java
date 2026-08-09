package com.studyworkspace.workspace.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.file.Path;

import com.studyworkspace.workspace.domain.WorkspaceException;
import com.studyworkspace.workspace.domain.WorkspaceModels.SessionDraft;
import com.studyworkspace.workspace.domain.WorkspaceModels.SessionItem;
import com.studyworkspace.workspace.domain.WorkspaceModels.SubmissionRequest;
import com.studyworkspace.workspace.domain.WorkspaceModels.WorkspaceState;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import tools.jackson.databind.ObjectMapper;

class WorkspaceServiceTests {
	private static final long CURRENT_GITLAB_USER_ID = 101;

	@TempDir
	Path temporaryDirectory;

	private WorkspaceService service;

	@BeforeEach
	void setUp() {
		service = new WorkspaceService(new ObjectMapper(), temporaryDirectory.resolve("state.json").toString(), true);
	}

	@Test
	void startsWithoutDemoWorkspacesWhenSeedIsDisabled() {
		WorkspaceService productionService = new WorkspaceService(
			new ObjectMapper(),
			temporaryDirectory.resolve("production-state.json").toString(),
			false
		);

		assertThat(productionService.list(CURRENT_GITLAB_USER_ID)).isEmpty();
	}

	@Test
	void onlyPersistsASessionAfterTheRemoteCommitSucceeds() {
		SessionDraft draft = newSessionDraft();

		assertThatThrownBy(() -> service.saveSession(
			"workspace-evening", null, draft, "gitlab-user-a",
			(workspace, current, next) -> { throw new IllegalStateException("remote failed"); }
		)).isInstanceOf(IllegalStateException.class);

		assertThat(service.get("workspace-evening").sessions()).doesNotContainKey(draft.date());
	}

	@Test
	void storesTheCommitShaReturnedByTheRemoteWriter() {
		SessionDraft draft = newSessionDraft();

		WorkspaceState updated = service.saveSession(
			"workspace-evening", null, draft, "gitlab-user-a",
			(workspace, current, next) -> "gitlab-commit-sha"
		);

		assertThat(updated.sessions().get(draft.date()).lastCommitId()).isEqualTo("gitlab-commit-sha");
	}

	@Test
	void itemSubmissionMergesWithoutRemovingPreviousEntriesAndPersists() {
		WorkspaceState updated = service.upsertSubmission(
			"workspace-evening",
			"2026-07-23",
			"item-b712dd",
			new SubmissionRequest("link", "https://example.com/process", null, "commit-260723-member-a", "submit: process"),
			CURRENT_GITLAB_USER_ID
		);

		assertThat(updated.submissions().get("260723/member-a").submissions())
			.extracting("itemId")
			.containsExactly("item-a8f11c", "item-b712dd");
		assertThat(temporaryDirectory.resolve("state.json")).exists();

		WorkspaceService reloaded = new WorkspaceService(new ObjectMapper(), temporaryDirectory.resolve("state.json").toString(), true);
		assertThat(reloaded.get("workspace-evening").submissions().get("260723/member-a").submissions())
			.hasSize(2);
	}

	@Test
	void keepsLocalSubmissionUntouchedWhenTheGitLabWriteFails() {
		var before = service.get("workspace-evening").submissions().get("260723/member-a");

		assertThatThrownBy(() -> service.upsertSubmission(
			"workspace-evening",
			"2026-07-23",
			"item-b712dd",
			new SubmissionRequest(
				"link", "https://example.com/process", null, "commit-260723-member-a", "submit: process"
			),
			CURRENT_GITLAB_USER_ID,
			(workspace, session, member, current, next, message) -> { throw new IllegalStateException("remote failed"); }
		)).isInstanceOf(IllegalStateException.class);

		assertThat(service.get("workspace-evening").submissions().get("260723/member-a"))
			.usingRecursiveComparison().isEqualTo(before);
	}

	@Test
	void rejectsAStaleSubmissionCommitBeforeWriting() {
		assertThatThrownBy(() -> service.upsertSubmission(
			"workspace-evening",
			"2026-07-23",
			"item-b712dd",
			new SubmissionRequest("link", "https://example.com/process", null, "stale-sha", "submit: process"),
			CURRENT_GITLAB_USER_ID,
			(workspace, session, member, current, next, message) -> "should-not-write"
		))
			.isInstanceOf(WorkspaceException.class)
			.extracting("code")
			.isEqualTo("SUBMISSION_CONFLICT");
	}

	@Test
	void rejectsSubmissionTypeMismatch() {
		assertThatThrownBy(() -> service.upsertSubmission(
			"workspace-evening",
			"2026-07-23",
			"item-b712dd",
			new SubmissionRequest("text", "완료", null, "commit-260723-member-a", "submit: process"),
			CURRENT_GITLAB_USER_ID
		))
			.isInstanceOf(WorkspaceException.class)
			.extracting("code")
			.isEqualTo("SUBMISSION_TYPE_MISMATCH");
	}

	@Test
	void dashboardReflectsACompletedSubmission() {
		service.upsertSubmission(
			"workspace-evening",
			"2026-07-23",
			"item-b712dd",
			new SubmissionRequest("link", "https://example.com/process", null, "commit-260723-member-a", "submit: process"),
			CURRENT_GITLAB_USER_ID
		);

		@SuppressWarnings("unchecked")
		var metrics = (java.util.Map<String, Object>) service.dashboard("workspace-evening", "2026-07-23").get("metrics");
		assertThat(metrics.get("completedMembers")).isEqualTo(3);
		assertThat(metrics.get("submissionRate")).isEqualTo(100);
	}

	@Test
	void keepsAtLeastOneActiveOwnerWhenRolesChange() {
		WorkspaceState workspace = service.get("workspace-evening");
		String ownerId = workspace.members().stream().filter(member -> "OWNER".equals(member.role())).findFirst().orElseThrow().id();

		assertThatThrownBy(() -> service.updateMemberRole(workspace.id(), ownerId, "MANAGER"))
			.isInstanceOf(WorkspaceException.class)
			.extracting("code")
			.isEqualTo("LAST_OWNER_REQUIRED");

		String nextOwnerId = workspace.members().stream().filter(member -> !member.id().equals(ownerId)).findFirst().orElseThrow().id();
		service.updateMemberRole(workspace.id(), nextOwnerId, "OWNER");
		WorkspaceState transferred = service.updateMemberRole(workspace.id(), ownerId, "MANAGER");

		assertThat(transferred.members().stream().filter(member -> "OWNER".equals(member.role()))).hasSize(1);
	}

	private static SessionDraft newSessionDraft() {
		return new SessionDraft(
			"2026-08-09", "algorithm", "OAuth commit", "GitLab에 저장", "2026-08-09T23:59:00+09:00", null, "",
			java.util.List.of(new SessionItem(
				"item-oauth", 1, "첫 문제", null, null, "link", true, "active", null, null
			)),
			null
		);
	}
}
