package com.studyworkspace.workspace.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.studyworkspace.workspace.domain.WorkspaceException;
import org.junit.jupiter.api.Test;

class WorkspaceRepositoryPathTests {
	@Test
	void joinsAndStripsDedicatedWorkspacePath() {
		assertThat(WorkspaceRepositoryPath.join(".study-workspace", "260810/session.yml"))
			.isEqualTo(".study-workspace/260810/session.yml");
		assertThat(WorkspaceRepositoryPath.relative(".study-workspace", ".study-workspace/260810/session.yml"))
			.isEqualTo("260810/session.yml");
		assertThat(WorkspaceRepositoryPath.relative(".study-workspace", "README.md")).isNull();
	}

	@Test
	void rejectsArbitraryBasePaths() {
		assertThatThrownBy(() -> WorkspaceRepositoryPath.normalizeBasePath("src"))
			.isInstanceOf(WorkspaceException.class);
	}
}
