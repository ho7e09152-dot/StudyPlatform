package com.studyworkspace.gitlab.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;

public record GitLabProject(
	long id,
	String name,
	@JsonAlias("path_with_namespace") String pathWithNamespace,
	@JsonAlias("default_branch") String defaultBranch,
	@JsonAlias("web_url") String webUrl,
	String visibility,
	Permissions permissions
) {
	public GitLabProject(long id, String name, String pathWithNamespace, String defaultBranch, String webUrl, String visibility) {
		this(id, name, pathWithNamespace, defaultBranch, webUrl, visibility, null);
	}

	@JsonProperty("accessLevel")
	public Integer accessLevel() {
		if (permissions == null) return null;
		Integer project = permissions.projectAccess() == null ? null : permissions.projectAccess().accessLevel();
		Integer group = permissions.groupAccess() == null ? null : permissions.groupAccess().accessLevel();
		if (project == null) return group;
		if (group == null) return project;
		return Math.max(project, group);
	}

	public record Permissions(
		@JsonAlias("project_access") Access projectAccess,
		@JsonAlias("group_access") Access groupAccess
	) {}

	public record Access(@JsonAlias("access_level") Integer accessLevel) {}
}
