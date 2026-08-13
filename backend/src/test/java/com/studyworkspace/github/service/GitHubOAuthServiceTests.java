package com.studyworkspace.github.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicReference;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import com.studyworkspace.github.config.GitHubOAuthProperties;
import com.studyworkspace.workspace.domain.RepositoryProvider;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClient;

class GitHubOAuthServiceTests {
	private HttpServer server;

	@AfterEach
	void stopServer() {
		if (server != null) server.stop(0);
	}

	@Test
	void authorizationUrlUsesStatePkceAndMinimumIdentityScope() {
		GitHubOAuthProperties properties = new GitHubOAuthProperties(
			"client-id", "client-secret", "https://study-ing.example/api/v1/provider-accounts/github/callback",
			"", "https://github.com", "https://api.github.com", Duration.ofSeconds(10), Duration.ofMinutes(10)
		);
		GitHubOAuthService service = new GitHubOAuthService(WebClient.builder(), properties);
		String verifier = service.createCodeVerifier();
		String url = service.authorizationUrl("csrf-state", service.codeChallenge(verifier));

		assertThat(verifier.length()).isBetween(43, 128);
		assertThat(url).contains("state=csrf-state", "code_challenge_method=S256", "prompt=select_account");
		assertThat(url).doesNotContain("scope=");
		assertThat(url).doesNotContain("client-secret");
		assertThat(properties.toString()).doesNotContain("client-secret");
	}

	@Test
	void exchangesCodeAndNormalizesOnlyRequiredIdentityFields() throws IOException {
		AtomicReference<String> tokenRequestBody = new AtomicReference<>();
		AtomicReference<String> identityAuthorization = new AtomicReference<>();
		server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
		server.createContext("/login/oauth/access_token", exchange -> {
			tokenRequestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
			respondJson(exchange, """
				{"access_token":"github-token","token_type":"bearer","scope":"read:user"}
				""");
		});
		server.createContext("/user", exchange -> {
			identityAuthorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
			respondJson(exchange, """
				{"id":4242,"login":"octocat","name":"The Octocat","avatar_url":"https://avatars.example/42","html_url":"https://github.com/octocat","email":"ignored@example.com"}
				""");
		});
		server.start();

		String baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
		GitHubOAuthProperties properties = new GitHubOAuthProperties(
			"client-id", "client-secret", "https://study-ing.example/api/v1/provider-accounts/github/callback",
			"read:user", baseUrl, baseUrl, Duration.ofSeconds(5), Duration.ofMinutes(10)
		);
		GitHubAccountLinkProof proof = new GitHubOAuthService(WebClient.builder(), properties)
			.exchangeAndLoadIdentity("authorization-code", "pkce-verifier");

		String decodedBody = URLDecoder.decode(tokenRequestBody.get(), StandardCharsets.UTF_8);
		assertThat(decodedBody).contains(
			"client_id=client-id",
			"client_secret=client-secret",
			"code=authorization-code",
			"code_verifier=pkce-verifier"
		);
		assertThat(identityAuthorization.get()).isEqualTo("Bearer github-token");
		assertThat(proof.identity().provider()).isEqualTo(RepositoryProvider.GITHUB);
		assertThat(proof.identity().externalUserId()).isEqualTo("4242");
		assertThat(proof.identity().username()).isEqualTo("octocat");
		assertThat(proof.identity().displayName()).isEqualTo("The Octocat");
		assertThat(proof.credential().accessToken()).isEqualTo("github-token");
		assertThat(proof.credential().scope()).isEqualTo("read:user");
		assertThat(proof.credential().expiresAt()).isNull();
		assertThat(proof.toString()).doesNotContain("github-token", "client-secret");
	}

	private void respondJson(HttpExchange exchange, String body) throws IOException {
		byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
		exchange.getResponseHeaders().set("Content-Type", "application/json");
		exchange.sendResponseHeaders(200, bytes.length);
		exchange.getResponseBody().write(bytes);
		exchange.close();
	}
}
