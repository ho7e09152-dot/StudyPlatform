package com.studyworkspace.workspace.service;

import static com.studyworkspace.workspace.domain.WorkspaceModels.SessionItem;
import static com.studyworkspace.workspace.domain.WorkspaceModels.StudySession;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class SessionYamlSerializerTests {

	private final SessionYamlSerializer serializer = new SessionYamlSerializer(new ObjectMapper());

	@Test
	void serializesUserTextAsQuotedYamlAndKeepsRepositoryFields() {
		StudySession session = new StudySession(
			"2026-08-09", "260809", 1, "algorithm", "제목: 큐 #1", "첫 줄\n둘째 줄", "active",
			"2026-08-09T23:59:00+09:00", null,
			"2026-08-09T00:00:00Z", "lhc0688", "2026-08-09T00:00:00Z", "lhc0688", null,
			List.of(new SessionItem(
				"item-one", 1, "문제: 배열", "SWEA #1", "https://example.com/a?b=1", "link", true,
				"active", null, null
			)),
			List.of(),
			null
		);

		String yaml = serializer.serialize(session);

		assertThat(yaml)
			.contains("revision: 1")
			.contains("title: \"제목: 큐 #1\"")
			.contains("description: \"첫 줄\\n둘째 줄\"")
			.contains("    type: \"algorithm\"")
			.contains("source: \"SWEA #1\"")
			.contains("url: \"https://example.com/a?b=1\"")
			.contains("updatedBy:\n  username: \"lhc0688\"")
			.doesNotContain("lastCommitId");
	}

	@Test
	void serializesItemKindSpecificFields() {
		StudySession session = new StudySession(
			"2026-08-09", "260809", 1, "free", "2026-08-09 계획", "", "active",
			"2026-08-09T23:59:00+09:00", null,
			"2026-08-09T00:00:00Z", "owner", "2026-08-09T00:00:00Z", "owner", null,
			List.of(
				new SessionItem("check", 1, "교재 읽기", "cs", null, null, "text", true,
					"active", null, null, "check", "3장을 읽어요.", null, null, null, null),
				new SessionItem("event", 2, "주간 회의", "free", null, null, "text", false,
					"active", null, null, "event", null, null, null, "19:00", "20:00")
			),
			List.of(), null
		);

		String yaml = serializer.serialize(session);

		assertThat(yaml)
			.contains("kind: \"check\"")
			.contains("description: \"3장을 읽어요.\"")
			.contains("kind: \"event\"")
			.contains("startTime: \"19:00\"")
			.contains("endTime: \"20:00\"");
	}
}
