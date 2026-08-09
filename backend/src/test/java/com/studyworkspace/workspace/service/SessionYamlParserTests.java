package com.studyworkspace.workspace.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import com.studyworkspace.workspace.domain.WorkspaceException;
import com.studyworkspace.workspace.domain.WorkspaceModels.SessionItem;
import com.studyworkspace.workspace.domain.WorkspaceModels.StudySession;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class SessionYamlParserTests {
	private final SessionYamlSerializer serializer = new SessionYamlSerializer(new ObjectMapper());
	private final SessionYamlParser parser = new SessionYamlParser();

	@Test
	void parsesSerializerOutputAndUsesGitLabCommitId() {
		StudySession source = new StudySession(
			"2026-08-09", "260809", 2, "algorithm", "OAuth 일정", "설명", "active",
			"2026-08-09T23:59:00+09:00", "2026-08-10T23:59:00+09:00",
			"2026-08-09T00:00:00Z", "lhc0688", "2026-08-09T01:00:00Z", "lhc0688", null,
			List.of(new SessionItem("item-1", 1, "문제 풀이", null, null, "text", true, "active", null, null)),
			List.of(), null
		);

		StudySession parsed = parser.parse("260809/session.yml", serializer.serialize(source), "gitlab-sha-1");

		assertThat(parsed).usingRecursiveComparison().ignoringFields("lastCommitId").isEqualTo(source);
		assertThat(parsed.lastCommitId()).isEqualTo("gitlab-sha-1");
	}

	@Test
	void rejectsAFileWhoseFolderAndDateDiffer() {
		String yaml = serializer.serialize(validSession()).replace("2026-08-09", "2026-08-10");

		assertThatThrownBy(() -> parser.parse("260809/session.yml", yaml, "sha"))
			.isInstanceOf(WorkspaceException.class)
			.hasMessageContaining("폴더 날짜");
	}

	@Test
	void rejectsDuplicateYamlKeys() {
		String yaml = serializer.serialize(validSession()) + "title: \"중복\"\n";

		assertThatThrownBy(() -> parser.parse("260809/session.yml", yaml, "sha"))
			.isInstanceOf(WorkspaceException.class)
			.hasMessageContaining("문법");
	}

	@Test
	void preservesIndependentItemTypesAndFallsBackForLegacyFiles() {
		StudySession mixed = new StudySession(
			"2026-08-09", "260809", 1, "algorithm", "혼합 학습", "", "active",
			"2026-08-09T23:59:00+09:00", null,
			"2026-08-09T00:00:00Z", "owner", "2026-08-09T00:00:00Z", "owner", null,
			List.of(new SessionItem("item-1", 1, "영어 읽기", "english", null, null, "text", true, "active", null, null)),
			List.of(), null
		);

		String yaml = serializer.serialize(mixed);
		StudySession parsed = parser.parse("260809/session.yml", yaml, "sha");
		StudySession legacyParsed = parser.parse(
			"260809/session.yml", yaml.replace("    type: \"english\"\n", ""), "sha"
		);

		assertThat(parsed.items().getFirst().type()).isEqualTo("english");
		assertThat(legacyParsed.items().getFirst().type()).isEqualTo("algorithm");
	}

	static StudySession validSession() {
		return new StudySession(
			"2026-08-09", "260809", 1, "cs", "제목", "", "active",
			"2026-08-09T23:59:00+09:00", null,
			"2026-08-09T00:00:00Z", "owner", "2026-08-09T00:00:00Z", "owner", null,
			List.of(new SessionItem("item-1", 1, "읽기", null, null, "text", true, "active", null, null)),
			List.of(), null
		);
	}
}
