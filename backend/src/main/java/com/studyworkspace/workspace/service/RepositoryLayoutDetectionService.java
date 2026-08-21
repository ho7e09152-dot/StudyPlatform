package com.studyworkspace.workspace.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import com.studyworkspace.workspace.domain.RepositoryStorageLayout;
import com.studyworkspace.workspace.port.RepositoryDataPort;
import org.springframework.stereotype.Component;

@Component
public class RepositoryLayoutDetectionService {
	private static final double MIN_CONFIDENCE = 0.60;
	private static final int MIN_RECORDS = 2;

	public Detection detect(List<RepositoryDataPort.TreeEntry> tree) {
		List<String> markdown = tree.stream()
			.filter(entry -> "blob".equals(entry.type()))
			.map(RepositoryDataPort.TreeEntry::path)
			.filter(path -> path.toLowerCase(Locale.ROOT).endsWith(".md"))
			.filter(path -> !fileName(path).equalsIgnoreCase("README.md"))
			.filter(path -> !path.startsWith(".study-workspace/"))
			.toList();
		if (markdown.size() < MIN_RECORDS) return Detection.none();

		Map<Key, Integer> matches = new LinkedHashMap<>();
		for (String path : markdown) {
			String[] parts = path.split("/");
			String stem = stem(parts[parts.length - 1]);
			if (parts.length >= 2) {
				DateFormat dateFolder = dateFormat(parts[parts.length - 2]);
				if (dateFolder != null && hasYear(dateFolder.value)) add(matches, new Key(
					prefix(parts, parts.length - 2), List.of("DATE"), List.of("NAME"),
					"YYYY", "MM", dateFolder.value
				));
				DateFormat dateFile = dateFormat(stem);
				if (dateFile != null && hasYear(dateFile.value)) add(matches, new Key(
					prefix(parts, parts.length - 2), List.of("NAME"), List.of("DATE"),
					"YYYY", "MM", dateFile.value
				));
			}
			if (parts.length >= 4 && yearFormat(parts[parts.length - 4]) != null
				&& monthFormat(parts[parts.length - 3]) != null && dateFormat(parts[parts.length - 2]) != null) {
				add(matches, new Key(
					prefix(parts, parts.length - 4), List.of("YEAR", "MONTH", "DATE"), List.of("NAME"),
					yearFormat(parts[parts.length - 4]), monthFormat(parts[parts.length - 3]),
					dateFormat(parts[parts.length - 2]).value
				));
			}
		}
		Map.Entry<Key, Integer> best = matches.entrySet().stream()
			.max(Comparator.<Map.Entry<Key, Integer>>comparingInt(Map.Entry::getValue)
				.thenComparingInt(entry -> entry.getKey().folderBlocks.size())
				.thenComparing(entry -> entry.getKey().basePath))
			.orElse(null);
		if (best == null) return Detection.none();
		double confidence = best.getValue() / (double) markdown.size();
		if (best.getValue() < MIN_RECORDS || confidence < MIN_CONFIDENCE) return Detection.none();
		Key key = best.getKey();
		return new Detection(
			key.basePath,
			new RepositoryStorageLayout(key.folderBlocks, key.fileBlocks, key.yearFormat, key.monthFormat, key.dateFormat, "md"),
			confidence,
			best.getValue()
		);
	}

	private static void add(Map<Key, Integer> matches, Key key) {
		matches.merge(key, 1, Integer::sum);
	}

	private static String prefix(String[] parts, int endExclusive) {
		if (endExclusive <= 0) return "";
		List<String> values = new ArrayList<>();
		for (int index = 0; index < endExclusive; index++) values.add(parts[index]);
		return String.join("/", values);
	}

	private static String stem(String fileName) {
		return fileName.toLowerCase(Locale.ROOT).endsWith(".md") ? fileName.substring(0, fileName.length() - 3) : fileName;
	}

	private static String fileName(String path) {
		int slash = path.lastIndexOf('/');
		return slash < 0 ? path : path.substring(slash + 1);
	}

	private static String yearFormat(String value) {
		if (value.matches("20\\d{2}")) return "YYYY";
		if (value.matches("\\d{2}")) return "YY";
		return null;
	}

	private static String monthFormat(String value) {
		if (value.matches("0[1-9]|1[0-2]")) return "MM";
		if (value.matches("[1-9]|1[0-2]")) return "M";
		if (value.matches("20\\d{2}-(0[1-9]|1[0-2])")) return "YYYY-MM";
		return null;
	}

	private static DateFormat dateFormat(String value) {
		if (value.matches("20\\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])")) return new DateFormat("YYYY-MM-DD");
		if (value.matches("\\d{6}")) return new DateFormat("YYMMDD");
		if (value.matches("(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])")) return new DateFormat("MM-DD");
		if (value.matches("(0[1-9]|1[0-2])(0[1-9]|[12]\\d|3[01])")) return new DateFormat("MMDD");
		return null;
	}

	private static boolean hasYear(String format) {
		return "YYYY-MM-DD".equals(format) || "YYMMDD".equals(format);
	}

	public record Detection(String basePath, RepositoryStorageLayout layout, double confidence, int records) {
		public static Detection none() { return new Detection(null, null, 0, 0); }
		public boolean detected() { return layout != null; }
	}

	private record DateFormat(String value) { }
	private record Key(
		String basePath, List<String> folderBlocks, List<String> fileBlocks,
		String yearFormat, String monthFormat, String dateFormat
	) { }
}
