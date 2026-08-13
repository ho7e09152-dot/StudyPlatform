package com.studyworkspace.workspace.domain;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

import com.studyworkspace.workspace.domain.WorkspaceModels.CommitRules;
import com.studyworkspace.workspace.domain.WorkspaceModels.WorkspaceSettings;
import tools.jackson.databind.ObjectMapper;

class CommitRulePolicyTests {
	@Test
	void acceptsCustomTextAndSupportedVariables() {
		assertThatCode(() -> CommitRulePolicy.validate(new CommitRules(
			"학습: {name} · {date} · {item} ({itemId}) · {action}",
			"팀 규칙에 맞게 필요한 경우 수정해 주세요."
		))).doesNotThrowAnyException();
	}

	@Test
	void rejectsRulesWhoseMaximumRenderedMessageExceedsTheCommitLimit() {
		assertThatThrownBy(() -> CommitRulePolicy.validate(new CommitRules(
			"{session}{session}{session}",
			"확인해 주세요."
		))).isInstanceOf(IllegalArgumentException.class)
			.hasMessageContaining("200자");
	}

	@Test
	void oldWorkspaceJsonReceivesDefaultCommitRules() throws Exception {
		WorkspaceSettings settings = new ObjectMapper().readValue("""
			{
			  "timezone": "Asia/Seoul",
			  "requireChangeNoteWhenSubmitted": true,
			  "notifications": {
			    "scheduleChanges": true,
			    "submissionMismatch": true,
			    "syncFailures": true
			  }
			}
			""", WorkspaceSettings.class);

		assertThatCode(() -> CommitRulePolicy.validate(settings.commitRules()))
			.doesNotThrowAnyException();
	}
}
