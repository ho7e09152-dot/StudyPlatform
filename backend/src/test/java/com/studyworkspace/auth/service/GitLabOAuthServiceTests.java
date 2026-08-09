package com.studyworkspace.auth.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;

import com.studyworkspace.auth.config.GitLabOAuthProperties;
import com.studyworkspace.auth.dto.GitLabOAuthSession;
import com.studyworkspace.gitlab.config.GitLabProperties;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.client.WebClient;

class GitLabOAuthServiceTests {

	private HttpServer server;
	private GitLabOAuthService service;
	private final AtomicReference<Map<String, String>> tokenForm = new AtomicReference<>();
	private final AtomicReference<String> userAuthorization = new AtomicReference<>();

	@BeforeEach
	void setUp() throws IOException {
		server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
		server.createContext("/", this::handle);
		server.start();
		String baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
		service = new GitLabOAuthService(
			WebClient.builder(),
			new GitLabProperties(baseUrl, "", "", "", Duration.ofSeconds(2)),
			new GitLabOAuthProperties(
				"application-id", "application-secret",
				"http://localhost:8080/api/v1/auth/gitlab/callback", "api", Duration.ofMinutes(10)
			)
		);
	}

	@AfterEach
	void tearDown() {
		server.stop(0);
	}

	@Test
	void buildsAuthorizationUrlWithStateAndConfiguredCallback() {
		String state = service.createState();
		String secondState = service.createState();
		String url = service.authorizationUrl(state);

		assertThat(state).hasSizeGreaterThan(40).isNotEqualTo(secondState);
		assertThat(url)
			.startsWith("http://127.0.0.1:")
			.contains("/oauth/authorize?")
			.contains("client_id=application-id")
			.contains("response_type=code")
			.contains("scope=api")
			.contains("state=" + state)
			.contains("redirect_uri=http://localhost:8080/api/v1/auth/gitlab/callback");
	}

	@Test
	void exchangesAuthorizationCodeAndLoadsUserWithBearerToken() {
		GitLabOAuthSession oauth = service.exchangeAndLoadUser("returned-code");

		assertThat(oauth.user().id()).isEqualTo(77);
		assertThat(oauth.user().username()).isEqualTo("oauth-member");
		assertThat(oauth.accessToken()).isEqualTo("oauth-access-token");
		assertThat(oauth.refreshToken()).isEqualTo("oauth-refresh-token");
		assertThat(tokenForm.get()).containsEntry("grant_type", "authorization_code")
			.containsEntry("code", "returned-code")
			.containsEntry("client_id", "application-id")
			.containsEntry("client_secret", "application-secret");
		assertThat(userAuthorization).hasValue("Bearer oauth-access-token");
	}

	private void handle(HttpExchange exchange) throws IOException {
		String path = exchange.getRequestURI().getPath();
		if (path.equals("/oauth/token")) {
			tokenForm.set(parseForm(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8)));
			send(exchange, 200, """
				{"access_token":"oauth-access-token","token_type":"Bearer","expires_in":7200,
				 "refresh_token":"oauth-refresh-token","created_at":1786200000,"scope":"api"}
				""");
			return;
		}
		if (path.equals("/api/v4/user")) {
			userAuthorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
			send(exchange, 200, """
				{"id":77,"username":"oauth-member","name":"OAuth Member",
				 "avatar_url":"https://example.com/avatar.png","web_url":"https://gitlab.example.com/oauth-member"}
				""");
			return;
		}
		exchange.sendResponseHeaders(404, -1);
		exchange.close();
	}

	private static Map<String, String> parseForm(String body) {
		return java.util.Arrays.stream(body.split("&"))
			.map(entry -> entry.split("=", 2))
			.collect(Collectors.toMap(
				entry -> decode(entry[0]),
				entry -> entry.length > 1 ? decode(entry[1]) : ""
			));
	}

	private static String decode(String value) {
		return URLDecoder.decode(value, StandardCharsets.UTF_8);
	}

	private static void send(HttpExchange exchange, int status, String response) throws IOException {
		byte[] body = response.getBytes(StandardCharsets.UTF_8);
		exchange.getResponseHeaders().set("Content-Type", MediaType.APPLICATION_JSON_VALUE);
		exchange.sendResponseHeaders(status, body.length);
		exchange.getResponseBody().write(body);
		exchange.close();
	}
}
