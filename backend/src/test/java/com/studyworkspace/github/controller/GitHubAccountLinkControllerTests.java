package com.studyworkspace.github.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doThrow;

import java.time.Duration;
import java.time.Instant;

import com.studyworkspace.auth.security.AuthSessionAttributes;
import com.studyworkspace.auth.security.StudyIngPrincipal;
import com.studyworkspace.auth.service.ProviderAccountLinkingService;
import com.studyworkspace.github.config.GitHubOAuthProperties;
import com.studyworkspace.github.service.GitHubAccountLinkProof;
import com.studyworkspace.github.service.GitHubOAuthService;
import com.studyworkspace.provider.ProviderCapabilities;
import com.studyworkspace.provider.ProviderIdentity;
import com.studyworkspace.provider.ProviderOAuthCredential;
import com.studyworkspace.workspace.domain.RepositoryProvider;
import com.studyworkspace.workspace.domain.WorkspaceException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpSession;

class GitHubAccountLinkControllerTests {
	private GitHubOAuthService githubOAuth;
	private ProviderCapabilities capabilities;
	private ProviderAccountLinkingService linkingService;
	private GitHubOAuthProperties properties;
	private GitHubAccountLinkController controller;

	@BeforeEach
	void setUp() {
		githubOAuth = mock(GitHubOAuthService.class);
		capabilities = mock(ProviderCapabilities.class);
		linkingService = mock(ProviderAccountLinkingService.class);
		properties = new GitHubOAuthProperties(
			"client", "secret", "http://localhost/callback", "read:user", "https://github.com",
			"https://api.github.com", Duration.ofSeconds(10), Duration.ofMinutes(10)
		);
		controller = new GitHubAccountLinkController(
			"http://localhost:3000", githubOAuth, properties, capabilities, linkingService
		);
	}

	@Test
	void unauthenticatedUserCannotStartLinking() {
		assertThatThrownBy(() -> controller.start(null, new MockHttpServletRequest()))
			.isInstanceOf(WorkspaceException.class)
			.extracting("code").isEqualTo("AUTH_REQUIRED");
		verifyNoInteractions(githubOAuth, linkingService);
	}

