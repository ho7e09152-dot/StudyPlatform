package com.studyworkspace.workspace.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.file.Path;

import com.studyworkspace.workspace.domain.WorkspaceException;
import com.studyworkspace.workspace.service.WorkspaceService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import tools.jackson.databind.ObjectMapper;

class WorkspaceAccessServiceTests {
	@TempDir
	Path temporaryDirectory;

	private WorkspaceAccessService access;

	@BeforeEach
	void setUp() {
		WorkspaceService workspaceService = new WorkspaceService(
			new ObjectMapper(), temporaryDirectory.resolve("state.json").toString(), true
		);
		access = new WorkspaceAccessService(workspaceService);
	}

	@Test
	void scheduleManagersAreOwnerAndManagerButNotMember() {
		assertThat(access.requireManager("workspace-evening", 101, false).role()).isEqualTo("OWNER");
		assertThat(access.requireManager("workspace-evening", 103, false).role()).isEqualTo("MANAGER");

		assertThatThrownBy(() -> access.requireManager("workspace-evening", 102, false))
			.isInstanceOf(WorkspaceException.class)
			.extracting("code")
			.isEqualTo("WORKSPACE_MANAGER_REQUIRED");
	}
}
