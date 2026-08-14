package com.studyworkspace.github.service;

import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;

import com.studyworkspace.github.config.GitHubAppProperties;
import com.studyworkspace.github.dto.GitHubOAuthToken;
import com.studyworkspace.github.dto.GitHubUser;
import com.studyworkspace.provider.ProviderIdentity;
import com.studyworkspace.provider.ProviderOAuthCredential;
import com.studyworkspace.workspace.domain.RepositoryProvider;
import com.studyworkspace.workspace.domain.WorkspaceException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.client.reactive.JdkClientHttpConnector;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import org.springframework.web.util.UriComponentsBuilder;
import reactor.core.publisher.Mono;

/** GitHub App user-authorization adapter limited to code exchange and identity lookup. */
@Service
public class GitHubOAuthService {
	private static final String API_VERSION = "2026-03-10";
	private static final String USER_AGENT = "Study-ing";

	private final GitHubAppProperties properties;
	private final WebClient authorizationClient;
	private final WebClient apiClient;
	private final SecureRandom secureRandom = new SecureRandom();

	public GitHubOAuthService(WebClient.Builder webClientBuilder, GitHubAppProperties properties) {
		this.properties = properties;
		HttpClient httpClient = HttpClient.newBuilder()
			.connectTimeout(properties.requestTimeout())
			.followRedirects(HttpClient.Redirect.NEVER)
			.build();
		var connector = new JdkClientHttpConnector(httpClient);
		this.authorizationClient = webClientBuilder.clone().clientConnector(connector)
			.baseUrl(properties.authorizationBaseUrl()).build();
		this.apiClient = webClientBuilder.clone().clientConnector(connector)
			.baseUrl(properties.apiBaseUrl()).build();
	}

	public boolean isConfigured() { return properties.userAuthorizationConfigured(); }

	public String createState() { return randomUrlSafe(32); }

	public String createCodeVerifier() { return randomUrlSafe(64); }

