package com.studyworkspace.github.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import com.studyworkspace.common.exception.GitHubApiException;
import com.studyworkspace.github.config.GitHubAppProperties;
import com.studyworkspace.workspace.domain.RepositoryProvider;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClient;

class GitHubRepositoryServiceTests {
	private HttpServer server;

	@AfterEach
	void stopServer() {
		if (server != null) server.stop(0);
	}

	@Test
	void listsOnlyRepositoriesAvailableThroughTheCurrentUsersInstallations() throws IOException {
		AtomicReference<String> authorization = new AtomicReference<>();
		server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
		server.createContext("/user/installations", exchange -> respondJson(exchange, 200, """
			{"total_count":1,"installations":[{"id":42,"account":{"id":7,"login":"study-team","type":"Organization"},"repository_selection":"selected","target_type":"Organization"}]}
			"""));
		server.createContext("/user/installations/42/repositories", exchange -> {
			authorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
			respondJson(exchange, 200, """
				{"total_count":2,"repositories":[
				 {"id":200,"name":"read-only","full_name":"study-team/read-only","private":true,"visibility":"private","default_branch":"main","html_url":"https://github.com/study-team/read-only","permissions":{"pull":true,"push":false,"admin":false}},
				 {"id":100,"name":"write-repo","full_name":"study-team/write-repo","private":true,"visibility":"private","default_branch":"main","html_url":"https://github.com/study-team/write-repo","permissions":{"pull":true,"push":true,"admin":false}}
				]}
				""");
		});
		server.start();

		var service = service();
		var repositories = service.listRepositories("user-token", "", 1, 20);

		assertThat(authorization.get()).isEqualTo("Bearer user-token");
		assertThat(repositories).extracting(item -> item.provider()).containsOnly(RepositoryProvider.GITHUB);
		assertThat(repositories).extracting(item -> item.fullName())
			.containsExactly("study-team/read-only", "study-team/write-repo");
		assertThat(repositories.get(0).capabilities().canWrite()).isFalse();
		assertThat(repositories.get(1).capabilities().canWrite()).isTrue();
	}

	@Test
	void rejectsASetupInstallationThatIsNotVisibleToTheAuthenticatedGitHubUser() throws IOException {
		server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
		server.createContext("/user/installations", exchange -> respondJson(exchange, 200, """
			{"total_count":1,"installations":[{"id":42,"account":{"id":7,"login":"study-team","type":"Organization"},"repository_selection":"selected","target_type":"Organization"}]}
			"""));
		server.start();

		assertThatThrownBy(() -> service().requireInstallation("user-token", 777))
			.isInstanceOf(GitHubApiException.class)
			.extracting("code").isEqualTo("GITHUB_INSTALLATION_NOT_ACCESSIBLE");
	}

	@Test
	void distinguishesRateLimitFromRepositoryAccessRevocation() throws IOException {
		server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
		server.createContext("/user/installations", exchange -> {
			exchange.getResponseHeaders().set("X-RateLimit-Remaining", "0");
			respondJson(exchange, 403, "{\"message\":\"API rate limit exceeded\"}");
		});
		server.start();

		assertThatThrownBy(() -> service().listInstallations("user-token"))
			.isInstanceOf(GitHubApiException.class)
			.satisfies(error -> {
				GitHubApiException githubError = (GitHubApiException) error;
				assertThat(githubError.code()).isEqualTo("GITHUB_RATE_LIMITED");
				assertThat(githubError.upstreamStatus()).isEqualTo(429);
			});
	}

	private GitHubRepositoryService service() {
		String baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
		return new GitHubRepositoryService(WebClient.builder(), properties(baseUrl));
	}

	private static GitHubAppProperties properties(String apiBaseUrl) {
		return new GitHubAppProperties(
			"123456", "study-ing", "client", "secret", "https://example/callback", "/run/secrets/key.pem",
			new GitHubAppProperties.Features(true, false, true), "https://github.com", apiBaseUrl,
			Duration.ofSeconds(5), Duration.ofMinutes(10)
		);
	}

	private static void respondJson(HttpExchange exchange, int status, String body) throws IOException {
		byte[] bytes = body.getBytes(java.nio.charset.StandardCharsets.UTF_8);
		exchange.getResponseHeaders().set("Content-Type", "application/json");
		exchange.sendResponseHeaders(status, bytes.length);
		exchange.getResponseBody().write(bytes);
		exchange.close();
	}
}
