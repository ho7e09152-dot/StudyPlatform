package com.studyworkspace.gitlab.dto;

import com.fasterxml.jackson.annotation.JsonAlias;

public record GitLabUser(
	long id,
	String username,
	String name,
	@JsonAlias("avatar_url") String avatarUrl,
	@JsonAlias("web_url") String webUrl
) {
}
