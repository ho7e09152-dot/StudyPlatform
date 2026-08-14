package com.studyworkspace.github.dto;

import com.fasterxml.jackson.annotation.JsonAlias;

public record GitHubContentResponse(
	String name,
	String path,
	String sha,
	long size,
	String encoding,
	String content,
	@JsonAlias("html_url") String htmlUrl
) { }
