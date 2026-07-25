package com.studyworkspace.gitlab.client;

import java.net.http.HttpClient;
import java.util.List;

import com.studyworkspace.common.exception.GitLabApiException;
import com.studyworkspace.common.exception.GitLabConfigurationException;
import com.studyworkspace.gitlab.config.GitLabProperties;
import com.studyworkspace.gitlab.dto.GitLabFileResponse;
import com.studyworkspace.gitlab.dto.GitLabProject;
import com.studyworkspace.gitlab.dto.GitLabTreeItem;
import com.studyworkspace.gitlab.dto.GitLabUser;
import com.studyworkspace.gitlab.port.GitLabRepositoryPort;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.client.reactive.JdkClientHttpConnector;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import reactor.core.publisher.Mono;

@Component
public class GitLabClient implements GitLabRepositoryPort {

	private static final String TOKEN_HEADER = "PRIVATE-TOKEN";

	private final WebClient webClient;
	private final GitLabProperties properties;

	public GitLabClient(WebClient.Builder webClientBuilder, GitLabProperties properties) {
		HttpClient httpClient = HttpClient.newBuilder()
			.connectTimeout(properties.requestTimeout())
			.followRedirects(HttpClient.Redirect.NEVER)
			.build();
		this.webClient = webClientBuilder
			.clientConnector(new JdkClientHttpConnector(httpClient))
			.baseUrl(properties.apiBaseUrl())
			.build();
		this.properties = properties;
	}

	@Override
	public GitLabUser getCurrentUser() {
		requireConfiguration();
		return execute(
			webClient.get()
				.uri("/user")
				.header(TOKEN_HEADER, properties.accessToken())
				.retrieve()
				.onStatus(HttpStatusCode::isError, this::toException)
				.bodyToMono(GitLabUser.class)
		);
	}

	@Override
	public GitLabProject getConfiguredProject() {
		requireConfiguration();
		return execute(
			webClient.get()
				.uri(builder -> builder
					.pathSegment("projects", properties.projectId())
					.build())
				.header(TOKEN_HEADER, properties.accessToken())
				.retrieve()
				.onStatus(HttpStatusCode::isError, this::toException)
				.bodyToMono(GitLabProject.class)
		);
	}

	@Override
	public List<GitLabTreeItem> getRepositoryTree(String ref) {
		requireConfiguration();
		return execute(
			webClient.get()
				.uri(builder -> builder
					.pathSegment("projects", properties.projectId(), "repository", "tree")
					.queryParam("ref", ref)
					.queryParam("recursive", true)
					.queryParam("per_page", 100)
					.build())
				.header(TOKEN_HEADER, properties.accessToken())
				.retrieve()
				.onStatus(HttpStatusCode::isError, this::toException)
				.bodyToMono(new ParameterizedTypeReference<>() {
				})
		);
	}

	@Override
	public GitLabFileResponse getRepositoryFile(String path, String ref) {
		requireConfiguration();
		return execute(
			webClient.get()
				.uri(builder -> builder
					.pathSegment("projects", properties.projectId(), "repository", "files", path)
					.queryParam("ref", ref)
					.build())
				.header(TOKEN_HEADER, properties.accessToken())
				.retrieve()
				.onStatus(HttpStatusCode::isError, this::toException)
				.bodyToMono(GitLabFileResponse.class)
		);
	}

	private <T> T execute(Mono<T> request) {
		try {
			T response = request.block(properties.requestTimeout());
			if (response == null) {
				throw new GitLabApiException(
					"GITLAB_EMPTY_RESPONSE",
					"GitLab이 비어 있는 응답을 반환했습니다.",
					502
				);
			}
			return response;
		} catch (GitLabApiException exception) {
			throw exception;
		} catch (WebClientRequestException exception) {
			throw new GitLabApiException(
				"GITLAB_CONNECTION_FAILED",
				"GitLab 서버에 연결하지 못했습니다. 주소와 네트워크를 확인해 주세요.",
				502
			);
		} catch (RuntimeException exception) {
			throw new GitLabApiException(
				"GITLAB_REQUEST_FAILED",
				"GitLab 요청 처리 중 오류가 발생했습니다.",
				502
			);
		}
	}

	private Mono<? extends Throwable> toException(
		org.springframework.web.reactive.function.client.ClientResponse response
	) {
		int status = response.statusCode().value();
		GitLabApiException exception = switch (status) {
			case 401 -> new GitLabApiException(
				"GITLAB_AUTHENTICATION_FAILED",
				"GitLab 토큰이 유효하지 않거나 만료되었습니다.",
				status
			);
			case 403 -> new GitLabApiException(
				"GITLAB_PROJECT_ACCESS_DENIED",
				"연결된 GitLab 프로젝트를 읽을 권한이 없습니다.",
				status
			);
			case 404 -> new GitLabApiException(
				"GITLAB_RESOURCE_NOT_FOUND",
				"GitLab 프로젝트, 브랜치 또는 파일을 찾지 못했습니다.",
				status
			);
			case 429 -> new GitLabApiException(
				"GITLAB_RATE_LIMITED",
				"GitLab 요청 제한에 도달했습니다. 잠시 후 다시 시도해 주세요.",
				status
			);
			default -> new GitLabApiException(
				"GITLAB_UPSTREAM_ERROR",
				"GitLab이 요청을 정상적으로 처리하지 못했습니다.",
				status
			);
		};

		return response.releaseBody().thenReturn(exception);
	}

	private void requireConfiguration() {
		if (!properties.isConfigured()) {
			throw new GitLabConfigurationException(
				"GITLAB_ACCESS_TOKEN과 GITLAB_PROJECT_ID가 필요합니다."
			);
		}
	}
}
