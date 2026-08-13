package com.studyworkspace.github.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public record GitHubUser(
	long id,
	String login,
	String name,
	@JsonProperty("avatar_url") String avatarUrl,
	@JsonProperty("html_url") String webUrl
) { }
