package com.studyworkspace.workspace.service;

import static com.studyworkspace.workspace.domain.WorkspaceModels.*;

import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.studyworkspace.workspace.domain.WorkspaceException;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.yaml.snakeyaml.LoaderOptions;
import org.yaml.snakeyaml.Yaml;
import org.yaml.snakeyaml.constructor.SafeConstructor;
import org.yaml.snakeyaml.error.YAMLException;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

@Component
public class SubmissionMarkdownCodec {
	private static final Set<String> SESSION_TYPES = Set.of("algorithm", "english", "cs", "free");
	private static final Set<String> SUBMISSION_TYPES = Set.of("link", "text", "code", "mixed");

	private final ObjectMapper objectMapper;

	public SubmissionMarkdownCodec(ObjectMapper objectMapper) {
		this.objectMapper = objectMapper;
	}

	public MemberSubmissionFile decode(String markdown, String lastCommitId) {
		Map<String, Object> root = frontMatter(markdown);
		int version = integer(root, "version");
		if (version != 1) throw invalid("지원하지 않는 제출 파일 버전입니다.");
		long gitLabUserId = longValue(root, "gitlabUserId");
		if (gitLabUserId <= 0) throw invalid("gitlabUserId는 양수여야 합니다.");
		String date = text(root, "date", true);
		if (!date.matches("\\d{6}")) throw invalid("date는 YYMMDD 형식이어야 합니다.");
		int sessionRevision = integer(root, "sessionRevision");
		if (sessionRevision < 1) throw invalid("sessionRevision은 1 이상이어야 합니다.");
		String sessionType = text(root, "sessionType", true);
		if (!SESSION_TYPES.contains(sessionType)) throw invalid("지원하지 않는 sessionType입니다.");

		List<SubmissionEntry> submissions = entries(root.get("submissions"));
		return new MemberSubmissionFile(
			version,
			text(root, "memberId", true),
			gitLabUserId,
			text(root, "username", true),
			date,
			sessionRevision,
			sessionType,
			timestamp(root, "updatedAt"),
			List.copyOf(submissions),
			text(root, "reflection", false),
			required(lastCommitId, "GitLab last_commit_id"),
			null
		);
	}

	public String encode(MemberSubmissionFile file, StudySession session) {
		StringBuilder markdown = new StringBuilder("---\n")
			.append("version: 1\n")
			.append("memberId: ").append(quoted(file.memberId())).append('\n')
			.append("gitlabUserId: ").append(file.gitlabUserId()).append('\n')
			.append("username: ").append(quoted(file.username())).append('\n')
			.append("date: ").append(quoted(file.date())).append('\n')
			.append("sessionRevision: ").append(file.sessionRevision()).append('\n')
			.append("sessionType: ").append(quoted(file.sessionType())).append('\n')
			.append("updatedAt: ").append(quoted(file.updatedAt())).append('\n');
		if (StringUtils.hasText(file.reflection())) {
			markdown.append("reflection: ").append(quoted(file.reflection())).append('\n');
		}
		if (file.submissions().isEmpty()) {
			markdown.append("submissions: []\n");
		} else {
			markdown.append("submissions:\n");
			for (SubmissionEntry entry : file.submissions()) {
				markdown.append("  - itemId: ").append(quoted(entry.itemId())).append('\n')
					.append("    type: ").append(quoted(entry.type())).append('\n');
				if (StringUtils.hasText(entry.language())) {
					markdown.append("    language: ").append(quoted(entry.language())).append('\n');
				}
				markdown.append("    value: ").append(quoted(entry.value())).append('\n')
					.append("    submittedAt: ").append(quoted(entry.submittedAt())).append('\n')
					.append("    updatedAt: ").append(quoted(entry.updatedAt())).append('\n');
			}
		}
		markdown.append("---\n\n# ").append(heading(session.title())).append('\n');
		for (SessionItem item : session.items().stream().filter(candidate -> "active".equals(candidate.status())).toList()) {
			SubmissionEntry entry = file.submissions().stream()
				.filter(candidate -> candidate.itemId().equals(item.id())).findFirst().orElse(null);
			markdown.append("\n## ").append(heading(item.title())).append("\n\n");
			if (entry == null) {
				markdown.append("(미제출)");
			} else if ("code".equals(entry.type())) {
				appendCodeBlock(markdown, entry.value(), entry.language());
			} else {
				markdown.append(entry.value());
			}
			markdown.append('\n');
		}
		return markdown.toString();
	}

	private static void appendCodeBlock(StringBuilder markdown, String value, String language) {
		String normalized = value.replace("\r\n", "\n").replace('\r', '\n');
		String fence = "`".repeat(Math.max(3, longestBacktickRun(normalized) + 1));
		String safeLanguage = StringUtils.hasText(language) && language.matches("[A-Za-z0-9_+.#-]{1,32}")
			? language
			: "";
		markdown.append(fence).append(safeLanguage).append('\n').append(normalized);
		if (!normalized.endsWith("\n")) {
			markdown.append('\n');
		}
		markdown.append(fence);
	}

	private static int longestBacktickRun(String value) {
		int longest = 0;
		int current = 0;
		for (int index = 0; index < value.length(); index++) {
			if (value.charAt(index) == '`') {
				current++;
				longest = Math.max(longest, current);
			} else {
				current = 0;
			}
		}
		return longest;
	}

