package com.studyworkspace.github.dto;

import com.fasterxml.jackson.annotation.JsonAlias;

public record GitHubInstallation(
	long id,
	Account account,
	@JsonAlias("repository_selection") String repositorySelection,
	@JsonAlias("target_type") String targetType
) {
	public record Account(long id, String login, String type, @JsonAlias("avatar_url") String avatarUrl) { }
}
