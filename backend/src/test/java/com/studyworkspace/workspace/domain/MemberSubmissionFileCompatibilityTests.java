package com.studyworkspace.workspace.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyworkspace.workspace.domain.WorkspaceModels.MemberSubmissionFile;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class MemberSubmissionFileCompatibilityTests {
	private final ObjectMapper objectMapper = new ObjectMapper();

	@Test
	void readsLegacyItemCommitIdsButNeverWritesOrExposesThem() throws Exception {
		MemberSubmissionFile submission = objectMapper.readValue("""
			{
			  "version": 1,
			  "memberId": "member-1",
			  "gitlabUserId": 1,
			  "username": "member",
			  "date": "260816",
			  "sessionRevision": 1,
			  "sessionType": "algorithm",
			  "updatedAt": "2026-08-16T00:00:00Z",
			  "submissions": [],
			  "reflection": null,
			  "lastCommitId": "abc123",
			  "lastCommitMessage": "legacy",
			  "itemCommitIds": {"legacy-item": "abc123"}
			}
			""", MemberSubmissionFile.class);

		String currentJson = objectMapper.writeValueAsString(submission);

		assertThat(submission.memberId()).isEqualTo("member-1");
		assertThat(currentJson).doesNotContain("itemCommitIds", "legacy-item");
	}
}
