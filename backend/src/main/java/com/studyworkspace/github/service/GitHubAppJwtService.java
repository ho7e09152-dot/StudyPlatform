package com.studyworkspace.github.service;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.Signature;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;

import com.studyworkspace.github.config.GitHubAppConfigurationException;
import com.studyworkspace.github.config.GitHubAppPrivateKeyLoader;
import com.studyworkspace.github.config.GitHubAppProperties;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

/** Generates short-lived RS256 GitHub App JWTs; JWTs are never persisted. */
@Service
public class GitHubAppJwtService {
	private static final Base64.Encoder BASE64_URL = Base64.getUrlEncoder().withoutPadding();

	private final GitHubAppProperties properties;
	private final GitHubAppPrivateKeyLoader privateKeyLoader;
	private final ObjectMapper objectMapper;
	private final Clock clock;

	@Autowired
	public GitHubAppJwtService(
		GitHubAppProperties properties,
		GitHubAppPrivateKeyLoader privateKeyLoader,
		ObjectMapper objectMapper
	) {
		this(properties, privateKeyLoader, objectMapper, Clock.systemUTC());
	}

	GitHubAppJwtService(
		GitHubAppProperties properties,
		GitHubAppPrivateKeyLoader privateKeyLoader,
		ObjectMapper objectMapper,
		Clock clock
	) {
		this.properties = properties;
		this.privateKeyLoader = privateKeyLoader;
		this.objectMapper = objectMapper;
		this.clock = clock;
	}

	public String createJwt() {
		if (!properties.appAuthenticationConfigured()) {
			throw new GitHubAppConfigurationException("GitHub App ID and private key path are required to create an app JWT.");
		}
		Instant now = clock.instant().truncatedTo(ChronoUnit.SECONDS);
		Map<String, Object> header = new LinkedHashMap<>();
		header.put("alg", "RS256");
		header.put("typ", "JWT");
		Map<String, Object> claims = new LinkedHashMap<>();
		claims.put("iat", now.minusSeconds(60).getEpochSecond());
		claims.put("exp", now.plusSeconds(9 * 60).getEpochSecond());
		claims.put("iss", properties.id());

		try {
			String signingInput = encodeJson(header) + "." + encodeJson(claims);
			Signature signer = Signature.getInstance("SHA256withRSA");
			signer.initSign(privateKeyLoader.load());
			signer.update(signingInput.getBytes(StandardCharsets.US_ASCII));
			return signingInput + "." + BASE64_URL.encodeToString(signer.sign());
		} catch (GeneralSecurityException | JacksonException exception) {
			throw new GitHubAppConfigurationException("GitHub App JWT could not be generated.");
		}
	}

	private String encodeJson(Map<String, Object> value) throws JacksonException {
		return BASE64_URL.encodeToString(objectMapper.writeValueAsBytes(value));
	}
}
