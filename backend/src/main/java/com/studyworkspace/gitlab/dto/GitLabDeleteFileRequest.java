package com.studyworkspace.gitlab.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record GitLabDeleteFileRequest(
	String branch,
	@JsonProperty("commit_message") String commitMessage,
	@JsonProperty("last_commit_id") String lastCommitId
) {
}
