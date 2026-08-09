package com.studyworkspace.auth.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.security")
public record TokenEncryptionProperties(String tokenEncryptionKey) {
}
