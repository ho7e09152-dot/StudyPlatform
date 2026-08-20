package com.studyworkspace.workspace.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.nio.file.Path;
import java.util.List;

import com.studyworkspace.gitlab.dto.GitLabFileContent;
import com.studyworkspace.gitlab.dto.GitLabTreeItem;
import com.studyworkspace.gitlab.dto.GitLabUser;
import com.studyworkspace.gitlab.service.GitLabOAuthProjectService;
import com.studyworkspace.workspace.domain.WorkspaceModels.CreateWorkspaceRequest;
import com.studyworkspace.workspace.domain.WorkspaceModels.MemberSubmissionFile;
import com.studyworkspace.workspace.domain.WorkspaceModels.SessionItem;
import com.studyworkspace.workspace.domain.WorkspaceModels.SubmissionEntry;
import com.studyworkspace.workspace.domain.WorkspaceModels.StudySession;
import com.studyworkspace.workspace.domain.WorkspaceModels.WorkspaceState;
import com.studyworkspace.workspace.domain.RepositoryStorageLayout;
import com.studyworkspace.workspace.dto.WorkspaceSyncResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import tools.jackson.databind.ObjectMapper;

class GitLabSessionSyncServiceTests {
	@TempDir
	Path tempDir;

	@Test
	void importsValidFilesAndReturnsInvalidFilesAsPartialFailures() {
		WorkspaceService workspaces = new WorkspaceService(new ObjectMapper(), tempDir.resolve("workspaces.json").toString(), false);
		WorkspaceState workspace = workspaces.create(
			new CreateWorkspaceRequest("Study", 12, "team/study", "main", "Asia/Seoul"),
			new GitLabUser(7, "owner", "Owner", null, null)
		);
		GitLabOAuthProjectService gitLab = mock(GitLabOAuthProjectService.class);
		when(gitLab.getAllRepositoryTree("token", 12, "main")).thenReturn(List.of(
			new GitLabTreeItem("1", "session.yml", "blob", "260809/session.yml", "100644"),
			new GitLabTreeItem("2", "session.yml", "blob", "260810/session.yml", "100644"),
			new GitLabTreeItem("3", "README.md", "blob", "README.md", "100644"),
			new GitLabTreeItem("4", "owner.md", "blob", "260809/owner.md", "100644")
		));
		SessionYamlSerializer serializer = new SessionYamlSerializer(new ObjectMapper());
		String valid = serializer.serialize(SessionYamlParserTests.validSession());
		when(gitLab.getRepositoryFile("token", 12, "260809/session.yml", "main"))
			.thenReturn(file("260809/session.yml", valid, "sha-1"));
		when(gitLab.getRepositoryFile("token", 12, "260810/session.yml", "main"))
			.thenReturn(file("260810/session.yml", "not: [valid", "sha-2"));
		SubmissionMarkdownCodec submissionCodec = new SubmissionMarkdownCodec(new ObjectMapper());
		var submission = new com.studyworkspace.workspace.domain.WorkspaceModels.MemberSubmissionFile(
			1, "member-7", 7, "owner", "260809", 1, "cs", "2026-08-09T12:00:00+09:00",
			List.of(new com.studyworkspace.workspace.domain.WorkspaceModels.SubmissionEntry(
				"item-1", "text", "완료", null, "2026-08-09T11:00:00+09:00", "2026-08-09T12:00:00+09:00"
			)), null, null, null
		);
		when(gitLab.getRepositoryFile("token", 12, "260809/owner.md", "main"))
			.thenReturn(file("260809/owner.md", submissionCodec.encode(submission, SessionYamlParserTests.validSession()), "submission-sha"));

		var result = new GitLabSessionSyncService(
			gitLab, new SessionYamlParser(), workspaces, submissionCodec
		).sync("token", workspace.id());

		assertThat(result.importedSessions()).isEqualTo(1);
		assertThat(result.failures()).singleElement().satisfies(failure -> {
			assertThat(failure.path()).isEqualTo("260810/session.yml");
			assertThat(failure.code()).isEqualTo("INVALID_SESSION_FILE");
		});
		assertThat(result.workspace().sessions()).containsOnlyKeys("2026-08-09");
		assertThat(result.workspace().sessions().get("2026-08-09").lastCommitId()).isEqualTo("sha-1");
		assertThat(result.importedSubmissions()).isEqualTo(1);
		assertThat(result.workspace().submissions().get("260809/member-7").lastCommitId()).isEqualTo("submission-sha");
	}

