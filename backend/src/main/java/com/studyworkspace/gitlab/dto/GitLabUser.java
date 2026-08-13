package com.studyworkspace.gitlab.dto;

import java.io.Serializable;
import java.util.Objects;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;

public class GitLabUser implements Serializable {
	private final long id;
	private final String username;
	private final String name;
	private final String avatarUrl;
	private final String webUrl;

	@JsonCreator
	public GitLabUser(@JsonProperty("id") long id, @JsonProperty("username") String username, @JsonProperty("name") String name,
		@JsonAlias("avatar_url") String avatarUrl,
		@JsonAlias("web_url") String webUrl) {
		this.id = id;
		this.username = username;
		this.name = name;
		this.avatarUrl = avatarUrl;
		this.webUrl = webUrl;
	}

	public long id() { return id; }
	public String username() { return username; }
	public String name() { return name; }
	public String avatarUrl() { return avatarUrl; }
	public String webUrl() { return webUrl; }

	@Override public boolean equals(Object other) {
		if (this == other) return true;
		if (!(other instanceof GitLabUser user)) return false;
		return id == user.id && Objects.equals(username, user.username) && Objects.equals(name, user.name)
			&& Objects.equals(avatarUrl, user.avatarUrl) && Objects.equals(webUrl, user.webUrl);
	}

	@Override public int hashCode() { return Objects.hash(id, username, name, avatarUrl, webUrl); }
	@Override public String toString() { return "GitLabUser[id=" + id + ", username=" + username + "]"; }
}
