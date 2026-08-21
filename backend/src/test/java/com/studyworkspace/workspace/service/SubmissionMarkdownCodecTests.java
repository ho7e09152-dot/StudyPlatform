package com.studyworkspace.workspace.service;

import static com.studyworkspace.workspace.domain.WorkspaceModels.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import com.studyworkspace.workspace.domain.WorkspaceException;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class SubmissionMarkdownCodecTests {
	private final SubmissionMarkdownCodec codec = new SubmissionMarkdownCodec(new ObjectMapper());

	@Test
	void roundTripPreservesStructuredSubmissionValues() {
		StudySession session = session();
		MemberSubmissionFile source = submission(null);

		String markdown = codec.encode(source, session);
		MemberSubmissionFile decoded = codec.decode(markdown, "gitlab-sha");

		assertThat(markdown)
			.startsWith("---\nversion: 1")
			.contains(
				"# 제출 파일 테스트",
				"## 코드 작성",
				"```typescript\nconst text = `---`;\nconsole.log(text);\n```"
			);
		assertThat(decoded.submissions()).usingRecursiveComparison().isEqualTo(source.submissions());
		assertThat(decoded.lastCommitId()).isEqualTo("gitlab-sha");
	}

	@Test
	void codeSubmissionPreservesIndentationAndCannotCloseItsOwnFence() {
		StudySession session = session();
		String code = "def train_one_epoch(model):\n    model.train()\n    note = \"```\"\n    return note";
		MemberSubmissionFile source = new MemberSubmissionFile(
			1, "member-7", 7, "owner", "260809", 1, "cs", "2026-08-09T12:00:00+09:00",
			List.of(new SubmissionEntry(
				"item-code", "code", code, "python",
				"2026-08-09T11:00:00+09:00", "2026-08-09T12:00:00+09:00"
			)),
			null, null, "submit: code"
		);

		String markdown = codec.encode(source, session);

		assertThat(markdown).contains(
			"````python\n"
				+ "def train_one_epoch(model):\n"
				+ "    model.train()\n"
				+ "    note = \"```\"\n"
				+ "    return note\n"
				+ "````"
		);
	}

	@Test
	void rejectsDuplicateFrontMatterKeys() {
		String invalid = codec.encode(submission(null), session()).replace("version: 1", "version: 1\nversion: 2");

		assertThatThrownBy(() -> codec.decode(invalid, "sha"))
			.isInstanceOf(WorkspaceException.class)
			.extracting("code")
			.isEqualTo("SUBMISSION_FILE_INVALID");
	}

	@Test
	void roundTripsChecklistCompletionWithoutRenderingTimedItems() {
		StudySession session = new StudySession(
			"2026-08-09", "260809", 1, "free", "2026-08-09 계획", "", "active",
			"2026-08-09T23:59:00+09:00", null,
			"2026-08-09T00:00:00Z", "owner", "2026-08-09T00:00:00Z", "owner", null,
			List.of(
				new SessionItem("check", 1, "교재 읽기", "cs", null, null, "text", true,
					"active", null, null, "check", null, null, null, null, null),
				new SessionItem("event", 2, "주간 회의", "free", null, null, "text", false,
					"active", null, null, "event", null, null, null, "19:00", "20:00")
			),
			List.of(), "session-sha"
		);
		MemberSubmissionFile source = new MemberSubmissionFile(
			1, "member-7", 7, "김서연", "260809", 1, "free", "2026-08-09T12:00:00+09:00",
			List.of(new SubmissionEntry("check", "check", "completed", null,
				"2026-08-09T11:00:00+09:00", "2026-08-09T12:00:00+09:00")),
			null, null, "study: complete checklist item"
		);

		String markdown = codec.encode(source, session);
		MemberSubmissionFile decoded = codec.decode(markdown, "sha");

		assertThat(markdown).contains("## 교재 읽기", "완료").doesNotContain("## 주간 회의");
		assertThat(decoded.submissions()).usingRecursiveComparison().isEqualTo(source.submissions());
	}

	static StudySession session() {
		return new StudySession(
			"2026-08-09", "260809", 1, "cs", "제출 파일 테스트", "", "active",
			"2026-08-09T23:59:00+09:00", null,
			"2026-08-09T00:00:00Z", "owner", "2026-08-09T00:00:00Z", "owner", null,
			List.of(new SessionItem("item-code", 1, "코드 작성", null, null, "code", true, "active", null, null)),
			List.of(), "session-sha"
		);
	}

	static MemberSubmissionFile submission(String commitId) {
		return new MemberSubmissionFile(
			1, "member-7", 7, "owner", "260809", 1, "cs", "2026-08-09T12:00:00+09:00",
			List.of(new SubmissionEntry(
				"item-code", "code", "const text = `---`;\nconsole.log(text);", "typescript",
				"2026-08-09T11:00:00+09:00", "2026-08-09T12:00:00+09:00"
			)),
			null, commitId, "submit: code"
		);
	}
}
