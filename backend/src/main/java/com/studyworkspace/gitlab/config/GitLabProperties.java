package com.studyworkspace.gitlab.config;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.StringUtils;

@ConfigurationProperties(prefix = "app.gitlab")
public record GitLabProperties(
	String baseUrl,
	String accessToken,
	String projectId,
	String defaultRef,
	Duration requestTimeout
) {
	public GitLabProperties {
		baseUrl = normalizeBaseUrl(baseUrl);
		accessToken = accessToken == null ? "" : accessToken.trim();
		projectId = projectId == null ? "" : projectId.trim();
		defaultRef = defaultRef == null ? "" : defaultRef.trim();
		requestTimeout = requestTimeout == null ? Duration.ofSeconds(10) : requestTimeout;
	}

	public boolean isConfigured() {
		return StringUtils.hasText(accessToken) && StringUtils.hasText(projectId);
	}

	public String apiBaseUrl() {
		return baseUrl + "/api/v4";
	}

	@Override
	public String toString() {
		return "GitLabProperties[baseUrl=%s, accessToken=<redacted>, projectId=%s, defaultRef=%s, requestTimeout=%s]"
			.formatted(baseUrl, projectId, defaultRef, requestTimeout);
	}

	private static String normalizeBaseUrl(String value) {
		String normalized = StringUtils.hasText(value) ? value.trim() : "https://lab.ssafy.com";
		while (normalized.endsWith("/")) {
			normalized = normalized.substring(0, normalized.length() - 1);
		}
		return normalized;
	}
}
