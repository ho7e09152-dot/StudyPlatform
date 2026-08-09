package com.studyworkspace.gitlab.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicReference;

import com.studyworkspace.gitlab.config.GitLabProperties;
import com.studyworkspace.gitlab.dto.GitLabProject;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.client.WebClient;

class GitLabOAuthProjectServiceTests {

	private HttpServer server;
	private GitLabOAuthProjectService service;
	private final AtomicReference<String> authorization = new AtomicReference<>();
	private final AtomicReference<String> query = new AtomicReference<>();
	private final List<String> requests = new CopyOnWriteArrayList<>();
	private final List<String> requestBodies = new CopyOnWriteArrayList<>();
	private boolean treeNotFound;

	@BeforeEach
	void setUp() throws IOException {
		server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
		server.createContext("/api/v4/projects", this::handle);
		server.start();
		String baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
		service = new GitLabOAuthProjectService(
			WebClient.builder(),
			new GitLabProperties(baseUrl, "", "", "", Duration.ofSeconds(2))
		);
	}

	@AfterEach
	void tearDown() {
		server.stop(0);
	}

	@Test
	void listsProjectsWithTheCurrentUsersBearerToken() {
		var projects = service.listProjects("oauth-user-token", "study team", 2, 25);

		assertThat(projects).extracting(GitLabProject::id).containsExactly(48213L);
		assertThat(projects.getFirst().pathWithNamespace()).isEqualTo("study-team/evening-workspace");
		assertThat(authorization).hasValue("Bearer oauth-user-token");
		assertThat(query.get()).contains("membership=true", "search=study%20team", "page=2", "per_page=25");
	}

	@Test
	void readsRepositoryTreeAndDecodesFilesWithBearerToken() {
		var tree = service.getRepositoryTree("oauth-user-token", 48213, "main");
		var file = service.getRepositoryFile("oauth-user-token", 48213, "260809/session.yml", "main");

		assertThat(tree).extracting("path").containsExactly("260809/session.yml");
		assertThat(file.content()).isEqualTo("title: OAuth repository\n");
		assertThat(authorization).hasValue("Bearer oauth-user-token");
	}

	@Test
	void treatsAProjectWithoutADefaultBranchAsAnEmptyRepository() {
		var tree = service.getRepositoryTree("oauth-user-token", 48213, null);

		assertThat(tree).isEmpty();
		assertThat(authorization).hasValue(null);
	}

	@Test
	void treatsTreeNotFoundAsAnEmptyRepository() {
		treeNotFound = true;

		var tree = service.getRepositoryTree("oauth-user-token", 48213, "main");

		assertThat(tree).isEmpty();
		assertThat(authorization).hasValue("Bearer oauth-user-token");
	}

	@Test
	void createsAndUpdatesRepositoryFilesWithBearerToken() {
		var created = service.createRepositoryFile(
			"oauth-user-token", 48213, "260809/session.yml", "main", "version: 1\n", "study: create session", "김서연"
		);
		var updated = service.updateRepositoryFile(
			"oauth-user-token", 48213, "260809/session.yml", "main", "version: 2\n", "study: update session", "commit-1", "김서연"
		);

		assertThat(created.lastCommitId()).isEqualTo("commit-1");
		assertThat(updated.lastCommitId()).isEqualTo("commit-1");
		assertThat(requests).containsSubsequence("POST /api/v4/projects/48213/repository/files/260809/session.yml", "GET /api/v4/projects/48213/repository/files/260809/session.yml");
		assertThat(requests).containsSubsequence("PUT /api/v4/projects/48213/repository/files/260809/session.yml", "GET /api/v4/projects/48213/repository/files/260809/session.yml");
		assertThat(requestBodies).anySatisfy(body -> assertThat(body).contains("study: create session", "version: 1", "author_name", "김서연"));
		assertThat(requestBodies).anySatisfy(body -> assertThat(body).contains("study: update session", "last_commit_id", "commit-1", "author_name", "김서연"));
		assertThat(authorization).hasValue("Bearer oauth-user-token");
	}

	private void handle(HttpExchange exchange) throws IOException {
		authorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
		query.set(exchange.getRequestURI().getRawQuery());
		String path = exchange.getRequestURI().getPath();
		requests.add(exchange.getRequestMethod() + " " + path);
		if (!"GET".equals(exchange.getRequestMethod())) {
			requestBodies.add(new String(exchange.getRequestBody().readAllBytes(), java.nio.charset.StandardCharsets.UTF_8));
		}
		if (path.endsWith("/repository/tree")) {
			if (treeNotFound) {
				exchange.sendResponseHeaders(404, -1);
				exchange.close();
				return;
			}
			send(exchange, """
				[{"id":"tree-1","name":"session.yml","type":"blob","path":"260809/session.yml","mode":"100644"}]
				""");
			return;
		}
		if (path.contains("/repository/files/")) {
			if (!"GET".equals(exchange.getRequestMethod())) {
				send(exchange, 201, "{\"file_path\":\"260809/session.yml\",\"branch\":\"main\"}");
				return;
			}
			send(exchange, """
				{"file_name":"session.yml","file_path":"260809/session.yml","size":24,"encoding":"base64",
				 "content":"dGl0bGU6IE9BdXRoIHJlcG9zaXRvcnkK","ref":"main","blob_id":"blob-1",
				 "commit_id":"commit-1","last_commit_id":"commit-1"}
				""");
			return;
		}
		send(exchange, """
			[{"id":48213,"name":"Evening Workspace","path_with_namespace":"study-team/evening-workspace",
			  "default_branch":"main","web_url":"https://gitlab.example/study-team/evening-workspace","visibility":"private"}]
			""");
	}

	private static void send(HttpExchange exchange, String response) throws IOException {
		send(exchange, 200, response);
	}

	private static void send(HttpExchange exchange, int status, String response) throws IOException {
		byte[] body = response.getBytes(java.nio.charset.StandardCharsets.UTF_8);
		exchange.getResponseHeaders().set("Content-Type", MediaType.APPLICATION_JSON_VALUE);
		exchange.sendResponseHeaders(status, body.length);
		exchange.getResponseBody().write(body);
		exchange.close();
	}
}
