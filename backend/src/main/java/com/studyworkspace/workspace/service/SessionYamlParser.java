package com.studyworkspace.workspace.service;

import static com.studyworkspace.workspace.domain.WorkspaceModels.*;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Date;
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

@Component
public class SessionYamlParser {
	private static final Set<String> SESSION_TYPES = Set.of("algorithm", "english", "cs", "free");
	private static final Set<String> SESSION_STATUSES = Set.of("active", "cancelled");
	private static final Set<String> ITEM_STATUSES = Set.of("active", "cancelled", "replaced");
	private static final Set<String> SUBMISSION_TYPES = Set.of("link", "text", "code", "mixed");

	public StudySession parse(String path, String content, String lastCommitId) {
		WorkspaceRepositoryLayout.SessionLocation location = WorkspaceRepositoryLayout
			.matchSession(path, WorkspaceRepositoryLayout.LEGACY_SCHEMA_VERSION)
			.or(() -> WorkspaceRepositoryLayout.matchSession(path, WorkspaceRepositoryLayout.CURRENT_SCHEMA_VERSION))
			.or(() -> WorkspaceRepositoryLayout.matchSession(path, WorkspaceRepositoryLayout.CUSTOM_SCHEMA_VERSION))
			.orElseThrow(() -> invalid("일정 파일 경로 형식이 올바르지 않습니다."));
		if (!StringUtils.hasText(content)) {
			throw invalid("session.yml 파일이 비어 있습니다.");
		}

		Map<String, Object> root = load(content);
		int version = integer(root, "version", true);
		if (version != 1) throw invalid("지원하지 않는 session.yml 버전입니다.");
		int revision = integer(root, "revision", true);
		if (revision < 1) throw invalid("revision은 1 이상이어야 합니다.");

		String folder = location.folder();
		String expectedDate = location.date();
		String date = text(root, "date", true);
		try {
			if (!LocalDate.parse(date).equals(LocalDate.parse(expectedDate))) {
				throw invalid("폴더 날짜와 session.yml의 date가 다릅니다.");
			}
		} catch (DateTimeParseException exception) {
			throw invalid("date는 YYYY-MM-DD 형식이어야 합니다.");
		}

		String type = text(root, "type", true);
		if (!SESSION_TYPES.contains(type)) throw invalid("지원하지 않는 일정 유형입니다.");
		String status = text(root, "status", true);
		if (!SESSION_STATUSES.contains(status)) throw invalid("지원하지 않는 일정 상태입니다.");
		String title = text(root, "title", true);
		String deadline = timestamp(root, "deadline", true);
		String secondaryDeadline = timestamp(root, "secondaryDeadline", false);
		if (secondaryDeadline != null && !OffsetDateTime.parse(secondaryDeadline).isAfter(OffsetDateTime.parse(deadline))) {
			throw invalid("2차 마감은 1차 마감보다 늦어야 합니다.");
		}

		List<SessionItem> items = items(root.get("items"), "items", false, type);
		if (items.isEmpty()) throw invalid("items에는 하나 이상의 학습 항목이 필요합니다.");
		List<SessionItem> archivedItems = items(root.get("archivedItems"), "archivedItems", true, type);
		Set<String> allIds = new HashSet<>();
		for (SessionItem item : items) {
			if (!allIds.add(item.id())) throw invalid("학습 항목 ID가 중복되었습니다: " + item.id());
		}
		for (SessionItem item : archivedItems) {
			if (!allIds.add(item.id())) throw invalid("활성/보관 학습 항목 ID가 중복되었습니다: " + item.id());
		}

		return new StudySession(
			date, folder, revision, type, title, defaultText(root, "description"), status,
			deadline, secondaryDeadline,
			timestamp(root, "createdAt", true), actor(root.get("createdBy"), "createdBy"),
			timestamp(root, "updatedAt", true), actor(root.get("updatedBy"), "updatedBy"),
			change(root.get("change")), List.copyOf(items), List.copyOf(archivedItems), requiredText(lastCommitId, "GitLab last_commit_id")
		);
	}

	@SuppressWarnings("unchecked")
	private static Map<String, Object> load(String content) {
		LoaderOptions options = new LoaderOptions();
		options.setAllowDuplicateKeys(false);
		options.setMaxAliasesForCollections(10);
		options.setCodePointLimit(1_000_000);
		try {
			Object loaded = new Yaml(new SafeConstructor(options)).load(content);
			if (!(loaded instanceof Map<?, ?> map)) throw invalid("session.yml 최상위 값은 객체여야 합니다.");
			return (Map<String, Object>) map;
		} catch (YAMLException | ClassCastException exception) {
			throw invalid("session.yml 문법을 해석하지 못했습니다.");
		}
	}

