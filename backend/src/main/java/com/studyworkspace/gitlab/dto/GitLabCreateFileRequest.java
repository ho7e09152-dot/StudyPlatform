package com.studyworkspace.gitlab.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record GitLabCreateFileRequest(
	String branch,
	String content,
	@JsonProperty("commit_message") String commitMessage
) {
}
