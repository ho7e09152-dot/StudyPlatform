package com.studyworkspace.github.service;

import java.net.http.HttpClient;
import java.util.Map;

import com.studyworkspace.github.config.GitHubAppConfigurationValidator;
import com.studyworkspace.github.config.GitHubAppProperties;
import com.studyworkspace.github.dto.GitHubInstallationAccessToken;
import com.studyworkspace.workspace.domain.WorkspaceException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.client.reactive.JdkClientHttpConnector;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import reactor.core.publisher.Mono;

/**
 * Internal foundation for installation tokens. Callers must verify that a client-supplied installation ID
 * belongs to the authenticated GitHub user before invoking this service.
 */
@Service
public class GitHubInstallationTokenService {
	private static final String API_VERSION = "2026-03-10";
	private static final String USER_AGENT = "Study-ing";

	private final GitHubAppProperties properties;
	private final GitHubAppConfigurationValidator validator;
	private final GitHubAppJwtService jwtService;
	private final WebClient apiClient;

	public GitHubInstallationTokenService(
		WebClient.Builder webClientBuilder,
		GitHubAppProperties properties,
		GitHubAppConfigurationValidator validator,
		GitHubAppJwtService jwtService
	) {
		this.properties = properties;
		this.validator = validator;
		this.jwtService = jwtService;
		HttpClient httpClient = HttpClient.newBuilder()
			.connectTimeout(properties.requestTimeout())
			.followRedirects(HttpClient.Redirect.NEVER)
			.build();
		this.apiClient = webClientBuilder.clone()
			.clientConnector(new JdkClientHttpConnector(httpClient))
			.baseUrl(properties.apiBaseUrl())
			.build();
	}

	public GitHubInstallationAccessToken createForVerifiedInstallation(long installationId) {
		if (installationId <= 0) {
			throw new WorkspaceException("GITHUB_INSTALLATION_INVALID", "GitHub App installation을 확인할 수 없습니다.", 400);
		}
		validator.requireRepositoryAuthenticationReady();
		try {
			GitHubInstallationAccessToken response = apiClient.post()
				.uri("/app/installations/{installationId}/access_tokens", installationId)
				.headers(headers -> {
					headers.setBearerAuth(jwtService.createJwt());
					headers.set(HttpHeaders.ACCEPT, "application/vnd.github+json");
					headers.set(HttpHeaders.USER_AGENT, USER_AGENT);
					headers.set("X-GitHub-Api-Version", API_VERSION);
				})
				.contentType(MediaType.APPLICATION_JSON)
				.bodyValue(Map.of())
				.retrieve()
				.onStatus(HttpStatusCode::isError, status -> Mono.just(new WorkspaceException(
					"GITHUB_INSTALLATION_TOKEN_FAILED", "GitHub App installation 인증에 실패했습니다.", 502
				)))
				.bodyToMono(GitHubInstallationAccessToken.class)
				.block(properties.requestTimeout());
			if (response == null || response.token() == null || response.token().isBlank()) {
				throw new WorkspaceException(
					"GITHUB_INSTALLATION_TOKEN_EMPTY", "GitHub App installation 인증 응답을 확인할 수 없습니다.", 502
				);
			}
			return response;
		} catch (WorkspaceException exception) {
			throw exception;
		} catch (WebClientRequestException exception) {
			throw new WorkspaceException("GITHUB_CONNECTION_FAILED", "GitHub 서버에 연결하지 못했습니다.", 502, exception);
		} catch (RuntimeException exception) {
			throw new WorkspaceException(
				"GITHUB_INSTALLATION_TOKEN_REQUEST_FAILED", "GitHub App installation 인증을 처리하지 못했습니다.", 502, exception
			);
		}
	}
}
