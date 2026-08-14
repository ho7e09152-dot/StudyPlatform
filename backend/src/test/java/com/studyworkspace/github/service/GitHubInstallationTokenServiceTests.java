package com.studyworkspace.github.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicReference;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import com.studyworkspace.github.config.GitHubAppConfigurationValidator;
import com.studyworkspace.github.config.GitHubAppProperties;
import com.studyworkspace.workspace.domain.WorkspaceException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClient;

class GitHubInstallationTokenServiceTests {
	private HttpServer server;

	@AfterEach
	void stopServer() {
		if (server != null) server.stop(0);
	}

	@Test
	void exchangesAnAppJwtOnlyForAPreverifiedInstallation() throws IOException {
		AtomicReference<String> path = new AtomicReference<>();
		AtomicReference<String> authorization = new AtomicReference<>();
		server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
		server.createContext("/app/installations/777/access_tokens", exchange -> {
			path.set(exchange.getRequestURI().getPath());
			authorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
			respondJson(exchange, """
				{"token":"installation-secret","expires_at":"2026-08-14T01:00:00Z","permissions":{"contents":"write"}}
				""");
		});
		server.start();

		String baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
		GitHubAppConfigurationValidator validator = mock(GitHubAppConfigurationValidator.class);
		GitHubAppJwtService jwtService = mock(GitHubAppJwtService.class);
		when(jwtService.createJwt()).thenReturn("signed-app-jwt");
		var service = new GitHubInstallationTokenService(
			WebClient.builder(), properties(baseUrl), validator, jwtService
		);

		var token = service.createForVerifiedInstallation(777);

		assertThat(path.get()).isEqualTo("/app/installations/777/access_tokens");
		assertThat(authorization.get()).isEqualTo("Bearer signed-app-jwt");
		assertThat(token.expiresAt()).isEqualTo(Instant.parse("2026-08-14T01:00:00Z"));
		assertThat(token.permissions()).containsEntry("contents", "write");
		assertThat(token.toString()).doesNotContain("installation-secret");
	}

	@Test
	void rejectsUntrustedInvalidInstallationIdsBeforeAuthentication() {
		GitHubAppConfigurationValidator validator = mock(GitHubAppConfigurationValidator.class);
		GitHubAppJwtService jwtService = mock(GitHubAppJwtService.class);
		var service = new GitHubInstallationTokenService(
			WebClient.builder(), properties("https://api.github.com"), validator, jwtService
		);

		assertThatThrownBy(() -> service.createForVerifiedInstallation(0))
			.isInstanceOf(WorkspaceException.class)
			.extracting("code").isEqualTo("GITHUB_INSTALLATION_INVALID");
		verifyNoInteractions(validator, jwtService);
	}

	private static GitHubAppProperties properties(String apiBaseUrl) {
		return new GitHubAppProperties(
			"123456", "study-ing", "client", "secret", "https://example/callback", "/run/secrets/key.pem",
			new GitHubAppProperties.Features(false, false, true), "https://github.com", apiBaseUrl,
			Duration.ofSeconds(5), Duration.ofMinutes(10)
		);
	}

	private static void respondJson(HttpExchange exchange, String body) throws IOException {
		byte[] bytes = body.getBytes(java.nio.charset.StandardCharsets.UTF_8);
		exchange.getResponseHeaders().set("Content-Type", "application/json");
		exchange.sendResponseHeaders(201, bytes.length);
		exchange.getResponseBody().write(bytes);
		exchange.close();
	}
}
