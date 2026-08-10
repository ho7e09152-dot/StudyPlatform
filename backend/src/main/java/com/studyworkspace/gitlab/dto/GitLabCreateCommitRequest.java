package com.studyworkspace.gitlab.dto;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record GitLabCreateCommitRequest(
	String branch,
	@JsonProperty("commit_message") String commitMessage,
	List<GitLabCommitAction> actions,
	@JsonProperty("author_name") String authorName
) {
}