	private static List<SessionItem> items(Object value, String field, boolean optional, String fallbackType) {
		if (value == null && optional) return List.of();
		if (!(value instanceof List<?> list)) throw invalid(field + "는 배열이어야 합니다.");
		List<SessionItem> result = new ArrayList<>();
		Set<Integer> orders = new HashSet<>();
		for (Object entry : list) {
			if (!(entry instanceof Map<?, ?> raw)) throw invalid(field + "의 각 항목은 객체여야 합니다.");
			Map<String, Object> item = stringMap(raw, field);
			String submitType = text(item, "submitType", true);
			if (!SUBMISSION_TYPES.contains(submitType)) throw invalid("지원하지 않는 제출 방식입니다.");
			String itemType = text(item, "type", false);
			if (itemType == null) itemType = fallbackType;
			if (!SESSION_TYPES.contains(itemType)) throw invalid("지원하지 않는 학습 유형입니다.");
			String status = text(item, "status", true);
			if (!ITEM_STATUSES.contains(status)) throw invalid("지원하지 않는 학습 항목 상태입니다.");
			int order = integer(item, "order", true);
			if (order < 1 || !orders.add(order)) throw invalid(field + "의 order는 중복 없는 양수여야 합니다.");
			result.add(new SessionItem(
				text(item, "id", true), order, text(item, "title", true), itemType, text(item, "source", false),
				text(item, "url", false), submitType, bool(item, "required"), status,
				text(item, "replaces", false), text(item, "replacedBy", false)
			));
		}
		return result;
	}

	private static SessionChange change(Object value) {
		if (value == null) return null;
		if (!(value instanceof Map<?, ?> raw)) throw invalid("change는 객체여야 합니다.");
		Map<String, Object> map = stringMap(raw, "change");
		return new SessionChange(bool(map, "changed"), text(map, "message", true), text(map, "reason", true));
	}

	private static String actor(Object value, String field) {
		if (value instanceof Map<?, ?> raw) return text(stringMap(raw, field), "username", true);
		return requiredText(scalar(value), field);
	}

	private static String timestamp(Map<String, Object> map, String field, boolean required) {
		Object value = map.get(field);
		if (value == null && !required) return null;
		String text = requiredText(scalar(value), field);
		try {
			OffsetDateTime.parse(text);
			return text;
		} catch (DateTimeParseException exception) {
			throw invalid(field + "는 시간대가 포함된 ISO 8601 형식이어야 합니다.");
		}
	}

	private static String text(Map<String, Object> map, String field, boolean required) {
		String value = scalar(map.get(field));
		if (required) return requiredText(value, field);
		return StringUtils.hasText(value) ? value.trim() : null;
	}

	private static String defaultText(Map<String, Object> map, String field) {
		String value = scalar(map.get(field));
		return value == null ? "" : value.trim();
	}

	private static String scalar(Object value) {
		if (value == null) return null;
		if (value instanceof String string) return string;
		if (value instanceof Date date) return date.toInstant().atOffset(ZoneOffset.UTC).toString();
		if (value instanceof Number || value instanceof Boolean) return value.toString();
		throw invalid("문자열 값의 형식이 올바르지 않습니다.");
	}

	private static int integer(Map<String, Object> map, String field, boolean required) {
		Object value = map.get(field);
		if (value == null && !required) return 0;
		try {
			if (value instanceof Number number) return new java.math.BigDecimal(number.toString()).intValueExact();
			return Integer.parseInt(requiredText(scalar(value), field));
		} catch (NumberFormatException | ArithmeticException exception) {
			throw invalid(field + "는 정수여야 합니다.");
		}
	}

	private static boolean bool(Map<String, Object> map, String field) {
		Object value = map.get(field);
		if (value instanceof Boolean bool) return bool;
		if ("true".equals(value)) return true;
		if ("false".equals(value)) return false;
		throw invalid(field + "는 boolean이어야 합니다.");
	}

	private static Map<String, Object> stringMap(Map<?, ?> raw, String field) {
		Map<String, Object> result = new java.util.LinkedHashMap<>();
		for (Map.Entry<?, ?> entry : raw.entrySet()) {
			if (!(entry.getKey() instanceof String key)) throw invalid(field + "의 키는 문자열이어야 합니다.");
			result.put(key, entry.getValue());
		}
		return result;
	}

	private static String requiredText(String value, String field) {
		if (!StringUtils.hasText(value)) throw invalid(field + " 값이 필요합니다.");
		return value.trim();
	}

	private static WorkspaceException invalid(String message) {
		return new WorkspaceException("INVALID_SESSION_FILE", message, 422);
	}
}
