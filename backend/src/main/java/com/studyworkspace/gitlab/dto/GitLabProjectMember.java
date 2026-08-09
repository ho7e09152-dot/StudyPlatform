package com.studyworkspace.gitlab.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record GitLabProjectMember(
	long id,
	String username,
	String name,
	String state,
	@JsonProperty("avatar_url") String avatarUrl,
	@JsonProperty("web_url") String webUrl,
	@JsonProperty("access_level") int accessLevel
) {
}
