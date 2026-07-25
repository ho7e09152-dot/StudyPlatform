package com.studyworkspace.common.config;

import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.cors")
public record CorsProperties(List<String> allowedOrigins) {

	public CorsProperties {
		allowedOrigins = allowedOrigins == null || allowedOrigins.isEmpty()
			? List.of("http://localhost:3000", "http://127.0.0.1:3000")
			: List.copyOf(allowedOrigins);
	}
}
