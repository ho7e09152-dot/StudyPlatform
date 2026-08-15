package com.studyworkspace.workspace.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import com.studyworkspace.workspace.port.RepositoryDataPort.TreeEntry;
import org.junit.jupiter.api.Test;

class RepositoryLayoutDetectionServiceTests {
	private final RepositoryLayoutDetectionService detector = new RepositoryLayoutDetectionService();

	@Test
	void detectsDateFolderAndMemberFilePattern() {
		var result = detector.detect(List.of(
			file("study/260810/김서연.md"), file("study/260811/김서연.md"), file("README.md")
		));

		assertThat(result.detected()).isTrue();
		assertThat(result.basePath()).isEqualTo("study");
		assertThat(result.layout().folderBlocks()).containsExactly("DATE");
		assertThat(result.layout().fileNameBlocks()).containsExactly("NAME");
		assertThat(result.layout().dateFormat()).isEqualTo("YYMMDD");
		assertThat(result.records()).isEqualTo(2);
	}

	@Test
	void detectsMemberFolderAndDateFilePattern() {
		var result = detector.detect(List.of(file("김서연/260810.md"), file("김서연/260811.md")));

		assertThat(result.detected()).isTrue();
		assertThat(result.basePath()).isEmpty();
		assertThat(result.layout().folderBlocks()).containsExactly("NAME");
		assertThat(result.layout().fileNameBlocks()).containsExactly("DATE");
	}

	@Test
	void doesNotApplyAnAmbiguousSingleMatch() {
		var result = detector.detect(List.of(file("study/260810/김서연.md"), file("docs/notes.md"), file("src/spec.md")));

		assertThat(result.detected()).isFalse();
	}

	@Test
	void prefersTheFullYearMonthDateStructureOverANestedPartialMatch() {
		var result = detector.detect(List.of(
			file("study/2026/08/2026-08-10/김서연.md"), file("study/2026/08/2026-08-11/김서연.md")
		));

		assertThat(result.basePath()).isEqualTo("study");
		assertThat(result.layout().folderBlocks()).containsExactly("YEAR", "MONTH", "DATE");
	}

	private static TreeEntry file(String path) {
		String name = path.substring(path.lastIndexOf('/') + 1);
		return new TreeEntry(path, name, "blob", path, "100644");
	}
}
