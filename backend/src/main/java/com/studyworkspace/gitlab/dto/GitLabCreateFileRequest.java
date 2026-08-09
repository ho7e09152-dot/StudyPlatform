package com.studyworkspace.gitlab.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record GitLabCreateFileRequest(
	String branch,
	String content,
	@JsonProperty("commit_message") String commitMessage,
	@JsonProperty("author_name") String authorName
) {
	public GitLabCreateFileRequest(String branch, String content, String commitMessage) {
		this(branch, content, commitMessage, null);
	}
}
