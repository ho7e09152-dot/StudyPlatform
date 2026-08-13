package com.studyworkspace.provider;

import java.time.Instant;

/** Plain credential exists only in-memory between OAuth exchange and encrypted persistence. */
public record ProviderOAuthCredential(
	String accessToken,
	String refreshToken,
	Instant expiresAt,
	String scope
) {
	@Override
	public String toString() {
		return "ProviderOAuthCredential[accessToken=<redacted>, refreshToken=<redacted>, expiresAt=%s, scope=%s]"
			.formatted(expiresAt, scope);
	}
}
