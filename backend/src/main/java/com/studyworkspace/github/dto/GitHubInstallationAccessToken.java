package com.studyworkspace.github.dto;

import java.time.Instant;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public record GitHubInstallationAccessToken(
	String token,
	@JsonProperty("expires_at") Instant expiresAt,
	Map<String, String> permissions
) {
	@Override
	public String toString() {
		return "GitHubInstallationAccessToken[token=<redacted>, expiresAt=%s, permissions=%s]"
			.formatted(expiresAt, permissions);
	}
}
