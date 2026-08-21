package com.studyworkspace.workspace.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.util.List;

import com.studyworkspace.workspace.domain.RepositoryStorageLayout;
import com.studyworkspace.workspace.domain.WorkspaceException;
import com.studyworkspace.workspace.domain.WorkspaceModels.StudyMember;
import org.junit.jupiter.api.Test;

class RepositoryStorageLayoutPolicyTests {
	private final RepositoryStorageLayoutPolicy policy = new RepositoryStorageLayoutPolicy();

	@Test
	void buildsAndMatchesRecommendedSubmissionPath() {
		var session = SessionYamlParserTests.validSession();
		var member = member();
		String path = policy.submissionPath("study", RepositoryStorageLayout.recommended(), session, member);

		assertThat(path).isEqualTo("study/2026-08/09/Owner.md");
		assertThat(policy.matchSubmission("study", RepositoryStorageLayout.recommended(), path))
			.isNotNull().extracting("date").isEqualTo("2026-08-09");
		assertThat(policy.sessionPath("study", RepositoryStorageLayout.recommended(), session))
			.isEqualTo("study/2026-08/09/session.yml");
		assertThat(policy.matchSession("study", RepositoryStorageLayout.recommended(), "study/2026-08/09/session.yml").date())
			.isEqualTo("2026-08-09");
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
		String path = policy.submissionPath("records", layout, SessionYamlParserTests.validSession(), member());

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
		String path = policy.submissionPath("study", layout, SessionYamlParserTests.validSession(), member());

		assertThat(path).isEqualTo("study/2026/08/09/Owner.md");
		assertThat(policy.matchSubmission("study", layout, path).date()).isEqualTo("2026-08-09");
	}

	@Test
	void supportsYearMonthInMonthBlockAndLocalizedDay() {
		var layout = new RepositoryStorageLayout(
			List.of("MONTH", "DAY"), List.of("NAME"), "YYYY", "YY-MM", "YYMMDD", "DD_KO", "md"
		);
		String path = policy.submissionPath("study", layout, SessionYamlParserTests.validSession(), member());

		assertThat(path).isEqualTo("study/26-08/09일/Owner.md");
		assertThat(policy.matchSubmission("study", layout, path).date()).isEqualTo("2026-08-09");
	}

	@Test
	void supportsFullDateWithoutSeparateTemporalBlocks() {
		for (String format : List.of("YYYY-MM-DD", "YYYYMMDD", "YY-MM-DD", "YYMMDD", "YYYY_MM_DD_KO", "YY_MM_DD_KO", "YYYY_MM_DD_KO_SPACE", "YY_MM_DD_KO_SPACE")) {
			var layout = new RepositoryStorageLayout(List.of("DATE"), List.of("NAME"), "YYYY", "MM", format, "md");
			String path = policy.submissionPath("study", layout, SessionYamlParserTests.validSession(), member());

			assertThat(policy.matchSubmission("study", layout, path).date()).isEqualTo("2026-08-09");
			String sessionPath = policy.sessionPath("study", layout, SessionYamlParserTests.validSession());
			assertThat(policy.matchSession("study", layout, sessionPath).date()).isEqualTo("2026-08-09");
		}
	}

	@Test
	void supportsSpacedLocalizedFullDateWithoutBreakingLegacyHyphenFormat() {
		var spaced = new RepositoryStorageLayout(
			List.of("DATE"), List.of("NAME"), "YYYY", "MM", "YYYY_MM_DD_KO_SPACE", "DD", "md"
		);
		var legacy = new RepositoryStorageLayout(
			List.of("DATE"), List.of("NAME"), "YYYY", "MM", "YYYY_MM_DD_KO", "DD", "md"
		);

		String spacedPath = policy.submissionPath("study", spaced, SessionYamlParserTests.validSession(), member());
		String legacyPath = policy.submissionPath("study", legacy, SessionYamlParserTests.validSession(), member());

		assertThat(spacedPath).isEqualTo("study/2026년 08월 09일/Owner.md");
		assertThat(policy.matchSubmission("study", spaced, spacedPath).date()).isEqualTo("2026-08-09");
		assertThat(legacyPath).isEqualTo("study/2026년-08월-09일/Owner.md");
		assertThat(policy.matchSubmission("study", legacy, legacyPath).date()).isEqualTo("2026-08-09");
	}