	@Test
	void startBindsStatePkceActionAndAuthenticatedUserToSession() {
		when(capabilities.supportsAccountLinkProvider(RepositoryProvider.GITHUB)).thenReturn(true);
		when(githubOAuth.createState()).thenReturn("random-state");
		when(githubOAuth.createCodeVerifier()).thenReturn("secret-verifier");
		when(githubOAuth.codeChallenge("secret-verifier")).thenReturn("challenge");
		when(githubOAuth.authorizationUrl("random-state", "challenge")).thenReturn("https://github.com/oauth");
		MockHttpServletRequest request = new MockHttpServletRequest();

		var response = controller.start(principal("user-a"), request);

		MockHttpSession session = (MockHttpSession) request.getSession(false);
		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FOUND);
		assertThat(response.getHeaders().getLocation()).hasToString("https://github.com/oauth");
		assertThat(session.getAttribute(AuthSessionAttributes.GITHUB_LINK_STATE)).isEqualTo("random-state");
		assertThat(session.getAttribute(AuthSessionAttributes.GITHUB_LINK_USER_ID)).isEqualTo("user-a");
		assertThat(session.getAttribute(AuthSessionAttributes.GITHUB_LINK_ACTION)).isEqualTo("LINK");
		assertThat(session.getAttribute(AuthSessionAttributes.GITHUB_LINK_CODE_VERIFIER)).isEqualTo("secret-verifier");
	}

	@Test
	void tamperedOrExpiredStateIsRejectedBeforeCodeExchange() {
		MockHttpServletRequest tampered = callbackRequest("expected", "user-a", Instant.now());
		var tamperedResponse = controller.callback("code", "changed", null, principal("user-a"), tampered);
		assertThat(tamperedResponse.getHeaders().getLocation()).hasToString(
			"http://localhost:3000/settings/accounts?providerLink=github_expired"
		);

		MockHttpServletRequest expired = callbackRequest("expected", "user-a", Instant.now().minus(Duration.ofMinutes(11)));
		var expiredResponse = controller.callback("code", "expected", null, principal("user-a"), expired);
		assertThat(expiredResponse.getHeaders().getLocation()).hasToString(
			"http://localhost:3000/settings/accounts?providerLink=github_expired"
		);
		verifyNoInteractions(githubOAuth, linkingService);
	}

	@Test
	void callbackCannotBeRedirectedToAnotherStudyIngUser() {
		MockHttpServletRequest request = callbackRequest("expected", "user-a", Instant.now());

		var response = controller.callback("code", "expected", null, principal("user-b"), request);

		assertThat(response.getHeaders().getLocation()).hasToString(
			"http://localhost:3000/settings/accounts?providerLink=github_expired"
		);
		verifyNoInteractions(githubOAuth, linkingService);
	}

	@Test
	void successfulCallbackLinksProofToCapturedAuthenticatedUser() {
		MockHttpServletRequest request = callbackRequest("expected", "user-a", Instant.now());
		GitHubAccountLinkProof proof = proof("42", "token");
		when(githubOAuth.exchangeAndLoadIdentity("code", "verifier")).thenReturn(proof);

		var response = controller.callback("code", "expected", null, principal("user-a"), request);

		assertThat(response.getHeaders().getLocation()).hasToString(
			"http://localhost:3000/settings/accounts?providerLink=github_success"
		);
		verify(linkingService).link("user-a", proof.identity(), proof.credential());
		assertThat(request.getSession(false).getAttribute(AuthSessionAttributes.GITHUB_LINK_STATE)).isNull();
	}

	@Test
	void cancellationPreservesStudyIngSessionAndDoesNotLink() {
		MockHttpServletRequest request = callbackRequest("expected", "user-a", Instant.now());
		StudyIngPrincipal principal = principal("user-a");
		request.getSession(false).setAttribute(AuthSessionAttributes.STUDY_ING_USER, principal);

		var response = controller.callback(null, "expected", "access_denied", principal, request);

		assertThat(response.getHeaders().getLocation()).hasToString(
			"http://localhost:3000/settings/accounts?providerLink=github_cancelled"
		);
		assertThat(request.getSession(false).getAttribute(AuthSessionAttributes.STUDY_ING_USER)).isSameAs(principal);
		verifyNoInteractions(githubOAuth, linkingService);
	}

	@Test
	void oauthFailurePreservesExistingStudyIngAndGitLabSession() {
		MockHttpServletRequest request = callbackRequest("expected", "user-a", Instant.now());
		StudyIngPrincipal principal = principal("user-a");
		request.getSession(false).setAttribute(AuthSessionAttributes.STUDY_ING_USER, principal);
		when(githubOAuth.exchangeAndLoadIdentity("code", "verifier"))
			.thenThrow(new WorkspaceException("GITHUB_OAUTH_FAILED", "controlled", 502));

		var response = controller.callback("code", "expected", null, principal, request);

		assertThat(response.getHeaders().getLocation()).hasToString(
			"http://localhost:3000/settings/accounts?providerLink=github_failed"
		);
		assertThat(request.getSession(false).getAttribute(AuthSessionAttributes.STUDY_ING_USER)).isSameAs(principal);
		verifyNoInteractions(linkingService);
	}

	@Test
	void accountCollisionReturnsControlledSettingsStateWithoutMerging() {
		MockHttpServletRequest request = callbackRequest("expected", "user-a", Instant.now());
		GitHubAccountLinkProof proof = proof("42", "token");
		when(githubOAuth.exchangeAndLoadIdentity("code", "verifier")).thenReturn(proof);
		doThrow(new WorkspaceException("PROVIDER_ACCOUNT_COLLISION", "controlled", 409))
			.when(linkingService).link("user-a", proof.identity(), proof.credential());

		var response = controller.callback("code", "expected", null, principal("user-a"), request);

		assertThat(response.getHeaders().getLocation()).hasToString(
			"http://localhost:3000/settings/accounts?providerLink=github_collision"
		);
	}

	@Test
	void differentGitHubIdentityOnSameUserHasDistinctMessageFromCrossUserCollision() {
		MockHttpServletRequest request = callbackRequest("expected", "user-a", Instant.now());
		GitHubAccountLinkProof proof = proof("42", "token");
		when(githubOAuth.exchangeAndLoadIdentity("code", "verifier")).thenReturn(proof);
		doThrow(new WorkspaceException("PROVIDER_ACCOUNT_ALREADY_LINKED", "controlled", 409))
			.when(linkingService).link("user-a", proof.identity(), proof.credential());

		var response = controller.callback("code", "expected", null, principal("user-a"), request);

		assertThat(response.getHeaders().getLocation()).hasToString(
			"http://localhost:3000/settings/accounts?providerLink=github_account_exists"
		);
	}

	private static MockHttpServletRequest callbackRequest(String state, String userId, Instant createdAt) {
		MockHttpServletRequest request = new MockHttpServletRequest();
		MockHttpSession session = (MockHttpSession) request.getSession(true);
		session.setAttribute(AuthSessionAttributes.GITHUB_LINK_STATE, state);
		session.setAttribute(AuthSessionAttributes.GITHUB_LINK_STATE_CREATED_AT, createdAt);
		session.setAttribute(AuthSessionAttributes.GITHUB_LINK_USER_ID, userId);
		session.setAttribute(AuthSessionAttributes.GITHUB_LINK_ACTION, "LINK");
		session.setAttribute(AuthSessionAttributes.GITHUB_LINK_CODE_VERIFIER, "verifier");
		return request;
	}

	private static StudyIngPrincipal principal(String userId) {
		return new StudyIngPrincipal(userId, "gitlab-account", RepositoryProvider.GITLAB, "17", "gitlab-user", "User", null, null);
	}

	private static GitHubAccountLinkProof proof(String externalId, String token) {
		return new GitHubAccountLinkProof(
			new ProviderIdentity(RepositoryProvider.GITHUB, externalId, "github-user", "GitHub User", null, null),
			new ProviderOAuthCredential(token, null, null, "read:user")
		);
	}
}
