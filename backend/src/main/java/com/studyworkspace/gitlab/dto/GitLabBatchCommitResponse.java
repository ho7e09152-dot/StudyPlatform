package com.studyworkspace.gitlab.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record GitLabBatchCommitResponse(
	String id,
	@JsonProperty("short_id") String shortId,
	String title,
	String message,
	@JsonProperty("web_url") String webUrl
) {
}
