package com.studyworkspace.gitlab.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.studyworkspace.common.exception.InvalidRepositoryPathException;
import org.junit.jupiter.api.Test;

class RepositoryPathPolicyTests {

	private final RepositoryPathPolicy policy = new RepositoryPathPolicy();

	@Test
	void acceptsARepositoryRelativePath() {
		assertThat(policy.validate("260725/session.yml")).isEqualTo("260725/session.yml");
	}

	@Test
	void rejectsTraversalAndAbsolutePaths() {
		assertThatThrownBy(() -> policy.validate("../secret"))
			.isInstanceOf(InvalidRepositoryPathException.class);
		assertThatThrownBy(() -> policy.validate("/etc/passwd"))
			.isInstanceOf(InvalidRepositoryPathException.class);
		assertThatThrownBy(() -> policy.validate("folder//file.md"))
			.isInstanceOf(InvalidRepositoryPathException.class);
	}

	@Test
	void rejectsUnicodeFormatCharactersAndPreservesNormalUnicode() {
		assertThat(policy.validate("학습/김서연😀.md")).isEqualTo("학습/김서연😀.md");
		for (String formatCharacter : java.util.List.of("\u202E", "\u2066", "\u2069", "\u200B")) {
			assertThatThrownBy(() -> policy.validate("study/김" + formatCharacter + "서연.md"))
				.isInstanceOf(InvalidRepositoryPathException.class);
		}
	}
}