	public String codeChallenge(String verifier) {
		try {
			byte[] digest = MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(StandardCharsets.US_ASCII));
			return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
		} catch (NoSuchAlgorithmException exception) {
			throw new IllegalStateException("SHA-256 is required for OAuth PKCE.", exception);
		}
	}

	public String authorizationUrl(String state, String codeChallenge) {
		requireConfiguration();
		UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(properties.authorizationBaseUrl())
			.path("/login/oauth/authorize")
			.queryParam("client_id", properties.clientId())
			.queryParam("redirect_uri", properties.redirectUri())
			.queryParam("state", state)
			.queryParam("code_challenge", codeChallenge)
			.queryParam("code_challenge_method", "S256")
			.queryParam("prompt", "select_account");
		return builder.build().encode().toUriString();
	}

	public GitHubAccountLinkProof exchangeAndLoadIdentity(String code, String codeVerifier) {
		requireConfiguration();
		GitHubOAuthToken token = execute(authorizationClient.post()
			.uri("/login/oauth/access_token")
			.header(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
			.header(HttpHeaders.USER_AGENT, USER_AGENT)
			.body(BodyInserters.fromFormData(tokenForm(code, codeVerifier)))
			.retrieve()
			.onStatus(HttpStatusCode::isError, response -> oauthError(response.statusCode().value()))
			.bodyToMono(GitHubOAuthToken.class));
		if (token.accessToken() == null || token.accessToken().isBlank()) {
			throw new WorkspaceException("GITHUB_OAUTH_EMPTY_TOKEN", "GitHub 계정 연결 응답을 확인할 수 없습니다.", 502);
		}

		GitHubUser user = execute(apiClient.get().uri("/user")
			.headers(headers -> {
				headers.setBearerAuth(token.accessToken());
				headers.set(HttpHeaders.ACCEPT, "application/vnd.github+json");
				headers.set(HttpHeaders.USER_AGENT, USER_AGENT);
				headers.set("X-GitHub-Api-Version", API_VERSION);
			})
			.retrieve()
			.onStatus(HttpStatusCode::isError, response -> oauthError(response.statusCode().value()))
			.bodyToMono(GitHubUser.class));

		Instant expiresAt = token.expiresIn() != null && token.expiresIn() > 0
			? Instant.now().plusSeconds(token.expiresIn())
			: null;
		return new GitHubAccountLinkProof(
			new ProviderIdentity(
				RepositoryProvider.GITHUB, Long.toString(user.id()), user.login(), user.name(), user.avatarUrl(), user.webUrl()
			),
			new ProviderOAuthCredential(token.accessToken(), token.refreshToken(), expiresAt, token.scope())
		);
	}

	public ProviderOAuthCredential refreshUserAccessToken(String refreshToken) {
		requireConfiguration();
		if (refreshToken == null || refreshToken.isBlank()) {
			throw new WorkspaceException("GITHUB_REAUTH_REQUIRED", "GitHub 계정을 다시 승인해 주세요.", 401);
		}
		LinkedMultiValueMap<String, String> form = new LinkedMultiValueMap<>();
		form.add("client_id", properties.clientId());
		form.add("client_secret", properties.clientSecret());
		form.add("grant_type", "refresh_token");
		form.add("refresh_token", refreshToken);
		GitHubOAuthToken token = execute(authorizationClient.post()
			.uri("/login/oauth/access_token")
			.header(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
			.header(HttpHeaders.USER_AGENT, USER_AGENT)
			.body(BodyInserters.fromFormData(form))
			.retrieve()
			.onStatus(HttpStatusCode::isError, response -> oauthError(response.statusCode().value()))
			.bodyToMono(GitHubOAuthToken.class));
		if (token.accessToken() == null || token.accessToken().isBlank()) {
			throw new WorkspaceException("GITHUB_REAUTH_REQUIRED", "GitHub 계정을 다시 승인해 주세요.", 401);
		}
		Instant expiresAt = token.expiresIn() != null && token.expiresIn() > 0
			? Instant.now().plusSeconds(token.expiresIn()) : null;
		return new ProviderOAuthCredential(
			token.accessToken(),
			token.refreshToken() == null || token.refreshToken().isBlank() ? refreshToken : token.refreshToken(),
			expiresAt,
			token.scope()
		);
	}

	private LinkedMultiValueMap<String, String> tokenForm(String code, String codeVerifier) {
		LinkedMultiValueMap<String, String> form = new LinkedMultiValueMap<>();
		form.add("client_id", properties.clientId());
		form.add("client_secret", properties.clientSecret());
		form.add("code", code);
		form.add("redirect_uri", properties.redirectUri());
		form.add("code_verifier", codeVerifier);
		return form;
	}

	private <T> T execute(Mono<T> request) {
		try {
			T response = request.block(properties.requestTimeout());
			if (response == null) throw new WorkspaceException("GITHUB_OAUTH_EMPTY_RESPONSE", "GitHub 응답이 비어 있습니다.", 502);
			return response;
		} catch (WorkspaceException exception) {
			throw exception;
		} catch (WebClientRequestException exception) {
			throw new WorkspaceException("GITHUB_CONNECTION_FAILED", "GitHub 서버에 연결하지 못했습니다.", 502, exception);
		} catch (RuntimeException exception) {
			throw new WorkspaceException(
				"GITHUB_OAUTH_REQUEST_FAILED", "GitHub 계정 연결 요청을 처리하지 못했습니다.", 502, exception
			);
		}
	}

	private Mono<? extends Throwable> oauthError(int upstreamStatus) {
		int responseStatus = upstreamStatus == 400 || upstreamStatus == 401 ? 401 : 502;
		return Mono.just(new WorkspaceException(
			"GITHUB_OAUTH_FAILED", "GitHub OAuth 승인 또는 토큰 교환에 실패했습니다.", responseStatus
		));
	}

	private void requireConfiguration() {
		if (!properties.userAuthorizationConfigured()) {
			throw new WorkspaceException("GITHUB_LINK_NOT_CONFIGURED", "GitHub 계정 연결이 아직 준비되지 않았습니다.", 503);
		}
	}

	private String randomUrlSafe(int byteLength) {
		byte[] bytes = new byte[byteLength];
		secureRandom.nextBytes(bytes);
		return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
	}
}
