package com.studyworkspace.workspace.domain;

import java.util.List;

/** Provider-neutral description of user-visible learning record paths. */
public record RepositoryStorageLayout(
	List<String> folderBlocks,
	List<String> fileNameBlocks,
	String yearFormat,
	String monthFormat,
	String dateFormat,
	String dayFormat,
	String extension
) {
	public RepositoryStorageLayout {
		boolean legacyDay = isLegacyDayFormat(dateFormat);
		folderBlocks = folderBlocks == null ? List.of() : List.copyOf(migrateLegacyDay(folderBlocks, dateFormat));
		fileNameBlocks = fileNameBlocks == null ? List.of() : List.copyOf(migrateLegacyDay(fileNameBlocks, dateFormat));
		yearFormat = valueOr(yearFormat, "YYYY");
		monthFormat = valueOr(monthFormat, "MM");
		dayFormat = valueOr(dayFormat, legacyDay ? dateFormat : "DD");
		dateFormat = valueOr(legacyDay ? null : dateFormat, "YYMMDD");
		extension = valueOr(extension, "md");
	}

	/** Transitional constructor for stored V1 custom layouts without a separate DAY format. */
	public RepositoryStorageLayout(List<String> folderBlocks, List<String> fileNameBlocks, String yearFormat,
		String monthFormat, String dateFormat, String extension) {
		this(migrateLegacyDay(folderBlocks, dateFormat), migrateLegacyDay(fileNameBlocks, dateFormat),
			yearFormat, monthFormat, isLegacyDayFormat(dateFormat) ? "YYMMDD" : dateFormat,
			isLegacyDayFormat(dateFormat) ? dateFormat : "DD", extension);
	}

	public static RepositoryStorageLayout recommended() {
		return new RepositoryStorageLayout(
			List.of("YEAR", "MONTH", "DAY"), List.of("NAME"),
			"YYYY", "MM", "YYMMDD", "DD", "md"
		);
	}

	public boolean usesItemFiles() {
		return folderBlocks.contains("ITEM") || fileNameBlocks.contains("ITEM");
	}

	private static String valueOr(String value, String fallback) {
		return value == null || value.isBlank() ? fallback : value.trim();
	}

	private static boolean isLegacyDayFormat(String format) {
		return "DD".equals(format) || "DD_KO".equals(format);
	}

	private static List<String> migrateLegacyDay(List<String> blocks, String dateFormat) {
		if (blocks == null || !isLegacyDayFormat(dateFormat)) return blocks;
		return blocks.stream().map(block -> "DATE".equals(block) ? "DAY" : block).toList();
	}
}
