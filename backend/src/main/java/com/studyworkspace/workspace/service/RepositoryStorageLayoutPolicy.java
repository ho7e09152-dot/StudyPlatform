package com.studyworkspace.workspace.service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.studyworkspace.workspace.domain.RepositoryStorageLayout;
import com.studyworkspace.workspace.domain.WorkspaceException;
import com.studyworkspace.workspace.domain.WorkspaceModels.SessionItem;
import com.studyworkspace.workspace.domain.WorkspaceModels.StudyMember;
import com.studyworkspace.workspace.domain.WorkspaceModels.StudySession;
import com.studyworkspace.workspace.port.RepositoryDataPort;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class RepositoryStorageLayoutPolicy {
	private static final Set<String> BLOCKS = Set.of("YEAR", "MONTH", "DATE", "DAY", "NAME", "ITEM");
	private static final Set<String> YEAR_FORMATS = Set.of("YYYY", "YY", "YYYY_KO", "YY_KO");
	private static final Set<String> MONTH_FORMATS = Set.of(
		"MM", "M", "YYYY-MM", "YY-MM", "MM_KO", "M_KO", "YYYY_MM_KO", "YY_MM_KO"
	);
	private static final Set<String> DATE_FORMATS = Set.of(
		"YYYY-MM-DD", "YYYYMMDD", "YY-MM-DD", "YYMMDD", "YYYY_MM_DD_KO", "YY_MM_DD_KO"
	);
	private static final Set<String> DAY_FORMATS = Set.of("DD", "DD_KO");
	private static final Set<String> EXTENSIONS = Set.of("md");

	public RepositoryStorageLayout validate(RepositoryStorageLayout raw) {
		if (raw == null) throw invalid("학습 기록 저장 방식이 필요합니다.");
		RepositoryStorageLayout layout = new RepositoryStorageLayout(
			 normalizeBlocks(raw.folderBlocks()), normalizeBlocks(raw.fileNameBlocks()),
			raw.yearFormat(), raw.monthFormat(), raw.dateFormat(), raw.dayFormat(), raw.extension()
		);
		if (layout.fileNameBlocks().size() != 1 || !("DATE".equals(layout.fileNameBlocks().getFirst())
			|| "NAME".equals(layout.fileNameBlocks().getFirst()))) {
			throw invalid("파일 이름은 날짜 또는 이름 중 하나를 선택해 주세요.");
		}
		if (!YEAR_FORMATS.contains(layout.yearFormat())) throw invalid("지원하지 않는 연도 형식입니다.");
		if (!MONTH_FORMATS.contains(layout.monthFormat())) throw invalid("지원하지 않는 월 형식입니다.");
		if (!DATE_FORMATS.contains(layout.dateFormat())) throw invalid("지원하지 않는 날짜 형식입니다.");
		if (!DAY_FORMATS.contains(layout.dayFormat())) throw invalid("지원하지 않는 일 형식입니다.");
		if (!EXTENSIONS.contains(layout.extension().toLowerCase(Locale.ROOT))) throw invalid("현재는 Markdown(.md) 파일만 지원합니다.");

		List<String> all = new ArrayList<>(layout.folderBlocks());
		all.addAll(layout.fileNameBlocks());
		Set<String> unique = new HashSet<>(all);
		if (unique.size() != all.size()) throw invalid("같은 블록은 폴더 구조와 파일 이름에 한 번만 사용할 수 있습니다.");
		if (unique.contains("DATE") && unique.contains("DAY")) {
			throw invalid("날짜와 일 블록은 함께 사용할 수 없습니다. 둘 중 하나만 선택해 주세요.");
		}
		if (!validTemporalOrder(layout.folderBlocks())) throw invalid("시간 블록은 연도, 월, 날짜 또는 일 순서로 배치해야 합니다.");
		if (!unique.contains("DATE") && !unique.contains("DAY")) throw invalid("날짜를 식별할 수 없습니다. 날짜 블록을 추가하거나 연도, 월, 일을 조합해 주세요.");
		if (!unique.contains("NAME")) throw invalid("작성자를 식별할 수 없습니다. 이름 블록을 추가해 주세요.");
		if (unique.contains("DAY") && !unique.contains("DATE")
			&& !(unique.contains("MONTH") && (unique.contains("YEAR")
				|| "YYYY-MM".equals(layout.monthFormat()) || "YY-MM".equals(layout.monthFormat())
				|| "YYYY_MM_KO".equals(layout.monthFormat()) || "YY_MM_KO".equals(layout.monthFormat())))) {
			throw invalid("일 블록을 사용하려면 연도와 월을 함께 식별할 수 있어야 합니다.");
		}
		return layout;
	}

	public String validateBasePath(String rawBasePath, List<RepositoryDataPort.TreeEntry> tree) {
		String basePath = WorkspaceRepositoryPath.normalizeBasePath(rawBasePath);
		if (WorkspaceRepositoryLayout.CONFIG_PATH.equals(basePath)
			|| basePath.startsWith(WorkspaceRepositoryLayout.CONFIG_PATH + "/")) {
			throw invalid("Workspace 설정 파일은 학습 기록 위치로 사용할 수 없습니다.");
		}
		if (!basePath.isEmpty() && tree != null && tree.stream().filter(entry -> "blob".equals(entry.type()))
			.anyMatch(entry -> basePath.equals(entry.path()) || basePath.startsWith(entry.path() + "/"))) {
			throw invalid("선택한 학습 기록 위치의 상위 경로에 파일이 있어 폴더를 만들 수 없습니다.");
		}
		return basePath;
	}

	public String sessionPath(String basePath, StudySession session) {
		return WorkspaceRepositoryPath.join(basePath, ".study-ing/sessions/" + LocalDate.parse(session.date()) + ".yml");
	}

	public String submissionPath(String basePath, RepositoryStorageLayout raw, StudySession session,
		StudyMember member, SessionItem item) {
		RepositoryStorageLayout layout = validate(raw);
		if (layout.usesItemFiles() && item == null) throw invalid("항목별 저장 경로를 만들려면 학습 항목이 필요합니다.");
		LocalDate date = LocalDate.parse(session.date());
		List<String> folders = layout.folderBlocks().stream()
			.map(block -> value(block, layout, date, member, item)).toList();
		String fileName = String.join("-", layout.fileNameBlocks().stream()
			.map(block -> value(block, layout, date, member, item)).toList()) + "." + layout.extension();
		String relative = folders.isEmpty() ? fileName : String.join("/", folders) + "/" + fileName;
		return WorkspaceRepositoryPath.join(basePath, relative);
	}

	public SubmissionLocation matchSubmission(String basePath, RepositoryStorageLayout raw, String fullPath) {
		RepositoryStorageLayout layout = validate(raw);
		String relative = WorkspaceRepositoryPath.relative(basePath, fullPath);
		if (relative == null || relative.startsWith(".study-ing/")) return null;
		List<String> blocks = new ArrayList<>(layout.folderBlocks());
		blocks.addAll(layout.fileNameBlocks());
		StringBuilder expression = new StringBuilder("^");
		List<Capture> captures = new ArrayList<>();
		for (int index = 0; index < layout.folderBlocks().size(); index++) {
			if (index > 0) expression.append('/');
			appendPattern(expression, captures, layout.folderBlocks().get(index), layout);
		}
		if (!layout.folderBlocks().isEmpty()) expression.append('/');
		for (int index = 0; index < layout.fileNameBlocks().size(); index++) {
			if (index > 0) expression.append('-');
			appendPattern(expression, captures, layout.fileNameBlocks().get(index), layout);
		}
		expression.append("\\.").append(Pattern.quote(layout.extension())).append('$');
		Matcher matcher = Pattern.compile(expression.toString()).matcher(relative);
		if (!matcher.matches()) return null;
		Map<String, String> values = new LinkedHashMap<>();
		for (int index = 0; index < captures.size(); index++) {
			String value = matcher.group(index + 1);
			values.put(captures.get(index).block(), value);
		}
		String year = values.containsKey("YEAR") ? parseYear(values.get("YEAR"), layout.yearFormat()) : null;
		String date = parseDate(values.get("DATE"), layout.dateFormat(), values.get("DAY"), layout.dayFormat(),
			year, values.get("MONTH"), layout.monthFormat());
		if (date == null) return null;
		return new SubmissionLocation(date, relative, Map.copyOf(values));
	}

	private static List<String> normalizeBlocks(List<String> raw) {
		if (raw == null) return List.of();
		return raw.stream().map(value -> value == null ? "" : value.trim().toUpperCase(Locale.ROOT)).map(value -> {
			if (!BLOCKS.contains(value)) throw invalid("지원하지 않는 저장 구조 블록입니다: " + value);
			return value;
		}).toList();
	}

	private static String value(String block, RepositoryStorageLayout layout, LocalDate date,
		StudyMember member, SessionItem item) {
		return switch (block) {
			case "YEAR" -> switch (layout.yearFormat()) {
				case "YY" -> String.format("%02d", date.getYear() % 100);
				case "YYYY_KO" -> date.getYear() + "년";
				case "YY_KO" -> String.format("%02d년", date.getYear() % 100);
				default -> Integer.toString(date.getYear());
			};
			case "MONTH" -> switch (layout.monthFormat()) {
				case "M" -> Integer.toString(date.getMonthValue());
				case "YYYY-MM" -> date.format(DateTimeFormatter.ofPattern("yyyy-MM"));
				case "YY-MM" -> date.format(DateTimeFormatter.ofPattern("yy-MM"));
				case "MM_KO" -> date.format(DateTimeFormatter.ofPattern("MM'월'"));
				case "M_KO" -> date.getMonthValue() + "월";
				case "YYYY_MM_KO" -> date.format(DateTimeFormatter.ofPattern("yyyy'년-'MM'월'"));
				case "YY_MM_KO" -> date.format(DateTimeFormatter.ofPattern("yy'년-'MM'월'"));
				default -> String.format("%02d", date.getMonthValue());
			};
			case "DATE" -> switch (layout.dateFormat()) {
				case "YYYYMMDD" -> date.format(DateTimeFormatter.ofPattern("yyyyMMdd"));
				case "YY-MM-DD" -> date.format(DateTimeFormatter.ofPattern("yy-MM-dd"));
				case "YYMMDD" -> date.format(DateTimeFormatter.ofPattern("yyMMdd"));
				case "YYYY_MM_DD_KO" -> date.format(DateTimeFormatter.ofPattern("yyyy'년-'MM'월-'dd'일'"));
				case "YY_MM_DD_KO" -> date.format(DateTimeFormatter.ofPattern("yy'년-'MM'월-'dd'일'"));
				default -> date.toString();
			};
			case "DAY" -> "DD_KO".equals(layout.dayFormat())
				? date.format(DateTimeFormatter.ofPattern("dd'일'")) : date.format(DateTimeFormatter.ofPattern("dd"));
			case "NAME" -> safeStem(member.fileName(), member.displayName());
			case "ITEM" -> safeSegment(item == null ? null : item.id(), "item");
			default -> throw invalid("지원하지 않는 저장 구조 블록입니다.");
		};
	}

	private static void appendPattern(StringBuilder target, List<Capture> captures, String block,
		RepositoryStorageLayout layout) {
		captures.add(new Capture(block));
		target.append('(').append(switch (block) {
			case "YEAR" -> switch (layout.yearFormat()) {
				case "YY" -> "\\d{2}";
				case "YYYY_KO" -> "\\d{4}년";
				case "YY_KO" -> "\\d{2}년";
				default -> "\\d{4}";
			};
			case "MONTH" -> switch (layout.monthFormat()) {
				case "M" -> "(?:[1-9]|1[0-2])";
				case "YYYY-MM" -> "\\d{4}-(?:0[1-9]|1[0-2])";
				case "YY-MM" -> "\\d{2}-(?:0[1-9]|1[0-2])";
				case "MM_KO" -> "(?:0[1-9]|1[0-2])월";
				case "M_KO" -> "(?:[1-9]|1[0-2])월";
				case "YYYY_MM_KO" -> "\\d{4}년-(?:0[1-9]|1[0-2])월";
				case "YY_MM_KO" -> "\\d{2}년-(?:0[1-9]|1[0-2])월";
				default -> "(?:0[1-9]|1[0-2])";
			};
			case "DATE" -> switch (layout.dateFormat()) {
				case "YYYYMMDD" -> "\\d{8}";
				case "YY-MM-DD" -> "\\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])";
				case "YYMMDD" -> "\\d{6}";
				case "YYYY_MM_DD_KO" -> "\\d{4}년-(?:0[1-9]|1[0-2])월-(?:0[1-9]|[12]\\d|3[01])일";
				case "YY_MM_DD_KO" -> "\\d{2}년-(?:0[1-9]|1[0-2])월-(?:0[1-9]|[12]\\d|3[01])일";
				default -> "\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])";
			};
			case "DAY" -> "DD_KO".equals(layout.dayFormat())
				? "(?:0[1-9]|[12]\\d|3[01])일" : "(?:0[1-9]|[12]\\d|3[01])";
			case "NAME", "ITEM" -> "[^/]+?";
			default -> throw invalid("지원하지 않는 저장 구조 블록입니다.");
		}).append(')');
	}

	private static String parseYear(String value, String format) {
		String normalized = value.endsWith("년") ? value.substring(0, value.length() - 1) : value;
		return "YY".equals(format) || "YY_KO".equals(format) ? "20" + normalized : normalized;
	}

	private static String parseDate(String value, String format, String dayValue, String dayFormat,
		String explicitYear, String explicitMonth, String monthFormat) {
		try {
			if (value == null) {
				if (dayValue == null) return null;
				String normalizedMonth = explicitMonth == null ? null : explicitMonth.replace("년-", "-").replace("월", "");
				String yearMonth = "YYYY-MM".equals(monthFormat) || "YYYY_MM_KO".equals(monthFormat) ? normalizedMonth
					: ("YY-MM".equals(monthFormat) || "YY_MM_KO".equals(monthFormat)) && normalizedMonth != null ? "20" + normalizedMonth
					: explicitYear == null || explicitMonth == null ? null
					: explicitYear + "-" + String.format("%02d", Integer.parseInt(normalizedMonth));
				String day = "DD_KO".equals(dayFormat) ? dayValue.substring(0, dayValue.length() - 1) : dayValue;
				return yearMonth == null ? null : LocalDate.parse(yearMonth + "-" + day).toString();
			}
			return switch (format) {
				case "YYYYMMDD" -> LocalDate.parse(value, DateTimeFormatter.ofPattern("yyyyMMdd")).toString();
				case "YY-MM-DD" -> LocalDate.parse("20" + value).toString();
				case "YYMMDD" -> LocalDate.parse("20" + value, DateTimeFormatter.ofPattern("yyyyMMdd")).toString();
				case "YYYY_MM_DD_KO" -> LocalDate.parse(value.replace("년-", "-").replace("월-", "-").replace("일", "")).toString();
				case "YY_MM_DD_KO" -> LocalDate.parse("20" + value.replace("년-", "-").replace("월-", "-").replace("일", "")).toString();
				default -> LocalDate.parse(value).toString();
			};
		} catch (DateTimeParseException exception) {
			return null;
		}
	}

	private static boolean validTemporalOrder(List<String> blocks) {
		int previous = -1;
		for (String block : blocks) {
			int current = switch (block) {
				case "YEAR" -> 0;
				case "MONTH" -> 1;
				case "DATE", "DAY" -> 2;
				default -> -1;
			};
			if (current < 0) continue;
			if (current <= previous) return false;
			previous = current;
		}
		return true;
	}

	private static String safeStem(String fileName, String fallback) {
		String value = StringUtils.hasText(fileName) ? fileName.trim() : fallback;
		if (value != null && value.toLowerCase(Locale.ROOT).endsWith(".md")) value = value.substring(0, value.length() - 3);
		return safeSegment(value, "member");
	}

	private static String safeSegment(String value, String fallback) {
		String normalized = StringUtils.hasText(value) ? value.strip() : fallback;
		normalized = normalized.replaceAll("[\\p{Cntrl}/\\\\]", "-").replace("..", "-").replaceAll("\\s+", "-");
		normalized = normalized.replaceAll("[^\\p{L}\\p{N}._-]", "-").replaceAll("-+", "-");
		if (!StringUtils.hasText(normalized) || ".".equals(normalized) || "..".equals(normalized)) return fallback;
		return normalized.length() > 80 ? normalized.substring(0, 80) : normalized;
	}

	private static WorkspaceException invalid(String message) {
		return new WorkspaceException("INVALID_STORAGE_LAYOUT", message, 400);
	}

	private record Capture(String block) { }
	public record SubmissionLocation(String date, String relativePath, Map<String, String> blockValues) { }
}