	@SuppressWarnings("unchecked")
	private static Map<String, Object> frontMatter(String markdown) {
		if (!StringUtils.hasText(markdown)) throw invalid("제출 파일이 비어 있습니다.");
		String normalized = markdown.replace("\r\n", "\n").replace('\r', '\n');
		String[] lines = normalized.split("\n", -1);
		if (lines.length < 3 || !"---".equals(lines[0])) throw invalid("제출 파일 front matter 시작 구분자가 없습니다.");
		int end = -1;
		for (int index = 1; index < lines.length; index++) {
			if ("---".equals(lines[index])) {
				end = index;
				break;
			}
		}
		if (end < 0) throw invalid("제출 파일 front matter 종료 구분자가 없습니다.");
		String yamlText = String.join("\n", java.util.Arrays.copyOfRange(lines, 1, end));
		LoaderOptions options = new LoaderOptions();
		options.setAllowDuplicateKeys(false);
		options.setMaxAliasesForCollections(10);
		options.setCodePointLimit(1_000_000);
		try {
			Object loaded = new Yaml(new SafeConstructor(options)).load(yamlText);
			if (!(loaded instanceof Map<?, ?> raw)) throw invalid("제출 파일 front matter는 객체여야 합니다.");
			Map<String, Object> result = new java.util.LinkedHashMap<>();
			for (Map.Entry<?, ?> entry : raw.entrySet()) {
				if (!(entry.getKey() instanceof String key)) throw invalid("front matter 키는 문자열이어야 합니다.");
				result.put(key, entry.getValue());
			}
			return result;
		} catch (YAMLException | ClassCastException exception) {
			throw invalid("제출 파일 front matter 문법을 해석하지 못했습니다.");
		}
	}

	private static List<SubmissionEntry> entries(Object value) {
		if (value == null) throw invalid("submissions 값이 필요합니다.");
		if (!(value instanceof List<?> list)) throw invalid("submissions는 배열이어야 합니다.");
		List<SubmissionEntry> entries = new ArrayList<>();
		Set<String> itemIds = new HashSet<>();
		for (Object candidate : list) {
			if (!(candidate instanceof Map<?, ?> raw)) throw invalid("submissions의 각 항목은 객체여야 합니다.");
			Map<String, Object> map = new java.util.LinkedHashMap<>();
			for (Map.Entry<?, ?> entry : raw.entrySet()) {
				if (!(entry.getKey() instanceof String key)) throw invalid("submission 키는 문자열이어야 합니다.");
				map.put(key, entry.getValue());
			}
			String itemId = text(map, "itemId", true);
			if (!itemIds.add(itemId)) throw invalid("제출 항목 ID가 중복되었습니다: " + itemId);
			String type = text(map, "type", true);
			if (!SUBMISSION_TYPES.contains(type)) throw invalid("지원하지 않는 제출 형식입니다.");
			entries.add(new SubmissionEntry(
				itemId, type, text(map, "value", true), text(map, "language", false),
				timestamp(map, "submittedAt"), timestamp(map, "updatedAt")
			));
		}
		return entries;
	}

	private static String timestamp(Map<String, Object> map, String field) {
		String value = text(map, field, true);
		try {
			OffsetDateTime.parse(value);
			return value;
		} catch (DateTimeParseException exception) {
			throw invalid(field + "는 시간대가 포함된 ISO 8601 형식이어야 합니다.");
		}
	}

	private static String text(Map<String, Object> map, String field, boolean required) {
		Object raw = map.get(field);
		String value;
		if (raw == null) value = null;
		else if (raw instanceof String string) value = string;
		else if (raw instanceof Number || raw instanceof Boolean) value = raw.toString();
		else if (raw instanceof java.util.Date date) value = date.toInstant().atOffset(java.time.ZoneOffset.UTC).toString();
		else throw invalid(field + " 값의 형식이 올바르지 않습니다.");
		if (required) return required(value, field);
		return StringUtils.hasText(value) ? value.trim() : null;
	}

	private static int integer(Map<String, Object> map, String field) {
		long value = longValue(map, field);
		if (value > Integer.MAX_VALUE) throw invalid(field + " 값이 너무 큽니다.");
		return (int) value;
	}

	private static long longValue(Map<String, Object> map, String field) {
		Object value = map.get(field);
		try {
			if (value instanceof Number number) return new java.math.BigDecimal(number.toString()).longValueExact();
			return Long.parseLong(required(value == null ? null : value.toString(), field));
		} catch (NumberFormatException | ArithmeticException exception) {
			throw invalid(field + "는 정수여야 합니다.");
		}
	}

	private String quoted(String value) {
		try {
			return objectMapper.writeValueAsString(value == null ? "" : value);
		} catch (JacksonException exception) {
			throw new IllegalStateException("제출 파일 문자열을 직렬화하지 못했습니다.", exception);
		}
	}

	private static String heading(String value) {
		return value == null ? "" : value.replace('\n', ' ').replace('\r', ' ').trim();
	}

	private static String required(String value, String field) {
		if (!StringUtils.hasText(value)) throw invalid(field + " 값이 필요합니다.");
		return value.trim();
	}

	private static WorkspaceException invalid(String message) {
		return new WorkspaceException("SUBMISSION_FILE_INVALID", message, 422);
	}
}
