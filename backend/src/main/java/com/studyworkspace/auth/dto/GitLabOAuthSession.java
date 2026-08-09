package com.studyworkspace.auth.dto;

import java.io.Serializable;
import java.time.Instant;

import com.studyworkspace.gitlab.dto.GitLabUser;

public record GitLabOAuthSession(
	GitLabUser user,
	String accessToken,
	String refreshToken,
	Instant expiresAt,
	String scope
) implements Serializable {
	public boolean expiresWithinSeconds(long seconds) {
		return expiresAt.minusSeconds(seconds).isBefore(Instant.now());
	}

	@Override
	public String toString() {
		return "GitLabOAuthSession[user=%s, accessToken=<redacted>, refreshToken=<redacted>, expiresAt=%s, scope=%s]"
			.formatted(user == null ? null : user.username(), expiresAt, scope);
	}
}
