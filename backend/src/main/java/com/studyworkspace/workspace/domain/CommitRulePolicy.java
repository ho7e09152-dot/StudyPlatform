package com.studyworkspace.workspace.domain;

import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.util.StringUtils;

import com.studyworkspace.workspace.domain.WorkspaceModels.CommitRules;

public final class CommitRulePolicy {
	public static final int MAX_COMMIT_MESSAGE_LENGTH = 200;
	public static final int MAX_GUIDANCE_LENGTH = 240;
	public static final Set<String> SUPPORTED_VARIABLES = Set.of(
		"action", "name", "date", "item", "itemId", "session"
	);

	private static final Pattern VARIABLE_PATTERN = Pattern.compile("\\{([A-Za-z][A-Za-z0-9]*)}");
	private static final Map<String, String> MAX_LENGTH_SAMPLES = Map.of(
		"action", "update",
		"name", "가".repeat(40),
		"date", "2026-08-13",
		"item", "가".repeat(50),
		"itemId", "item-1234567890123456",
		"session", "가".repeat(80)
	);

	private CommitRulePolicy() { }

	public static void validate(CommitRules rules) {
		if (rules == null || !StringUtils.hasText(rules.submissionTemplate())) {
			throw new IllegalArgumentException("커밋 메시지 규칙을 입력해 주세요.");
		}
		if (!StringUtils.hasText(rules.submissionGuidance())) {
			throw new IllegalArgumentException("제출 화면 안내 문구를 입력해 주세요.");
		}
		if (rules.submissionGuidance().length() > MAX_GUIDANCE_LENGTH
			|| rules.submissionGuidance().chars().anyMatch(Character::isISOControl)) {
			throw new IllegalArgumentException("안내 문구는 제어 문자 없이 240자 이내로 입력해 주세요.");
		}
		String rendered = renderForMaximumLength(rules.submissionTemplate());
		if (rendered.length() > MAX_COMMIT_MESSAGE_LENGTH
			|| rendered.chars().anyMatch(Character::isISOControl)) {
			throw new IllegalArgumentException("커밋 메시지 규칙은 적용 후 200자 이내가 되도록 작성해 주세요.");
		}
	}

	private static String renderForMaximumLength(String template) {
		Matcher matcher = VARIABLE_PATTERN.matcher(template);
		StringBuffer rendered = new StringBuffer();
		while (matcher.find()) {
			String variable = matcher.group(1);
			if (!SUPPORTED_VARIABLES.contains(variable)) {
				throw new IllegalArgumentException("지원하지 않는 변수입니다: {" + variable + "}");
			}
			matcher.appendReplacement(rendered, Matcher.quoteReplacement(MAX_LENGTH_SAMPLES.get(variable)));
		}
		matcher.appendTail(rendered);
		return rendered.toString();
	}
}
