package com.studyworkspace.workspace.service;

import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;

import com.studyworkspace.workspace.domain.RepositoryProvider;
import com.studyworkspace.workspace.domain.RepositoryStorageLayout;
import com.studyworkspace.workspace.domain.WorkspaceModels.Notifications;
import com.studyworkspace.workspace.domain.WorkspaceModels.RepositoryIdentity;
import com.studyworkspace.workspace.domain.WorkspaceModels.WorkspaceSettings;
import com.studyworkspace.workspace.domain.WorkspaceModels.WorkspaceState;
import com.studyworkspace.workspace.port.RepositoryDataPort;
import org.junit.jupiter.api.Test;

class RepositoryInitializationServiceTests {
	@Test
	void createsCustomConfigInsideTheSelectedLearningRoot() {
		RepositoryDataPort repository = mock(RepositoryDataPort.class);
		when(repository.provider()).thenReturn(RepositoryProvider.GITLAB);
		WorkspaceState workspace = workspace();

		new RepositoryInitializationService(new RepositoryDataService(List.of(repository)))
			.initialize("token", workspace, "Owner");

		verify(repository).createFile(
			eq("token"), eq(workspace.repository()), eq("study/.study-workspace/config.yml"), eq("main"),
			contains("repositoryBasePath: \"study\""), eq("study: initialize workspace"), eq("Owner")
		);
	}

	private static WorkspaceState workspace() {
		return new WorkspaceState(
			"workspace", "Study", 42, "team/study", "main", "study", 3, "EMPTY", "ACTIVE", null,
			List.of(), Map.of(), Map.of(),
			new WorkspaceSettings("Asia/Seoul", true, new Notifications(true, true, true)),
			new RepositoryIdentity("GITLAB", "42", "team/study", null, "private", "main", true, true, true, "40"),
			RepositoryStorageLayout.recommended()
		);
	}
}
