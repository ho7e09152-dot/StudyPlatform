package com.studyworkspace.github.dto;

import java.util.Map;

import com.fasterxml.jackson.annotation.JsonAlias;

public record GitHubRepository(
	long id,
	String name,
	@JsonAlias("full_name") String fullName,
	@JsonAlias("private") boolean privateRepository,
	String visibility,
	@JsonAlias("default_branch") String defaultBranch,
	@JsonAlias("html_url") String webUrl,
	Map<String, Boolean> permissions
) { }
