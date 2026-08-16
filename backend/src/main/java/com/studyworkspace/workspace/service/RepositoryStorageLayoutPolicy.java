package com.studyworkspace.workspace.service;

import java.nio.charset.StandardCharsets;
import java.time.DateTimeException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.studyworkspace.common.validation.RepositoryPathSafety;
import com.studyworkspace.workspace.domain.RepositoryStorageLayout;
import com.studyworkspace.workspace.domain.WorkspaceException;
import com.studyworkspace.workspace.domain.WorkspaceModels.StudyMember;
import com.studyworkspace.workspace.domain.WorkspaceModels.StudySession;
import com.studyworkspace.workspace.port.RepositoryDataPort;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/** Authoritative validation, formatting and reverse parsing for custom repository layouts. */
@Component
public class RepositoryStorageLayoutPolicy {
	public static final int MAX_RESOLVED_PATH_CHARS = 240;
	public static final int MAX_RESOLVED_PATH_BYTES = 1024;
	public static final int MAX_SEGMENT_CHARS = 80;
	public static final int MAX_SEGMENT_BYTES = 255;

	private static final Set<String> BLOCKS = Set.of("YEAR", "MONTH", "DATE", "DAY", "NAME");
	private static final Set<String> YEAR_FORMATS = Set.of("YYYY", "YY", "YYYY_KO", "YY_KO");
	private static final Set<String> MONTH_FORMATS = Set.of(
		"MM", "M", "YYYY-MM", "YY-MM", "YYYYMM", "YYMM", "MM_KO", "M_KO", "YYYY_MM_KO", "YY_MM_KO"
	);
	private static final Set<String> COMPOUND_MONTH_FORMATS = Set.of(
		"YYYY-MM", "YY-MM", "YYYYMM", "YYMM", "YYYY_MM_KO", "YY_MM_KO"
	);
	private static final Set<String> DATE_FORMATS = Set.of(
		"YYYY-MM-DD", "YYYYMMDD", "YY-MM-DD", "YYMMDD", "YYYY_MM_DD_KO", "YY_MM_DD_KO",
		"YYYY_MM_DD_KO_SPACE", "YY_MM_DD_KO_SPACE"
	);
	private static final Set<String> DAY_FORMATS = Set.of("DD", "DD_KO");

	public RepositoryStorageLayout validate(RepositoryStorageLayout raw) {
		if (raw == null) throw invalid("학습 기록 저장 방식이 필요합니다.");
		RepositoryStorageLayout layout = new RepositoryStorageLayout(
			normalizeBlocks(raw.folderBlocks()), normalizeBlocks(raw.fileNameBlocks()),
			raw.yearFormat(), raw.monthFormat(), raw.dateFormat(), raw.dayFormat(), raw.extension()
		);
		if (layout.fileNameBlocks().size() != 1 || !Set.of("DATE", "NAME").contains(layout.fileNameBlocks().getFirst())) {
			throw invalid("파일 이름은 날짜 또는 이름 중 하나를 선택해 주세요.");
		}
		if (!YEAR_FORMATS.contains(layout.yearFormat())) throw invalid("지원하지 않는 연도 형식입니다.");
		if (!MONTH_FORMATS.contains(layout.monthFormat())) throw invalid("지원하지 않는 월 형식입니다.");
		if (!DATE_FORMATS.contains(layout.dateFormat())) throw invalid("지원하지 않는 날짜 형식입니다.");
		if (!DAY_FORMATS.contains(layout.dayFormat())) throw invalid("지원하지 않는 일 형식입니다.");
		if (!"md".equalsIgnoreCase(layout.extension())) throw invalid("현재는 Markdown(.md) 파일만 지원합니다.");

		List<String> all = allBlocks(layout);
		Set<String> unique = new HashSet<>(all);
		if (unique.size() != all.size()) throw invalid("같은 블록은 전체 저장 구조에서 한 번만 사용할 수 있습니다.");
		if (!unique.contains("NAME")) throw invalid("작성자를 식별할 수 없습니다. 이름 블록을 추가해 주세요.");
		if (unique.contains("DATE") && unique.contains("DAY")) {
			throw invalid("날짜와 일 블록은 함께 사용할 수 없습니다. 둘 중 하나만 선택해 주세요.");
		}
		if (!validTemporalOrder(all)) throw invalid("시간 블록은 연도, 월, 날짜 또는 일 순서로 배치해야 합니다.");
		if (unique.contains("YEAR") && unique.contains("MONTH") && COMPOUND_MONTH_FORMATS.contains(layout.monthFormat())) {
			throw invalid("연도 블록을 사용할 때 월 형식에는 연도를 포함할 수 없습니다.");
		}
		TemporalParts available = availableTemporalParts(layout, unique);
		if (!available.complete()) {
			throw invalid("최종 경로에서 일정 날짜의 연도, 월, 일을 모두 식별할 수 있어야 합니다.");
		}
		return layout;
	}

