package com.studyworkspace.gitlab.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record GitLabUpdateFileRequest(
	String branch,
	String content,
	@JsonProperty("commit_message") String commitMessage,
	@JsonProperty("last_commit_id") String lastCommitId
) {
}
