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
	void parsesV2SessionPathWhileKeepingTheInternalLegacyFolderKey() {
		StudySession source = validSession();

		StudySession parsed = parser.parse(
			"sessions/2026/2026-08-09/session.yml",
			serializer.serialize(source),
			"gitlab-sha-v2"
		);

		assertThat(parsed.date()).isEqualTo("2026-08-09");
		assertThat(parsed.folder()).isEqualTo("260809");
		assertThat(parsed.lastCommitId()).isEqualTo("gitlab-sha-v2");
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
			"260809/session.yml", yaml
				.replace("    kind: \"submission\"\n", "")
				.replace("    type: \"english\"\n", ""), "sha"
		);

		assertThat(parsed.items().getFirst().type()).isEqualTo("english");
		assertThat(legacyParsed.items().getFirst().type()).isEqualTo("algorithm");
		assertThat(legacyParsed.items().getFirst().kind()).isEqualTo("submission");
	}

	@Test
	void roundTripsSubmissionChecklistAndTimedItems() {
		StudySession mixed = new StudySession(
			"2026-08-09", "260809", 1, "free", "2026-08-09 계획", "", "active",
			"2026-08-09T23:59:00+09:00", null,
			"2026-08-09T00:00:00Z", "owner", "2026-08-09T00:00:00Z", "owner", null,
			List.of(
				new SessionItem("submit", 1, "문제 풀이", "algorithm", null, null, "link", true,
					"active", null, null, "submission", "풀이 링크를 남겨요.",
					"2026-08-09T22:00:00+09:00", null, null, null),
				new SessionItem("check", 2, "교재 읽기", "cs", null, null, "text", true,
					"active", null, null, "check", "3장을 읽어요.", null, null, null, null),
				new SessionItem("event", 3, "주간 회의", "free", null, null, "text", false,
					"active", null, null, "event", "진행 상황을 공유해요.", null, null, "19:00", "20:00")
			),
			List.of(), null
		);

		StudySession parsed = parser.parse("260809/session.yml", serializer.serialize(mixed), "sha");

		assertThat(parsed.items()).usingRecursiveComparison().isEqualTo(mixed.items());
	}

	@Test
	void rejectsTimedItemsWhoseEndIsNotAfterStart() {
		StudySession session = new StudySession(
			"2026-08-09", "260809", 1, "free", "2026-08-09 계획", "", "active",
			"2026-08-09T23:59:00+09:00", null,
			"2026-08-09T00:00:00Z", "owner", "2026-08-09T00:00:00Z", "owner", null,
			List.of(new SessionItem("event", 1, "회의", "free", null, null, "text", false,
				"active", null, null, "event", null, null, null, "20:00", "19:00")),
			List.of(), null
		);

		assertThatThrownBy(() -> parser.parse("260809/session.yml", serializer.serialize(session), "sha"))
			.isInstanceOf(WorkspaceException.class)
			.hasMessageContaining("종료 시간");
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