	@Test
	void importsDetectedPlainMarkdownWithoutMovingTheRepositoryFile() {
		WorkspaceService workspaces = new WorkspaceService(new ObjectMapper(), tempDir.resolve("detected.json").toString(), false);
		RepositoryStorageLayout layout = new RepositoryStorageLayout(
			List.of("DATE"), List.of("NAME"), "YYYY", "MM", "YYMMDD", "md"
		);
		WorkspaceState workspace = workspaces.create(
			new CreateWorkspaceRequest(
				"Study", 12L, "team/study", "main", "Asia/Seoul", "study", 3, "DETECTED", null,
				"Owner.md", null, null, "GITLAB", "12", layout
			),
			new GitLabUser(7, "owner", "Owner", null, null)
		);
		GitLabOAuthProjectService gitLab = mock(GitLabOAuthProjectService.class);
		when(gitLab.getAllRepositoryTree("token", 12, "main")).thenReturn(List.of(
			new GitLabTreeItem("record", "Owner.md", "blob", "study/260809/Owner.md", "100644")
		));
		when(gitLab.getRepositoryFile("token", 12, "study/260809/Owner.md", "main"))
			.thenReturn(file("study/260809/Owner.md", "# 기존 회고\n오늘 배운 내용", "record-sha"));

		var result = new GitLabSessionSyncService(
			gitLab, new SessionYamlParser(), workspaces, new SubmissionMarkdownCodec(new ObjectMapper())
		).sync("token", workspace.id());

		assertThat(result.failures()).isEmpty();
		assertThat(result.workspace().sessions()).containsOnlyKeys("2026-08-09");
		assertThat(result.workspace().submissions()).containsKey("260809/member-7");
		assertThat(result.workspace().submissions().get("260809/member-7").submissions().getFirst().value())
			.contains("기존 회고");
		assertThat(result.workspace().submissions().get("260809/member-7").lastCommitId()).isEqualTo("record-sha");
	}

	@Test
	void importsChecklistCompletionFromTheMemberFile() {
		var result = syncItemEntry("check", "check");

		assertThat(result.failures()).isEmpty();
		assertThat(result.importedSubmissions()).isEqualTo(1);
		assertThat(result.workspace().submissions().get("260809/member-7").submissions().getFirst())
			.extracting(SubmissionEntry::itemId, SubmissionEntry::type, SubmissionEntry::value)
			.containsExactly("item-special", "check", "completed");
	}

	@Test
	void rejectsMismatchedChecklistEntriesAndAnyTimedItemEntry() {
		var mismatchedCheck = syncItemEntry("check", "text");
		var timedEntry = syncItemEntry("event", "text");

		assertThat(mismatchedCheck.importedSubmissions()).isZero();
		assertThat(mismatchedCheck.failures()).singleElement().satisfies(failure ->
			assertThat(failure.code()).isEqualTo("SUBMISSION_FILE_INVALID")
		);
		assertThat(timedEntry.importedSubmissions()).isZero();
		assertThat(timedEntry.failures()).singleElement().satisfies(failure ->
			assertThat(failure.code()).isEqualTo("SUBMISSION_FILE_INVALID")
		);
	}

	private WorkspaceSyncResponse syncItemEntry(String kind, String entryType) {
		String suffix = kind + "-" + entryType;
		WorkspaceService workspaces = new WorkspaceService(
			new ObjectMapper(), tempDir.resolve("sync-" + suffix + ".json").toString(), false
		);
		WorkspaceState workspace = workspaces.create(
			new CreateWorkspaceRequest("Study", 12, "team/study", "main", "Asia/Seoul"),
			new GitLabUser(7, "owner", "Owner", null, null)
		);
		SessionItem item = new SessionItem(
			"item-special", 1, "특수 항목", "free", null, null, "text", !"event".equals(kind),
			"active", null, null, kind, null, null, null,
			"event".equals(kind) ? "19:00" : null, "event".equals(kind) ? "20:00" : null
		);
		StudySession session = new StudySession(
			"2026-08-09", "260809", 1, "free", "2026-08-09 계획", "", "active",
			"2026-08-09T23:59:00+09:00", null,
			"2026-08-09T00:00:00+09:00", "owner", "2026-08-09T00:00:00+09:00", "owner", null,
			List.of(item), List.of(), null
		);
		MemberSubmissionFile submission = new MemberSubmissionFile(
			1, "member-7", 7, "owner", "260809", 1, "free", "2026-08-09T12:00:00+09:00",
			List.of(new SubmissionEntry(
				"item-special", entryType, "check".equals(entryType) ? "completed" : "완료", null,
				"2026-08-09T11:00:00+09:00", "2026-08-09T12:00:00+09:00"
			)), null, null, null
		);
		GitLabOAuthProjectService gitLab = mock(GitLabOAuthProjectService.class);
		when(gitLab.getAllRepositoryTree("token", 12, "main")).thenReturn(List.of(
			new GitLabTreeItem("1", "session.yml", "blob", "260809/session.yml", "100644"),
			new GitLabTreeItem("2", "owner.md", "blob", "260809/owner.md", "100644")
		));
		SessionYamlSerializer serializer = new SessionYamlSerializer(new ObjectMapper());
		SubmissionMarkdownCodec submissionCodec = new SubmissionMarkdownCodec(new ObjectMapper());
		when(gitLab.getRepositoryFile("token", 12, "260809/session.yml", "main"))
			.thenReturn(file("260809/session.yml", serializer.serialize(session), "session-sha"));
		when(gitLab.getRepositoryFile("token", 12, "260809/owner.md", "main"))
			.thenReturn(file("260809/owner.md", submissionCodec.encode(submission, session), "submission-sha"));

		return new GitLabSessionSyncService(
			gitLab, new SessionYamlParser(), workspaces, submissionCodec
		).sync("token", workspace.id());
	}

	private static GitLabFileContent file(String path, String content, String sha) {
		return new GitLabFileContent("session.yml", path, content.length(), content, "main", "blob", sha, sha);
	}
}