	public String validateBasePath(String rawBasePath, List<RepositoryDataPort.TreeEntry> tree) {
		String basePath;
		try {
			basePath = WorkspaceRepositoryPath.normalizeBasePath(rawBasePath);
		} catch (WorkspaceException exception) {
			throw invalid("학습 기록 위치가 안전한 Repository 상대 경로가 아닙니다.");
		}
		if (java.util.Arrays.stream(basePath.split("/"))
			.anyMatch(WorkspaceRepositoryLayout.MANAGED_BASE_PATH::equals)) {
			throw invalid("Workspace 시스템 설정 폴더는 학습 기록 위치로 사용할 수 없습니다.");
		}
		if (!basePath.isEmpty() && tree != null && tree.stream().filter(entry -> "blob".equals(entry.type()))
			.anyMatch(entry -> basePath.equals(entry.path()) || basePath.startsWith(entry.path() + "/"))) {
			throw invalid("선택한 학습 기록 위치의 상위 경로에 파일이 있어 폴더를 만들 수 없습니다.");
		}
		return basePath;
	}

	/** Session metadata uses the temporal projection of the same layout. */
	public String sessionPath(String basePath, RepositoryStorageLayout raw, StudySession session) {
		RepositoryStorageLayout layout = validate(raw);
		LocalDate date = requiredDate(session.date());
		List<String> temporal = allBlocks(layout).stream().filter(RepositoryStorageLayoutPolicy::isTemporal).toList();
		String relative = String.join("/", temporal.stream().map(block -> value(block, layout, date, null)).toList());
		return validateResolvedPath(WorkspaceRepositoryPath.join(basePath, relative + "/session.yml"));
	}

	public String submissionPath(String basePath, RepositoryStorageLayout raw, StudySession session, StudyMember member) {
		RepositoryStorageLayout layout = validate(raw);
		LocalDate date = requiredDate(session.date());
		List<String> folders = layout.folderBlocks().stream().map(block -> value(block, layout, date, member)).toList();
		String fileName = value(layout.fileNameBlocks().getFirst(), layout, date, member) + ".md";
		String relative = folders.isEmpty() ? fileName : String.join("/", folders) + "/" + fileName;
		return validateResolvedPath(WorkspaceRepositoryPath.join(basePath, relative));
	}

	public SessionLocation matchSession(String basePath, RepositoryStorageLayout raw, String fullPath) {
		RepositoryStorageLayout layout = validate(raw);
		List<String> temporal = allBlocks(layout).stream().filter(RepositoryStorageLayoutPolicy::isTemporal).toList();
		return match(basePath, fullPath, temporal, layout, "session.yml", true);
	}

	public SubmissionLocation matchSubmission(String basePath, RepositoryStorageLayout raw, String fullPath) {
		RepositoryStorageLayout layout = validate(raw);
		List<String> blocks = allBlocks(layout);
		String suffix = "." + layout.extension().toLowerCase(Locale.ROOT);
		MatchResult result = matchResult(basePath, fullPath, blocks, layout, suffix, false);
		return result == null ? null : new SubmissionLocation(result.date(), result.relativePath(), result.blockValues());
	}

	public void validateMemberNames(RepositoryStorageLayout raw, String basePath, LocalDate sampleDate,
		List<StudyMember> members) {
		RepositoryStorageLayout layout = validate(raw);
		Set<String> paths = new HashSet<>();
		for (StudyMember member : members) {
			StudySession sample = new StudySession(sampleDate.toString(), "sample", 1, "free", "sample", "", "active",
				sampleDate + "T23:59:59Z", null, sampleDate + "T00:00:00Z", "system",
				sampleDate + "T00:00:00Z", "system", null, List.of(), List.of(), null);
			String path = submissionPath(basePath, layout, sample, member).toLowerCase(Locale.ROOT);
			if (!paths.add(path)) throw invalid("Workspace 멤버의 학습 기록 경로가 서로 충돌합니다.");
		}
	}

