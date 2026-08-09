package com.studyworkspace.auth.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record GitLabOAuthToken(
	@JsonProperty("access_token") String accessToken,
	@JsonProperty("token_type") String tokenType,
	@JsonProperty("expires_in") long expiresIn,
	@JsonProperty("refresh_token") String refreshToken,
	@JsonProperty("created_at") long createdAt,
	String scope
) {
	@Override
	public String toString() {
		return "GitLabOAuthToken[accessToken=<redacted>, tokenType=%s, expiresIn=%d, refreshToken=<redacted>, createdAt=%d, scope=%s]"
			.formatted(tokenType, expiresIn, createdAt, scope);
	}
}
