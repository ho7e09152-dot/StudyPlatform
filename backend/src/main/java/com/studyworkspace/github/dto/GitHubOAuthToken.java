package com.studyworkspace.github.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record GitHubOAuthToken(
	@JsonProperty("access_token") String accessToken,
	@JsonProperty("token_type") String tokenType,
	String scope,
	@JsonProperty("expires_in") Long expiresIn,
	@JsonProperty("refresh_token") String refreshToken
) {
	@Override
	public String toString() {
		return "GitHubOAuthToken[accessToken=<redacted>, tokenType=%s, scope=%s, expiresIn=%s, refreshToken=<redacted>]"
			.formatted(tokenType, scope, expiresIn);
	}
}