	private static SessionLocation match(String basePath, String fullPath, List<String> blocks,
		RepositoryStorageLayout layout, String suffix, boolean literalSuffix) {
		MatchResult result = matchResult(basePath, fullPath, blocks, layout, suffix, literalSuffix);
		return result == null ? null : new SessionLocation(result.date(), result.relativePath(), result.blockValues());
	}

	private static MatchResult matchResult(String basePath, String fullPath, List<String> blocks,
		RepositoryStorageLayout layout, String suffix, boolean literalSuffix) {
		String relative = WorkspaceRepositoryPath.relative(basePath, fullPath);
		if (relative == null) return null;
		StringBuilder expression = new StringBuilder("^");
		List<Capture> captures = new ArrayList<>();
		for (int index = 0; index < blocks.size(); index++) {
			if (index > 0) expression.append('/');
			appendPattern(expression, captures, blocks.get(index), layout);
		}
		if (literalSuffix && !blocks.isEmpty()) expression.append('/');
		expression.append(Pattern.quote(suffix));
		expression.append('$');
		Matcher matcher = Pattern.compile(expression.toString()).matcher(relative);
		if (!matcher.matches()) return null;
		Map<String, String> values = new LinkedHashMap<>();
		TemporalParts combined = new TemporalParts(null, null, null);
		for (int index = 0; index < captures.size(); index++) {
			Capture capture = captures.get(index);
			String captured = matcher.group(index + 1);
			if ("NAME".equals(capture.block())) validateSegment(captured, "이름");
			values.put(capture.block(), captured);
			combined = merge(combined, parseTemporal(capture.block(), captured, layout));
		}
		if (!combined.complete()) return null;
		LocalDate date;
		try {
			date = LocalDate.of(combined.year(), combined.month(), combined.day());
		} catch (DateTimeException exception) {
			return null;
		}
		return new MatchResult(date.toString(), relative, Map.copyOf(values));
	}

	private static List<String> normalizeBlocks(List<String> raw) {
		if (raw == null) return List.of();
		return raw.stream().map(value -> value == null ? "" : value.trim().toUpperCase(Locale.ROOT)).map(value -> {
			if (!BLOCKS.contains(value)) throw invalid("지원하지 않는 저장 구조 블록입니다: " + value);
			return value;
		}).toList();
	}

	private static List<String> allBlocks(RepositoryStorageLayout layout) {
		List<String> all = new ArrayList<>(layout.folderBlocks());
		all.addAll(layout.fileNameBlocks());
		return all;
	}

	private static String value(String block, RepositoryStorageLayout layout, LocalDate date, StudyMember member) {
		String resolved = switch (block) {
			case "YEAR" -> switch (layout.yearFormat()) {
				case "YY" -> String.format("%02d", date.getYear() % 100);
				case "YYYY_KO" -> date.getYear() + "년";
				case "YY_KO" -> String.format("%02d년", date.getYear() % 100);
				default -> Integer.toString(date.getYear());
			};
			case "MONTH" -> formatMonth(date, layout.monthFormat());
			case "DATE" -> formatDate(date, layout.dateFormat());
			case "DAY" -> "DD_KO".equals(layout.dayFormat())
				? date.format(DateTimeFormatter.ofPattern("dd'일'")) : date.format(DateTimeFormatter.ofPattern("dd"));
			case "NAME" -> memberStem(member);
			default -> throw invalid("지원하지 않는 저장 구조 블록입니다.");
		};
		return validateSegment(resolved, block);
	}

	private static String formatMonth(LocalDate date, String format) {
		return switch (format) {
			case "M" -> Integer.toString(date.getMonthValue());
			case "YYYY-MM" -> date.format(DateTimeFormatter.ofPattern("yyyy-MM"));
			case "YY-MM" -> date.format(DateTimeFormatter.ofPattern("yy-MM"));
			case "YYYYMM" -> date.format(DateTimeFormatter.ofPattern("yyyyMM"));
			case "YYMM" -> date.format(DateTimeFormatter.ofPattern("yyMM"));
			case "MM_KO" -> date.format(DateTimeFormatter.ofPattern("MM'월'"));
			case "M_KO" -> date.getMonthValue() + "월";
			case "YYYY_MM_KO" -> date.format(DateTimeFormatter.ofPattern("yyyy'년-'MM'월'"));
			case "YY_MM_KO" -> date.format(DateTimeFormatter.ofPattern("yy'년-'MM'월'"));
			default -> String.format("%02d", date.getMonthValue());
		};
	}

