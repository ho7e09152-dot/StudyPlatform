package com.studyworkspace.github.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.Signature;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.Map;

import com.studyworkspace.github.config.GitHubAppPrivateKeyLoader;
import com.studyworkspace.github.config.GitHubAppProperties;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

class GitHubAppJwtServiceTests {
	@TempDir Path tempDir;

	@Test
	void createsAValidShortLivedRs256AppJwtWithoutPersistingIt() throws Exception {
		KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
		generator.initialize(2048);
		KeyPair keyPair = generator.generateKeyPair();
		Path pem = tempDir.resolve("github-app.pem");
		String body = Base64.getMimeEncoder(64, "\n".getBytes(StandardCharsets.US_ASCII))
			.encodeToString(keyPair.getPrivate().getEncoded());
		Files.writeString(pem, "-----BEGIN PRIVATE KEY-----\n" + body + "\n-----END PRIVATE KEY-----\n");

		GitHubAppProperties properties = new GitHubAppProperties(
			"987654", "study-ing", "client", "secret", "https://example/callback", pem.toString(),
			new GitHubAppProperties.Features(false, false, true), "https://github.com", "https://api.github.com",
			Duration.ofSeconds(10), Duration.ofMinutes(10)
		);
		ObjectMapper mapper = new ObjectMapper();
		Instant now = Instant.parse("2026-08-14T00:00:00Z");
		String jwt = new GitHubAppJwtService(
			properties, new GitHubAppPrivateKeyLoader(properties), mapper, Clock.fixed(now, ZoneOffset.UTC)
		).createJwt();

		String[] segments = jwt.split("\\.");
		assertThat(segments).hasSize(3);
		Map<String, Object> header = decode(mapper, segments[0]);
		Map<String, Object> claims = decode(mapper, segments[1]);
		assertThat(header).containsEntry("alg", "RS256").containsEntry("typ", "JWT");
		assertThat(claims).containsEntry("iss", "987654");
		assertThat(((Number) claims.get("iat")).longValue()).isEqualTo(now.minusSeconds(60).getEpochSecond());
		assertThat(((Number) claims.get("exp")).longValue()).isEqualTo(now.plusSeconds(540).getEpochSecond());

		Signature verifier = Signature.getInstance("SHA256withRSA");
		verifier.initVerify(keyPair.getPublic());
		verifier.update((segments[0] + "." + segments[1]).getBytes(StandardCharsets.US_ASCII));
		assertThat(verifier.verify(Base64.getUrlDecoder().decode(segments[2]))).isTrue();
	}

	private static Map<String, Object> decode(ObjectMapper mapper, String segment) throws Exception {
		return mapper.readValue(Base64.getUrlDecoder().decode(segment), new TypeReference<>() {});
	}
}
