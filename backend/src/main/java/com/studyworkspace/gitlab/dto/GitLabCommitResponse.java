package com.studyworkspace.gitlab.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record GitLabCommitResponse(
	@JsonProperty("file_path") String filePath,
	String branch
) {
}
