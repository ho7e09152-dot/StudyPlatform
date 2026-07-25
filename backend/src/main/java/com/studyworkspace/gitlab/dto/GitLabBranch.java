package com.studyworkspace.gitlab.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record GitLabBranch(
	String name,
	@JsonProperty("default") boolean defaultBranch,
	@JsonProperty("protected") boolean protectedBranch,
	@JsonProperty("can_push") boolean canPush,
	@JsonProperty("web_url") String webUrl
) {
}
