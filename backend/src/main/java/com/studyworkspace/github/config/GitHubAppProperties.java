package com.studyworkspace.github.config;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.StringUtils;

/** Typed Study-ing configuration for GitHub App user and app authentication. */
@ConfigurationProperties(prefix = "github.app")
public record GitHubAppProperties(
	String id,
	String slug,
	String clientId,
	String clientSecret,
	String redirectUri,
	String privateKeyPath,
	Features features,
	String authorizationBaseUrl,
	String apiBaseUrl,
	Duration requestTimeout,
	Duration stateTtl
) {
	public GitHubAppProperties {
		id = normalize(id);
		slug = StringUtils.hasText(slug) ? slug.trim() : "study-ing";
		clientId = normalize(clientId);
		clientSecret = normalize(clientSecret);
		redirectUri = normalize(redirectUri);
		privateKeyPath = normalize(privateKeyPath);
		features = features == null ? new Features(false, false, false) : features;
		authorizationBaseUrl = normalizeBaseUrl(authorizationBaseUrl, "https://github.com");
		apiBaseUrl = normalizeBaseUrl(apiBaseUrl, "https://api.github.com");
		requestTimeout = requestTimeout == null ? Duration.ofSeconds(10) : requestTimeout;
		stateTtl = stateTtl == null ? Duration.ofMinutes(10) : stateTtl;
	}

	public boolean userAuthorizationConfigured() {
		return StringUtils.hasText(clientId)
			&& StringUtils.hasText(clientSecret)
			&& StringUtils.hasText(redirectUri);
	}

	public boolean accountLinkingReady() {
		return features.accountLinking() && userAuthorizationConfigured();
	}

	public boolean appAuthenticationConfigured() {
		return id.matches("[1-9][0-9]*") && StringUtils.hasText(privateKeyPath);
	}

	@Override
	public String toString() {
		return "GitHubAppProperties[id=<redacted>, slug=%s, clientId=<redacted>, clientSecret=<redacted>, "
			+ "redirectUri=%s, privateKeyPath=<redacted>, features=%s, stateTtl=%s]"
			.formatted(slug, redirectUri, features, stateTtl);
	}

	public record Features(boolean accountLinking, boolean login, boolean repository) {}

	private static String normalize(String value) {
		return value == null ? "" : value.trim();
	}

	private static String normalizeBaseUrl(String value, String fallback) {
		return StringUtils.hasText(value) ? value.trim().replaceAll("/+$", "") : fallback;
	}
}