	@Test
	void roundTripsEverySeparatedTemporalFormat() {
		for (String year : List.of("YYYY", "YY", "YYYY_KO", "YY_KO")) {
			for (String month : List.of("MM", "M", "MM_KO", "M_KO")) {
				for (String day : List.of("DD", "DD_KO")) {
					var layout = new RepositoryStorageLayout(
						List.of("YEAR", "MONTH", "DAY"), List.of("NAME"), year, month, "YYMMDD", day, "md"
					);
					String path = policy.submissionPath("study", layout, SessionYamlParserTests.validSession(), member());
					assertThat(policy.matchSubmission("study", layout, path).date()).isEqualTo("2026-08-09");
				}
			}
		}
		for (String month : List.of("YYYY-MM", "YY-MM", "YYYYMM", "YYMM", "YYYY_MM_KO", "YY_MM_KO")) {
			var layout = new RepositoryStorageLayout(
				List.of("MONTH", "DAY"), List.of("NAME"), "YYYY", month, "YYMMDD", "DD", "md"
			);
			String path = policy.submissionPath("study", layout, SessionYamlParserTests.validSession(), member());
			assertThat(policy.matchSubmission("study", layout, path).date()).isEqualTo("2026-08-09");
		}
	}

	@Test
	void supportsCompactYearMonthWithoutSeparator() {
		var layout = new RepositoryStorageLayout(
			List.of("MONTH", "DAY"), List.of("NAME"), "YYYY", "YYMM", "YYMMDD", "DD", "md"
		);
		String path = policy.submissionPath("study", layout, SessionYamlParserTests.validSession(), member());

		assertThat(path).isEqualTo("study/2608/09/Owner.md");
		assertThat(policy.matchSubmission("study", layout, path).date()).isEqualTo("2026-08-09");
	}

	@Test
	void supportsLocalizedYearMonthAndDaySegments() {
		var layout = new RepositoryStorageLayout(
			List.of("YEAR", "MONTH", "DAY"), List.of("NAME"), "YYYY_KO", "MM_KO", "YYMMDD", "DD_KO", "md"
		);
		String path = policy.submissionPath("study", layout, SessionYamlParserTests.validSession(), member());

		assertThat(path).isEqualTo("study/2026년/08월/09일/Owner.md");
		assertThat(policy.matchSubmission("study", layout, path).date()).isEqualTo("2026-08-09");
	}

	@Test
	void supportsFullDateBelowMonthFolder() {
		var layout = new RepositoryStorageLayout(
			List.of("MONTH", "DATE"), List.of("NAME"), "YYYY", "MM", "YYMMDD", "DD", "md"
		);
		String path = policy.submissionPath("study", layout, SessionYamlParserTests.validSession(), member());

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

		assertThat(policy.submissionPath("study", nameFile, SessionYamlParserTests.validSession(), member()))
			.isEqualTo("study/2026/08/260809/Owner.md");
		assertThat(policy.submissionPath("study", dateFile, SessionYamlParserTests.validSession(), member()))
			.isEqualTo("study/2026/08/Owner/260809.md");
		assertThat(policy.matchSubmission("study", dateFile,
			"study/2026/08/Owner/260809.md").date()).isEqualTo("2026-08-09");
	}

	@Test
	void rejectsMultipleOrUnsupportedFileNameBlocks() {
		var multiple = new RepositoryStorageLayout(
			List.of("YEAR", "MONTH", "DAY"), List.of("NAME", "DATE"), "YYYY", "MM", "YYMMDD", "DD", "md"
		);
		var unsupported = new RepositoryStorageLayout(
			List.of("DATE", "NAME"), List.of("UNKNOWN"), "YYYY", "MM", "YYMMDD", "DD", "md"
		);

		assertThatThrownBy(() -> policy.validate(multiple)).hasMessageContaining("날짜 또는 이름");
		assertThatThrownBy(() -> policy.validate(unsupported)).isInstanceOf(WorkspaceException.class)
			.extracting("code").isEqualTo("INVALID_STORAGE_LAYOUT");
	}

	@Test
	void rejectsMismatchedDuplicateTemporalComponents() {
		var layout = new RepositoryStorageLayout(
			List.of("YEAR", "MONTH", "DATE"), List.of("NAME"), "YYYY", "MM", "YYMMDD", "DD", "md"
		);

		assertThatThrownBy(() -> policy.matchSubmission("study", layout, "study/2026/09/260809/Owner.md"))
			.isInstanceOf(WorkspaceException.class)
			.extracting("code").isEqualTo("TEMPORAL_COMPONENT_MISMATCH");
	}

	@Test
	void mapsAllTwoDigitYearsToTheTwentyFirstCentury() {
		var layout = new RepositoryStorageLayout(List.of("DATE"), List.of("NAME"), "YYYY", "MM", "YYMMDD", "DD", "md");

		assertThat(policy.matchSubmission("study", layout, "study/000101/Owner.md").date()).isEqualTo("2000-01-01");
		assertThat(policy.matchSubmission("study", layout, "study/991231/Owner.md").date()).isEqualTo("2099-12-31");
	}

