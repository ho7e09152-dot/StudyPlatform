package com.studyworkspace.gitlab.dto;

import com.fasterxml.jackson.annotation.JsonAlias;

public record GitLabProject(
	long id,
	String name,
	@JsonAlias("path_with_namespace") String pathWithNamespace,
	@JsonAlias("default_branch") String defaultBranch,
	@JsonAlias("web_url") String webUrl,
	String visibility
) {
}
