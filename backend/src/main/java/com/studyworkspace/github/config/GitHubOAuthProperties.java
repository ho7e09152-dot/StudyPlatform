package com.studyworkspace.github.config;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.StringUtils;

@ConfigurationProperties(prefix = "app.github.oauth")
public record GitHubOAuthProperties(
	String clientId,
	String clientSecret,
	String redirectUri,
	String scope,
	String authorizationBaseUrl,
	String apiBaseUrl,
	Duration requestTimeout,
	Duration stateTtl
) {
	public GitHubOAuthProperties {
		clientId = normalize(clientId);
		clientSecret = normalize(clientSecret);
		redirectUri = normalize(redirectUri);
		scope = normalize(scope);
		authorizationBaseUrl = StringUtils.hasText(authorizationBaseUrl)
			? authorizationBaseUrl.replaceAll("/+$", "") : "https://github.com";
		apiBaseUrl = StringUtils.hasText(apiBaseUrl)
			? apiBaseUrl.replaceAll("/+$", "") : "https://api.github.com";
		requestTimeout = requestTimeout == null ? Duration.ofSeconds(10) : requestTimeout;
		stateTtl = stateTtl == null ? Duration.ofMinutes(10) : stateTtl;
	}

	public boolean isConfigured() {
		return StringUtils.hasText(clientId) && StringUtils.hasText(clientSecret) && StringUtils.hasText(redirectUri);
	}

	@Override
	public String toString() {
		return "GitHubOAuthProperties[clientId=<redacted>, clientSecret=<redacted>, redirectUri=%s, scope=%s, stateTtl=%s]"
			.formatted(redirectUri, scope, stateTtl);
	}

	private static String normalize(String value) {
		return value == null ? "" : value.trim();
	}
}