	@Test
	void rejectsTheReservedWorkspaceSystemFolderAsABasePathOrMemberName() {
		assertThatThrownBy(() -> policy.validateBasePath("study/.study-workspace", List.of()))
			.isInstanceOf(WorkspaceException.class)
			.extracting("code").isEqualTo("INVALID_STORAGE_LAYOUT");
		assertThatThrownBy(() -> policy.submissionPath("study", RepositoryStorageLayout.recommended(),
			SessionYamlParserTests.validSession(), new StudyMember("member", 8, "user", "User", "U", "#000",
				".study-workspace.md", "MEMBER", "ACTIVE", 30)))
			.isInstanceOf(WorkspaceException.class).extracting("code").isEqualTo("INVALID_STORAGE_LAYOUT");
	}

	@Test
	void rejectsUnsafeRawBasePathsAndMemberSegmentsWithoutSanitizingThem() {
		assertThatThrownBy(() -> policy.validateBasePath("/study", List.of())).isInstanceOf(WorkspaceException.class)
			.extracting("code").isEqualTo("INVALID_STORAGE_LAYOUT");
		assertThatThrownBy(() -> policy.validateBasePath("study/../private", List.of())).isInstanceOf(WorkspaceException.class);
		assertThatThrownBy(() -> policy.submissionPath("study", RepositoryStorageLayout.recommended(),
			SessionYamlParserTests.validSession(), new StudyMember("member", 8, "user", "User", "U", "#000",
				"../private.md", "MEMBER", "ACTIVE", 30)))
			.isInstanceOf(WorkspaceException.class).extracting("code").isEqualTo("INVALID_STORAGE_LAYOUT");
	}

	@Test
	void rejectsUnicodeFormatCharactersInBasePathsAndMemberNames() {
		List<String> formatCharacters = List.of(
			"\u202A", "\u202B", "\u202C", "\u202D", "\u202E",
			"\u2066", "\u2067", "\u2068", "\u2069", "\u200B"
		);

		for (String formatCharacter : formatCharacters) {
			assertThatThrownBy(() -> policy.validateBasePath("study/" + formatCharacter + "algorithm", List.of()))
				.isInstanceOf(WorkspaceException.class)
				.extracting("code").isEqualTo("INVALID_STORAGE_LAYOUT");
			assertThatThrownBy(() -> policy.submissionPath("study", RepositoryStorageLayout.recommended(),
				SessionYamlParserTests.validSession(), new StudyMember("member", 8, "user", "User", "U", "#000",
					"김" + formatCharacter + "서연.md", "MEMBER", "ACTIVE", 30)))
				.isInstanceOf(WorkspaceException.class)
				.extracting("code").isEqualTo("INVALID_STORAGE_LAYOUT");
		}
	}

	@Test
	void preservesNormalKoreanAndPreviouslyAllowedUnicodeSegments() {
		assertThat(policy.validateBasePath("학습/알고리즘", List.of())).isEqualTo("학습/알고리즘");
		assertThat(policy.submissionPath("study", RepositoryStorageLayout.recommended(),
			SessionYamlParserTests.validSession(), new StudyMember("member", 8, "user", "User", "U", "#000",
				"김서연😀.md", "MEMBER", "ACTIVE", 30)))
			.isEqualTo("study/2026-08/09/김서연😀.md");
	}

	@Test
	void rejectsResolvedMemberPathCollisionsAndOverlongPaths() {
		StudyMember duplicate = new StudyMember("member-8", 8, "other", "Other", "O", "#111", "owner.md", "MEMBER", "ACTIVE", 30);
		assertThatThrownBy(() -> policy.validateMemberNames(
			RepositoryStorageLayout.recommended(), "study", LocalDate.of(2026, 8, 9), List.of(member(), duplicate)
		)).isInstanceOf(WorkspaceException.class).hasMessageContaining("충돌");

		String longBase = "a".repeat(80) + "/" + "b".repeat(80) + "/" + "c".repeat(70);
		assertThatThrownBy(() -> policy.submissionPath(
			longBase, RepositoryStorageLayout.recommended(), SessionYamlParserTests.validSession(), member()
		)).isInstanceOf(WorkspaceException.class).hasMessageContaining("너무 깁니다");
	}

	private static StudyMember member() {
		return new StudyMember("member-7", 7, "owner", "Owner", "O", "#000", "Owner.md", "OWNER", "ACTIVE", 40);
	}
}
