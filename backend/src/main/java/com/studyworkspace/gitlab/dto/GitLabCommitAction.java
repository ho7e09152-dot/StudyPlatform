package com.studyworkspace.gitlab.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record GitLabCommitAction(
	String action,
	@JsonProperty("file_path") String filePath,
	@JsonProperty("previous_path") String previousPath,
	String content,
	@JsonProperty("last_commit_id") String lastCommitId
) {
	public static GitLabCommitAction move(String previousPath, String filePath) {
		return new GitLabCommitAction("move", filePath, previousPath, null, null);
	}

	public static GitLabCommitAction create(String filePath, String content) {
		return new GitLabCommitAction("create", filePath, null, content, null);
	}

	public static GitLabCommitAction update(String filePath, String content, String lastCommitId) {
		return new GitLabCommitAction("update", filePath, null, content, lastCommitId);
	}
}
