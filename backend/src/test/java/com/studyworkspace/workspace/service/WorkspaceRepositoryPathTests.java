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
	void acceptsSafeCustomBasePathsAndRejectsTraversal() {
		assertThat(WorkspaceRepositoryPath.normalizeBasePath("study/algorithm/")).isEqualTo("study/algorithm");
		assertThatThrownBy(() -> WorkspaceRepositoryPath.normalizeBasePath("/study/algorithm"))
			.isInstanceOf(WorkspaceException.class)
			.extracting("code").isEqualTo("INVALID_REPOSITORY_BASE_PATH");
		assertThatThrownBy(() -> WorkspaceRepositoryPath.normalizeBasePath("study/../private"))
			.isInstanceOf(WorkspaceException.class)
			.extracting("code").isEqualTo("INVALID_REPOSITORY_BASE_PATH");
	}

	@Test
	void rejectsUnicodeFormatCharactersWithoutChangingNormalUnicode() {
		assertThat(WorkspaceRepositoryPath.normalizeBasePath("학습/운영체제😀"))
			.isEqualTo("학습/운영체제😀");
		for (String formatCharacter : java.util.List.of(
			"\u202A", "\u202B", "\u202C", "\u202D", "\u202E",
			"\u2066", "\u2067", "\u2068", "\u2069", "\u200B"
		)) {
			assertThatThrownBy(() -> WorkspaceRepositoryPath.normalizeBasePath("study/" + formatCharacter + "algorithm"))
				.isInstanceOf(WorkspaceException.class)
				.extracting("code").isEqualTo("INVALID_REPOSITORY_BASE_PATH");
		}
	}
}
