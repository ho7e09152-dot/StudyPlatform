package com.studyworkspace.auth.config;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.StringUtils;

@ConfigurationProperties(prefix = "app.gitlab.oauth")
public record GitLabOAuthProperties(
	String clientId,
	String clientSecret,
	String redirectUri,
	String scope,
	Duration stateTtl
) {
	public GitLabOAuthProperties {
		clientId = normalize(clientId);
		clientSecret = normalize(clientSecret);
		redirectUri = normalize(redirectUri);
		scope = StringUtils.hasText(scope) ? scope.trim() : "api";
		stateTtl = stateTtl == null ? Duration.ofMinutes(10) : stateTtl;
	}

	public boolean isConfigured() {
		return StringUtils.hasText(clientId)
			&& StringUtils.hasText(clientSecret)
			&& StringUtils.hasText(redirectUri);
	}

	@Override
	public String toString() {
		return "GitLabOAuthProperties[clientId=<redacted>, clientSecret=<redacted>, redirectUri=%s, scope=%s, stateTtl=%s]"
			.formatted(redirectUri, scope, stateTtl);
	}

	private static String normalize(String value) {
		return value == null ? "" : value.trim();
	}
}
