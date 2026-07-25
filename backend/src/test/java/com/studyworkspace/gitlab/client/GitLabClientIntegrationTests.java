package com.studyworkspace.gitlab.client;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicReference;

import com.studyworkspace.gitlab.config.GitLabProperties;
import com.studyworkspace.gitlab.dto.GitLabFileResponse;
import com.studyworkspace.gitlab.dto.GitLabProject;
import com.studyworkspace.gitlab.dto.GitLabTreeItem;
import com.studyworkspace.gitlab.dto.GitLabUser;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.client.WebClient;

class GitLabClientIntegrationTests {

	private HttpServer server;
	private GitLabClient client;
	private final AtomicReference<String> lastToken = new AtomicReference<>();

	@BeforeEach
	void setUp() throws IOException {
		server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
		server.createContext("/", this::handle);
		server.start();

		GitLabProperties properties = new GitLabProperties(
			"http://127.0.0.1:" + server.getAddress().getPort(),
			"test-read-token",
			"group/study",
			"",
			Duration.ofSeconds(2)
		);
		client = new GitLabClient(WebClient.builder(), properties);
	}

	@AfterEach
	void tearDown() {
		server.stop(0);
	}

	@Test
	void readsUserProjectTreeAndFileWithServerSideToken() {
		GitLabUser user = client.getCurrentUser();
		GitLabProject project = client.getConfiguredProject();
		GitLabTreeItem treeItem = client.getRepositoryTree("main").getFirst();
		GitLabFileResponse file = client.getRepositoryFile("260725/session.yml", "main");

		assertThat(user.username()).isEqualTo("study-member");
		assertThat(project.pathWithNamespace()).isEqualTo("group/study");
		assertThat(treeItem.path()).isEqualTo("260725/session.yml");
		assertThat(file.filePath()).isEqualTo("260725/session.yml");
		assertThat(lastToken).hasValue("test-read-token");
	}

	private void handle(HttpExchange exchange) throws IOException {
		lastToken.set(exchange.getRequestHeaders().getFirst("PRIVATE-TOKEN"));
		String path = exchange.getRequestURI().getRawPath();
		String response;

		if (path.equals("/api/v4/user")) {
			response = """
				{"id":7,"username":"study-member","name":"Study Member",
			 "avatar_url":"https://example.com/avatar.png","web_url":"https://gitlab.example.com/study-member"}
				""";
		} else if (path.equals("/api/v4/projects/group%2Fstudy")) {
			response = """
				{"id":42,"name":"study","path_with_namespace":"group/study",
				 "default_branch":"main","web_url":"https://gitlab.example.com/group/study","visibility":"private"}
				""";
		} else if (path.equals("/api/v4/projects/group%2Fstudy/repository/tree")) {
			response = """
				[{"id":"blob-id","name":"session.yml","type":"blob",
				  "path":"260725/session.yml","mode":"100644"}]
				""";
		} else if (path.equals("/api/v4/projects/group%2Fstudy/repository/files/260725%2Fsession.yml")) {
			response = """
				{"file_name":"session.yml","file_path":"260725/session.yml","size":14,
				 "encoding":"base64","content":"dGl0bGU6IHN0dWR5Cg==","ref":"main",
				 "blob_id":"blob-id","commit_id":"commit-id","last_commit_id":"last-commit-id"}
				""";
		} else {
			exchange.sendResponseHeaders(404, -1);
			exchange.close();
			return;
		}

		byte[] body = response.getBytes(StandardCharsets.UTF_8);
		exchange.getResponseHeaders().set("Content-Type", MediaType.APPLICATION_JSON_VALUE);
		exchange.sendResponseHeaders(200, body.length);
		exchange.getResponseBody().write(body);
		exchange.close();
	}
}
