package com.studyworkspace.gitlab.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record GitLabUpdateFileRequest(
	String branch,
	String content,
	@JsonProperty("commit_message") String commitMessage,
	@JsonProperty("last_commit_id") String lastCommitId,
	@JsonProperty("author_name") String authorName
) {
	public GitLabUpdateFileRequest(String branch, String content, String commitMessage, String lastCommitId) {
		this(branch, content, commitMessage, lastCommitId, null);
	}
}