	private static String formatDate(LocalDate date, String format) {
		return switch (format) {
			case "YYYYMMDD" -> date.format(DateTimeFormatter.ofPattern("yyyyMMdd"));
			case "YY-MM-DD" -> date.format(DateTimeFormatter.ofPattern("yy-MM-dd"));
			case "YYMMDD" -> date.format(DateTimeFormatter.ofPattern("yyMMdd"));
			case "YYYY_MM_DD_KO" -> date.format(DateTimeFormatter.ofPattern("yyyy'년-'MM'월-'dd'일'"));
			case "YY_MM_DD_KO" -> date.format(DateTimeFormatter.ofPattern("yy'년-'MM'월-'dd'일'"));
			case "YYYY_MM_DD_KO_SPACE" -> date.format(DateTimeFormatter.ofPattern("yyyy'년 'MM'월 'dd'일'"));
			case "YY_MM_DD_KO_SPACE" -> date.format(DateTimeFormatter.ofPattern("yy'년 'MM'월 'dd'일'"));
			default -> date.toString();
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
				case "YYYYMM" -> "\\d{4}(?:0[1-9]|1[0-2])";
				case "YYMM" -> "\\d{2}(?:0[1-9]|1[0-2])";
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
				case "YYYY_MM_DD_KO_SPACE" -> "\\d{4}년 (?:0[1-9]|1[0-2])월 (?:0[1-9]|[12]\\d|3[01])일";
				case "YY_MM_DD_KO_SPACE" -> "\\d{2}년 (?:0[1-9]|1[0-2])월 (?:0[1-9]|[12]\\d|3[01])일";
				default -> "\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])";
			};
			case "DAY" -> "DD_KO".equals(layout.dayFormat())
				? "(?:0[1-9]|[12]\\d|3[01])일" : "(?:0[1-9]|[12]\\d|3[01])";
			case "NAME" -> "[^/]+?";
			default -> throw invalid("지원하지 않는 저장 구조 블록입니다.");
		}).append(')');
	}

	private static TemporalParts parseTemporal(String block, String value, RepositoryStorageLayout layout) {
		if (!isTemporal(block)) return new TemporalParts(null, null, null);
		try {
			return switch (block) {
				case "YEAR" -> new TemporalParts(parseYear(value, layout.yearFormat()), null, null);
				case "MONTH" -> parseMonth(value, layout.monthFormat());
				case "DATE" -> {
					LocalDate date = parseFullDate(value, layout.dateFormat());
					yield new TemporalParts(date.getYear(), date.getMonthValue(), date.getDayOfMonth());
				}
				case "DAY" -> new TemporalParts(null, null, Integer.parseInt(value.replace("일", "")));
				default -> new TemporalParts(null, null, null);
			};
		} catch (DateTimeException | NumberFormatException exception) {
			throw new WorkspaceException("INVALID_REPOSITORY_PATH", "저장 경로의 날짜 형식을 해석할 수 없습니다.", 422);
		}
	}

	private static int parseYear(String value, String format) {
		int parsed = Integer.parseInt(value.replace("년", ""));
		return "YY".equals(format) || "YY_KO".equals(format) ? 2000 + parsed : parsed;
	}

	private static TemporalParts parseMonth(String value, String format) {
		String normalized = value.replace("년", "").replace("월", "");
		if (COMPOUND_MONTH_FORMATS.contains(format)) {
			boolean compact = "YYYYMM".equals(format) || "YYMM".equals(format);
			boolean shortYear = Set.of("YY-MM", "YYMM", "YY_MM_KO").contains(format);
			int yearLength = shortYear ? 2 : 4;
			String yearPart = compact ? normalized.substring(0, yearLength) : normalized.split("-")[0];
			String monthPart = compact ? normalized.substring(yearLength) : normalized.split("-")[1];
			int year = Integer.parseInt(yearPart);
			if (yearLength == 2) year += 2000;
			return new TemporalParts(year, Integer.parseInt(monthPart), null);
		}
		return new TemporalParts(null, Integer.parseInt(normalized), null);
	}

	private static LocalDate parseFullDate(String value, String format) {
		String normalized = value.replace("년-", "-").replace("월-", "-")
			.replace("년 ", "-").replace("월 ", "-").replace("일", "");
		return switch (format) {
			case "YYYYMMDD" -> LocalDate.parse(normalized, DateTimeFormatter.ofPattern("yyyyMMdd"));
			case "YY-MM-DD", "YY_MM_DD_KO", "YY_MM_DD_KO_SPACE" -> LocalDate.parse("20" + normalized);
			case "YYMMDD" -> LocalDate.parse("20" + normalized, DateTimeFormatter.ofPattern("yyyyMMdd"));
			default -> LocalDate.parse(normalized);
		};
	}

	private static TemporalParts merge(TemporalParts current, TemporalParts incoming) {
		return new TemporalParts(
			mergeComponent(current.year(), incoming.year(), "연도"),
			mergeComponent(current.month(), incoming.month(), "월"),
			mergeComponent(current.day(), incoming.day(), "일")
		);
	}

	private static Integer mergeComponent(Integer current, Integer incoming, String label) {
		if (current != null && incoming != null && !current.equals(incoming)) {
			throw new WorkspaceException("TEMPORAL_COMPONENT_MISMATCH", "저장 경로의 " + label + " 정보가 서로 일치하지 않습니다.", 422);
		}
		return current != null ? current : incoming;
	}

	private static TemporalParts availableTemporalParts(RepositoryStorageLayout layout, Set<String> blocks) {
		boolean year = blocks.contains("YEAR") || blocks.contains("DATE")
			|| blocks.contains("MONTH") && COMPOUND_MONTH_FORMATS.contains(layout.monthFormat());
		boolean month = blocks.contains("MONTH") || blocks.contains("DATE");
		boolean day = blocks.contains("DAY") || blocks.contains("DATE");
		return new TemporalParts(year ? 2000 : null, month ? 1 : null, day ? 1 : null);
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

	private static boolean isTemporal(String block) {
		return Set.of("YEAR", "MONTH", "DATE", "DAY").contains(block);
	}

	private static String memberStem(StudyMember member) {
		if (member == null) throw invalid("이름 블록을 해석하려면 Workspace 멤버가 필요합니다.");
		String value = StringUtils.hasText(member.fileName()) ? member.fileName().strip() : member.displayName();
		if (value != null && value.toLowerCase(Locale.ROOT).endsWith(".md")) value = value.substring(0, value.length() - 3);
		return validateSegment(value, "이름");
	}

	public static String validateSegment(String value, String label) {
		if (!StringUtils.hasText(value)) throw invalid(label + " 값은 안전한 저장소 경로 한 칸이어야 합니다.");
		String segment = value.strip();
		if (".".equals(segment) || "..".equals(segment) || WorkspaceRepositoryLayout.MANAGED_BASE_PATH.equals(segment)
			|| segment.contains("/") || segment.contains("\\") || RepositoryPathSafety.containsDisallowedUnicode(segment)) {
			throw invalid(label + " 값은 안전한 저장소 경로 한 칸이어야 합니다.");
		}
		if (segment.length() > MAX_SEGMENT_CHARS || segment.getBytes(StandardCharsets.UTF_8).length > MAX_SEGMENT_BYTES) {
			throw invalid(label + " 값이 너무 깁니다.");
		}
		return segment;
	}

	public static String validateResolvedPath(String path) {
		if (!StringUtils.hasText(path) || path.length() > MAX_RESOLVED_PATH_CHARS
			|| path.getBytes(StandardCharsets.UTF_8).length > MAX_RESOLVED_PATH_BYTES) {
			throw invalid("최종 학습 기록 경로가 너무 깁니다.");
		}
		for (String segment : path.split("/")) validateSegment(segment, "경로");
		return path;
	}

	private static LocalDate requiredDate(String value) {
		try {
			return LocalDate.parse(value);
		} catch (DateTimeException | NullPointerException exception) {
			throw invalid("일정 날짜는 YYYY-MM-DD 형식이어야 합니다.");
		}
	}

	private static WorkspaceException invalid(String message) {
		return new WorkspaceException("INVALID_STORAGE_LAYOUT", message, 400);
	}

	private record Capture(String block) { }
	private record TemporalParts(Integer year, Integer month, Integer day) {
		boolean complete() { return year != null && month != null && day != null; }
	}
	private record MatchResult(String date, String relativePath, Map<String, String> blockValues) { }
	public record SessionLocation(String date, String relativePath, Map<String, String> blockValues) { }
	public record SubmissionLocation(String date, String relativePath, Map<String, String> blockValues) { }
}
