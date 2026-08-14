package com.studyworkspace.github.dto;

import com.fasterxml.jackson.annotation.JsonAlias;

public record GitHubCommitComment(
	long id,
	String body,
	User user,
	@JsonAlias("created_at") String createdAt
) {
	public record User(long id, String login, String name, @JsonAlias("avatar_url") String avatarUrl) { }
}
