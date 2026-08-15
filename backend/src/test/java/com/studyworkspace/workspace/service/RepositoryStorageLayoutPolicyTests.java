package com.studyworkspace.workspace.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import com.studyworkspace.workspace.domain.RepositoryStorageLayout;
import com.studyworkspace.workspace.domain.WorkspaceException;
import com.studyworkspace.workspace.domain.WorkspaceModels.SessionItem;
import com.studyworkspace.workspace.domain.WorkspaceModels.StudyMember;
import org.junit.jupiter.api.Test;

class RepositoryStorageLayoutPolicyTests {
	private final RepositoryStorageLayoutPolicy policy = new RepositoryStorageLayoutPolicy();

	@Test
	void buildsAndMatchesRecommendedSubmissionPath() {
		var session = SessionYamlParserTests.validSession();
		var member = member();
		String path = policy.submissionPath("study", RepositoryStorageLayout.recommended(), session, member, null);

		assertThat(path).isEqualTo("study/2026/08/09/Owner.md");
		assertThat(policy.matchSubmission("study", RepositoryStorageLayout.recommended(), path))
			.isNotNull().extracting("date").isEqualTo("2026-08-09");
	}

	@Test
	void migratesStoredLegacyDateAsTheSeparateDayBlock() {
		var legacy = new RepositoryStorageLayout(
			List.of("YEAR", "MONTH", "DATE"), List.of("NAME"), "YYYY", "MM", "DD", null, "md"
		);

		assertThat(legacy.folderBlocks()).containsExactly("YEAR", "MONTH", "DAY");
		assertThat(legacy.dateFormat()).isEqualTo("YYMMDD");
		assertThat(legacy.dayFormat()).isEqualTo("DD");
		assertThat(policy.validate(legacy)).isEqualTo(legacy);
	}

	@Test
	void supportsNameFirstAndCompactDateFiles() {
		var layout = new RepositoryStorageLayout(
			List.of("NAME", "YEAR", "MONTH"), List.of("DATE"), "YY", "M", "YYMMDD", "md"
		);
		String path = policy.submissionPath("records", layout, SessionYamlParserTests.validSession(), member(), null);

		assertThat(path).isEqualTo("records/Owner/26/8/260809.md");
		assertThat(policy.matchSubmission("records", layout, path).date()).isEqualTo("2026-08-09");
	}

	@Test
	void requiresUniqueDateAndNameBlocks() {
		var missingDate = new RepositoryStorageLayout(List.of("YEAR"), List.of("NAME"), "YYYY", "MM", "YYYY-MM-DD", "md");
		var duplicateName = new RepositoryStorageLayout(List.of("DATE", "NAME"), List.of("NAME"), "YYYY", "MM", "YYYY-MM-DD", "md");

		assertThatThrownBy(() -> policy.validate(missingDate)).isInstanceOf(WorkspaceException.class)
			.extracting("code").isEqualTo("INVALID_STORAGE_LAYOUT");
		assertThatThrownBy(() -> policy.validate(duplicateName)).isInstanceOf(WorkspaceException.class)
			.extracting("code").isEqualTo("INVALID_STORAGE_LAYOUT");
	}

	@Test
	void rejectsInvalidTemporalHierarchy() {
		var invalid = new RepositoryStorageLayout(
			List.of("YEAR", "DAY", "MONTH"), List.of("NAME"), "YYYY", "MM", "YYMMDD", "DD", "md"
		);

		assertThatThrownBy(() -> policy.validate(invalid)).isInstanceOf(WorkspaceException.class)
			.hasMessageContaining("연도, 월, 날짜 또는 일 순서")
			.extracting("code").isEqualTo("INVALID_STORAGE_LAYOUT");
	}

	@Test
	void rejectsFullDateCombinedWithSeparateDay() {
		var invalid = new RepositoryStorageLayout(
			List.of("YEAR", "MONTH", "DATE", "DAY"), List.of("NAME"), "YYYY", "MM", "YYMMDD", "DD", "md"
		);

		assertThatThrownBy(() -> policy.validate(invalid)).isInstanceOf(WorkspaceException.class)
			.hasMessageContaining("날짜와 일 블록은 함께 사용할 수 없습니다")
			.extracting("code").isEqualTo("INVALID_STORAGE_LAYOUT");
	}

	@Test
	void reconstructsDateFromSeparatedYearMonthAndDay() {
		var layout = new RepositoryStorageLayout(
			List.of("YEAR", "MONTH", "DAY"), List.of("NAME"), "YYYY", "MM", "YYMMDD", "DD", "md"
		);
		String path = policy.submissionPath("study", layout, SessionYamlParserTests.validSession(), member(), null);

		assertThat(path).isEqualTo("study/2026/08/09/Owner.md");
		assertThat(policy.matchSubmission("study", layout, path).date()).isEqualTo("2026-08-09");
	}

