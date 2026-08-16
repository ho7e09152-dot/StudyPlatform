package com.studyworkspace.workspace.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;

import com.studyworkspace.workspace.domain.WorkspaceModels.Notifications;
import com.studyworkspace.workspace.domain.WorkspaceModels.StudySession;
import com.studyworkspace.workspace.domain.WorkspaceModels.WorkspaceSettings;
import com.studyworkspace.workspace.domain.WorkspaceModels.WorkspaceState;
import org.junit.jupiter.api.Test;

class WorkspaceRepositoryLayoutTests {
	@Test
	void placesCustomWorkspaceConfigInsideTheSelectedLearningRoot() {
		assertThat(WorkspaceRepositoryLayout.customConfigPath("study"))
			.isEqualTo("study/.study-workspace/config.yml");
		assertThat(WorkspaceRepositoryLayout.isConfigPath("study/.study-workspace/config.yml")).isTrue();
		assertThat(WorkspaceRepositoryLayout.isConfigPath(".study-workspace/config.yml")).isTrue();
	}

	@Test
	void buildsAndParsesV2SessionAndSubmissionPaths() {
		WorkspaceState workspace = new WorkspaceState(
			"workspace", "Study", 42, "team/study", "main", ".study-workspace", 2, "EMPTY", "ACTIVE", null,
			List.of(), Map.of(), Map.of(), new WorkspaceSettings("Asia/Seoul", true, new Notifications(true, true, true))
		);
		StudySession session = SessionYamlParserTests.validSession();

		String sessionPath = WorkspaceRepositoryLayout.sessionPath(workspace, session);
		String submissionPath = WorkspaceRepositoryLayout.submissionPath(workspace, session, "김서연.md");

		assertThat(sessionPath).isEqualTo(".study-workspace/sessions/2026/2026-08-09/session.yml");
		assertThat(submissionPath).isEqualTo(".study-workspace/sessions/2026/2026-08-09/submissions/김서연.md");
		assertThat(WorkspaceRepositoryLayout.matchSession(
			"sessions/2026/2026-08-09/session.yml", 2
		)).get().extracting("date", "folder").containsExactly("2026-08-09", "260809");
		assertThat(WorkspaceRepositoryLayout.matchSubmission(
			"sessions/2026/2026-08-09/submissions/김서연.md", 2
		)).get().extracting("date", "folder", "fileName").containsExactly("2026-08-09", "260809", "김서연.md");
	}
}
