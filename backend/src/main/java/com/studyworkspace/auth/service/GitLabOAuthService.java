package com.studyworkspace.auth.service;

import java.net.http.HttpClient;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;

import com.studyworkspace.auth.config.GitLabOAuthProperties;
import com.studyworkspace.auth.dto.GitLabOAuthSession;
import com.studyworkspace.auth.dto.GitLabOAuthToken;
import com.studyworkspace.common.exception.GitLabApiException;
import com.studyworkspace.common.exception.GitLabConfigurationException;
import com.studyworkspace.gitlab.config.GitLabProperties;
import com.studyworkspace.gitlab.dto.GitLabUser;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.client.reactive.JdkClientHttpConnector;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import org.springframework.web.util.UriComponentsBuilder;
import reactor.core.publisher.Mono;

@Service
public class GitLabOAuthService {

	private final WebClient webClient;
	private final GitLabProperties gitLabProperties;
	private final GitLabOAuthProperties oauthProperties;
	private final SecureRandom secureRandom = new SecureRandom();

	public GitLabOAuthService(
		WebClient.Builder webClientBuilder,
		GitLabProperties gitLabProperties,
		GitLabOAuthProperties oauthProperties
	) {
		HttpClient httpClient = HttpClient.newBuilder()
			.connectTimeout(gitLabProperties.requestTimeout())
			.followRedirects(HttpClient.Redirect.NEVER)
			.build();
		this.webClient = webClientBuilder
			.clientConnector(new JdkClientHttpConnector(httpClient))
			.baseUrl(gitLabProperties.baseUrl())
			.build();
		this.gitLabProperties = gitLabProperties;
		this.oauthProperties = oauthProperties;
	}

	public boolean isConfigured() {
		return oauthProperties.isConfigured();
	}

	public String createState() {
		byte[] bytes = new byte[32];
		secureRandom.nextBytes(bytes);
		return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
	}

	public String authorizationUrl(String state) {
		requireConfiguration();
		return UriComponentsBuilder.fromUriString(gitLabProperties.baseUrl())
			.path("/oauth/authorize")
			.queryParam("client_id", oauthProperties.clientId())
			.queryParam("redirect_uri", oauthProperties.redirectUri())
			.queryParam("response_type", "code")
			.queryParam("state", state)
			.queryParam("scope", oauthProperties.scope())
			.build()
			.encode()
			.toUriString();
	}

	public GitLabOAuthSession exchangeAndLoadUser(String code) {
		requireConfiguration();
		GitLabOAuthToken token = execute(
			webClient.post()
				.uri("/oauth/token")
				.body(BodyInserters.fromFormData(authorizationCodeForm(code)))
				.retrieve()
				.onStatus(HttpStatusCode::isError, response -> oauthError(response.statusCode().value()))
				.bodyToMono(GitLabOAuthToken.class)
		);
		GitLabUser user = loadUser(token.accessToken());
		long createdAt = token.createdAt() > 0 ? token.createdAt() : Instant.now().getEpochSecond();
		long expiresIn = token.expiresIn() > 0 ? token.expiresIn() : 7200;
		return new GitLabOAuthSession(
			user,
			token.accessToken(),
			token.refreshToken(),
			Instant.ofEpochSecond(createdAt).plusSeconds(expiresIn),
			token.scope()
		);
	}

	public GitLabOAuthSession refresh(GitLabOAuthSession current) {
		requireConfiguration();
		if (current == null || current.refreshToken() == null || current.refreshToken().isBlank()) {
			throw new GitLabApiException("GITLAB_REFRESH_TOKEN_MISSING", "GitLab 로그인이 만료되었습니다. 다시 로그인해 주세요.", 401);
		}
		MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
		form.add("client_id", oauthProperties.clientId());
		form.add("client_secret", oauthProperties.clientSecret());
		form.add("refresh_token", current.refreshToken());
		form.add("grant_type", "refresh_token");
		form.add("redirect_uri", oauthProperties.redirectUri());
		GitLabOAuthToken token = execute(webClient.post().uri("/oauth/token")
			.body(BodyInserters.fromFormData(form)).retrieve()
			.onStatus(HttpStatusCode::isError, response -> oauthError(response.statusCode().value()))
			.bodyToMono(GitLabOAuthToken.class));
		return new GitLabOAuthSession(
			current.user(), token.accessToken(), token.refreshToken(),
			Instant.now().plusSeconds(token.expiresIn() > 0 ? token.expiresIn() : 7200), token.scope()
		);
	}

	public void revoke(String accessToken) {
		if (!oauthProperties.isConfigured() || accessToken == null || accessToken.isBlank()) return;
		MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
		form.add("client_id", oauthProperties.clientId());
		form.add("client_secret", oauthProperties.clientSecret());
		form.add("token", accessToken);
		try {
			webClient.post().uri("/oauth/revoke").body(BodyInserters.fromFormData(form))
				.retrieve().toBodilessEntity().block(gitLabProperties.requestTimeout());
		} catch (RuntimeException ignored) {
			// Local logout must still succeed if GitLab is temporarily unavailable.
		}
	}

	private GitLabUser loadUser(String accessToken) {
		return execute(webClient.get().uri("/api/v4/user")
			.headers(headers -> headers.setBearerAuth(accessToken))
			.retrieve()
			.onStatus(HttpStatusCode::isError, response -> oauthError(response.statusCode().value()))
			.bodyToMono(GitLabUser.class));
	}

	private MultiValueMap<String, String> authorizationCodeForm(String code) {
		MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
		form.add("client_id", oauthProperties.clientId());
		form.add("client_secret", oauthProperties.clientSecret());
		form.add("code", code);
		form.add("grant_type", "authorization_code");
		form.add("redirect_uri", oauthProperties.redirectUri());
		return form;
	}

	private <T> T execute(Mono<T> request) {
		try {
			T response = request.block(gitLabProperties.requestTimeout());
			if (response == null) throw new GitLabApiException("GITLAB_OAUTH_EMPTY_RESPONSE", "GitLab OAuth 응답이 비어 있습니다.", 502);
			return response;
		} catch (GitLabApiException exception) {
			throw exception;
		} catch (WebClientRequestException exception) {
			throw new GitLabApiException("GITLAB_CONNECTION_FAILED", "GitLab 서버에 연결하지 못했습니다.", 502);
		} catch (RuntimeException exception) {
			throw new GitLabApiException("GITLAB_OAUTH_REQUEST_FAILED", "GitLab OAuth 요청을 처리하지 못했습니다.", 502);
		}
	}

	private Mono<? extends Throwable> oauthError(int upstreamStatus) {
		int responseStatus = upstreamStatus == 400 || upstreamStatus == 401 ? 401 : 502;
		return Mono.just(new GitLabApiException(
			"GITLAB_OAUTH_FAILED",
			"GitLab OAuth 승인 또는 토큰 교환에 실패했습니다.",
			responseStatus
		));
	}

	private void requireConfiguration() {
		if (!oauthProperties.isConfigured()) {
			throw new GitLabConfigurationException("GitLab OAuth Client ID, Secret, Redirect URI가 필요합니다.");
		}
	}
}