	@Test
	void supportsYearMonthInMonthBlockAndLocalizedDay() {
		var layout = new RepositoryStorageLayout(
			List.of("MONTH", "DAY"), List.of("NAME"), "YYYY", "YY-MM", "YYMMDD", "DD_KO", "md"
		);
		String path = policy.submissionPath("study", layout, SessionYamlParserTests.validSession(), member(), null);

		assertThat(path).isEqualTo("study/26-08/09일/Owner.md");
		assertThat(policy.matchSubmission("study", layout, path).date()).isEqualTo("2026-08-09");
	}

	@Test
	void supportsFullDateWithoutSeparateTemporalBlocks() {
		for (String format : List.of("YYYY-MM-DD", "YYYYMMDD", "YY-MM-DD", "YYMMDD", "YYYY_MM_DD_KO", "YY_MM_DD_KO")) {
			var layout = new RepositoryStorageLayout(List.of("DATE"), List.of("NAME"), "YYYY", "MM", format, "md");
			String path = policy.submissionPath("study", layout, SessionYamlParserTests.validSession(), member(), null);

			assertThat(policy.matchSubmission("study", layout, path).date()).isEqualTo("2026-08-09");
		}
	}

	@Test
	void supportsLocalizedYearMonthAndDaySegments() {
		var layout = new RepositoryStorageLayout(
			List.of("YEAR", "MONTH", "DAY"), List.of("NAME"), "YYYY_KO", "MM_KO", "YYMMDD", "DD_KO", "md"
		);
		String path = policy.submissionPath("study", layout, SessionYamlParserTests.validSession(), member(), null);

		assertThat(path).isEqualTo("study/2026년/08월/09일/Owner.md");
		assertThat(policy.matchSubmission("study", layout, path).date()).isEqualTo("2026-08-09");
	}

	@Test
	void supportsFullDateBelowMonthFolder() {
		var layout = new RepositoryStorageLayout(
			List.of("MONTH", "DATE"), List.of("NAME"), "YYYY", "MM", "YYMMDD", "DD", "md"
		);
		String path = policy.submissionPath("study", layout, SessionYamlParserTests.validSession(), member(), null);

		assertThat(path).isEqualTo("study/08/260809/Owner.md");
		assertThat(policy.matchSubmission("study", layout, path).date()).isEqualTo("2026-08-09");
	}

	@Test
	void supportsEitherNameOrFullDateAsTheSingleFileNameBlock() {
		var nameFile = new RepositoryStorageLayout(
			List.of("YEAR", "MONTH", "DATE"), List.of("NAME"), "YYYY", "MM", "YYMMDD", "DD", "md"
		);
		var dateFile = new RepositoryStorageLayout(
			List.of("YEAR", "MONTH", "NAME"), List.of("DATE"), "YYYY", "MM", "YYMMDD", "DD", "md"
		);

		assertThat(policy.submissionPath("study", nameFile, SessionYamlParserTests.validSession(), member(), null))
			.isEqualTo("study/2026/08/260809/Owner.md");
		assertThat(policy.submissionPath("study", dateFile, SessionYamlParserTests.validSession(), member(), null))
			.isEqualTo("study/2026/08/Owner/260809.md");
		assertThat(policy.matchSubmission("study", dateFile,
			"study/2026/08/Owner/260809.md").date()).isEqualTo("2026-08-09");
	}

	@Test
	void rejectsMultipleOrUnsupportedFileNameBlocks() {
		var multiple = new RepositoryStorageLayout(
			List.of("YEAR", "MONTH", "DAY"), List.of("NAME", "DATE"), "YYYY", "MM", "YYMMDD", "DD", "md"
		);
		var itemFile = new RepositoryStorageLayout(
			List.of("DATE", "NAME"), List.of("ITEM"), "YYYY", "MM", "YYMMDD", "DD", "md"
		);

		assertThatThrownBy(() -> policy.validate(multiple)).hasMessageContaining("날짜 또는 이름");
		assertThatThrownBy(() -> policy.validate(itemFile)).hasMessageContaining("날짜 또는 이름");
	}

	@Test
	void itemBlockCreatesAStablePerItemFile() {
		var layout = new RepositoryStorageLayout(List.of("DATE", "ITEM"), List.of("NAME"), "YYYY", "MM", "YYYY-MM-DD", "DD", "md");
		SessionItem item = SessionYamlParserTests.validSession().items().getFirst();

		assertThat(policy.submissionPath("study", layout, SessionYamlParserTests.validSession(), member(), item))
			.isEqualTo("study/2026-08-09/" + item.id() + "/Owner.md");
	}

	@Test
	void rejectsTheWorkspaceConfigFileAsABasePath() {
		assertThatThrownBy(() -> policy.validateBasePath(".study-workspace/config.yml", List.of()))
			.isInstanceOf(WorkspaceException.class)
			.extracting("code").isEqualTo("INVALID_STORAGE_LAYOUT");
	}

	private static StudyMember member() {
		return new StudyMember("member-7", 7, "owner", "Owner", "O", "#000", "Owner.md", "OWNER", "ACTIVE", 40);
	}
}
