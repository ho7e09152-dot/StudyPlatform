package com.studyworkspace.workspace.service;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.studyworkspace.workspace.domain.WorkspaceException;
import com.studyworkspace.workspace.domain.WorkspaceModels.StudySession;
import com.studyworkspace.workspace.domain.WorkspaceModels.WorkspaceState;

public final class WorkspaceRepositoryLayout {
	public static final int LEGACY_SCHEMA_VERSION = 1;
	public static final int CURRENT_SCHEMA_VERSION = 2;
	public static final String MANAGED_BASE_PATH = ".study-workspace";
	public static final String CONFIG_PATH = MANAGED_BASE_PATH + "/config.yml";

	private static final Pattern V1_SESSION = Pattern.compile("^(\\d{6})/session\\.yml$");
	private static final Pattern V1_SUBMISSION = Pattern.compile("^(\\d{6})/([^/]+\\.md)$");
	private static final Pattern V2_SESSION = Pattern.compile("^sessions/(\\d{4})/(\\d{4}-\\d{2}-\\d{2})/session\\.yml$");
	private static final Pattern V2_SUBMISSION = Pattern.compile("^sessions/(\\d{4})/(\\d{4}-\\d{2}-\\d{2})/submissions/([^/]+\\.md)$");

	private WorkspaceRepositoryLayout() { }

	public static String sessionPath(WorkspaceState workspace, StudySession session) {
		return WorkspaceRepositoryPath.join(
			workspace.repositoryBasePath(),
			relativeSessionPath(schemaVersion(workspace.repositorySchemaVersion()), session.date(), session.folder())
		);
	}

	public static String submissionPath(WorkspaceState workspace, StudySession session, String fileName) {
		return WorkspaceRepositoryPath.join(
			workspace.repositoryBasePath(),
			relativeSubmissionPath(schemaVersion(workspace.repositorySchemaVersion()), session.date(), session.folder(), fileName)
		);
	}

	public static String relativeSessionPath(int schemaVersion, String date, String folder) {
		if (schemaVersion == LEGACY_SCHEMA_VERSION) return requiredFolder(folder) + "/session.yml";
		LocalDate parsed = requiredDate(date);
		return "sessions/" + parsed.getYear() + "/" + parsed + "/session.yml";
	}

	public static String relativeSubmissionPath(int schemaVersion, String date, String folder, String fileName) {
		if (schemaVersion == LEGACY_SCHEMA_VERSION) return requiredFolder(folder) + "/" + fileName;
		LocalDate parsed = requiredDate(date);
		return "sessions/" + parsed.getYear() + "/" + parsed + "/submissions/" + fileName;
	}

	public static Optional<SessionLocation> matchSession(String relativePath, int schemaVersion) {
		if (schemaVersion == LEGACY_SCHEMA_VERSION) {
			Matcher matcher = V1_SESSION.matcher(value(relativePath));
			return matcher.matches()
				? Optional.of(new SessionLocation(folderDate(matcher.group(1)), matcher.group(1), relativePath))
				: Optional.empty();
		}
		Matcher matcher = V2_SESSION.matcher(value(relativePath));
		if (!matcher.matches() || !validYearAndDate(matcher.group(1), matcher.group(2))) return Optional.empty();
		return Optional.of(new SessionLocation(matcher.group(2), dateFolder(matcher.group(2)), relativePath));
	}

	public static Optional<SubmissionLocation> matchSubmission(String relativePath, int schemaVersion) {
		if (schemaVersion == LEGACY_SCHEMA_VERSION) {
			Matcher matcher = V1_SUBMISSION.matcher(value(relativePath));
			return matcher.matches()
				? Optional.of(new SubmissionLocation(folderDate(matcher.group(1)), matcher.group(1), matcher.group(2), relativePath))
				: Optional.empty();
		}
		Matcher matcher = V2_SUBMISSION.matcher(value(relativePath));
		if (!matcher.matches() || !validYearAndDate(matcher.group(1), matcher.group(2))) return Optional.empty();
		return Optional.of(new SubmissionLocation(matcher.group(2), dateFolder(matcher.group(2)), matcher.group(3), relativePath));
	}

	public static boolean isSessionPath(String relativePath, int schemaVersion) {
		return matchSession(relativePath, schemaVersion).isPresent();
	}

	public static boolean isSubmissionPath(String relativePath, int schemaVersion) {
		return matchSubmission(relativePath, schemaVersion).isPresent();
	}

	public static int schemaVersion(Integer value) {
		int normalized = value == null ? LEGACY_SCHEMA_VERSION : value;
		if (normalized != LEGACY_SCHEMA_VERSION && normalized != CURRENT_SCHEMA_VERSION) {
			throw new WorkspaceException("UNSUPPORTED_REPOSITORY_SCHEMA", "지원하지 않는 저장소 스키마 버전입니다.", 409);
		}
		return normalized;
	}

	public static String dateFolder(String date) {
		LocalDate parsed = requiredDate(date);
		return String.format("%02d%02d%02d", parsed.getYear() % 100, parsed.getMonthValue(), parsed.getDayOfMonth());
	}

	private static String folderDate(String folder) {
		return "20" + folder.substring(0, 2) + "-" + folder.substring(2, 4) + "-" + folder.substring(4, 6);
	}

	private static boolean validYearAndDate(String year, String date) {
		try {
			return Integer.parseInt(year) == LocalDate.parse(date).getYear();
		} catch (DateTimeParseException | NumberFormatException exception) {
			return false;
		}
	}

	private static LocalDate requiredDate(String date) {
		try {
			return LocalDate.parse(date);
		} catch (DateTimeParseException | NullPointerException exception) {
			throw new WorkspaceException("INVALID_REPOSITORY_PATH", "일정 날짜는 YYYY-MM-DD 형식이어야 합니다.", 400);
		}
	}

	private static String requiredFolder(String folder) {
		if (folder == null || !folder.matches("\\d{6}")) {
			throw new WorkspaceException("INVALID_REPOSITORY_PATH", "일정 폴더 형식이 올바르지 않습니다.", 400);
		}
		return folder;
	}

	private static String value(String value) {
		return value == null ? "" : value;
	}

	public record SessionLocation(String date, String folder, String relativePath) { }

	public record SubmissionLocation(String date, String folder, String fileName, String relativePath) { }
}
