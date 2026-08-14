package com.studyworkspace.github.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.time.Instant;

import com.studyworkspace.auth.security.AuthSessionAttributes;
import com.studyworkspace.auth.security.StudyIngPrincipal;
import com.studyworkspace.auth.service.AccountSessionService;
import com.studyworkspace.auth.service.OAuthAccountService;
import com.studyworkspace.github.config.GitHubAppProperties;
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

class GitHubLoginControllerTests {
	private GitHubOAuthService githubOAuth;
	private ProviderCapabilities capabilities;
	private OAuthAccountService accounts;
	private AccountSessionService sessions;
	private GitHubLoginController controller;

	@BeforeEach
	void setUp() {
		githubOAuth = mock(GitHubOAuthService.class);
		capabilities = mock(ProviderCapabilities.class);
		accounts = mock(OAuthAccountService.class);
		sessions = mock(AccountSessionService.class);
		GitHubAppProperties properties = new GitHubAppProperties(
			"", "study-ing", "client", "secret", "http://localhost/callback", "",
			new GitHubAppProperties.Features(true, true, false), "https://github.com", "https://api.github.com",
			Duration.ofSeconds(10), Duration.ofMinutes(10)
		);
		controller = new GitHubLoginController(githubOAuth, properties, capabilities, accounts, sessions);
	}

	@Test
	void disabledCapabilityCannotStartLogin() {
		assertThatThrownBy(() -> controller.login("/today", new MockHttpServletRequest()))
			.isInstanceOf(WorkspaceException.class).extracting("code").isEqualTo("GITHUB_LOGIN_NOT_AVAILABLE");
		verifyNoInteractions(githubOAuth, accounts);
	}

	@Test
	void startStoresLoginActionPkceAndSafeReturnUrl() {
		when(capabilities.supportsAuthProvider(RepositoryProvider.GITHUB)).thenReturn(true);
		when(githubOAuth.createState()).thenReturn("state");
		when(githubOAuth.createCodeVerifier()).thenReturn("verifier");
		when(githubOAuth.codeChallenge("verifier")).thenReturn("challenge");
		when(githubOAuth.authorizationUrl("state", "challenge")).thenReturn("https://github.com/login/oauth/authorize");
		MockHttpServletRequest request = new MockHttpServletRequest();

		var response = controller.login("//evil.example", request);
		MockHttpSession session = (MockHttpSession) request.getSession(false);

		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FOUND);
		assertThat(session.getAttribute(AuthSessionAttributes.GITHUB_LINK_ACTION)).isEqualTo("LOGIN");
		assertThat(session.getAttribute(AuthSessionAttributes.GITHUB_LOGIN_RETURN_URL)).isEqualTo("/today");
	}

	@Test
	void completeAuthenticatesProviderProofRotatesSessionAndConsumesCodeOnce() {
		MockHttpServletRequest request = pendingRequest();
		GitHubAccountLinkProof proof = new GitHubAccountLinkProof(
			new ProviderIdentity(RepositoryProvider.GITHUB, "42", "octo", "Octo", null, null),
			new ProviderOAuthCredential("token", "refresh", Instant.now().plusSeconds(3600), "")
		);
		StudyIngPrincipal principal = new StudyIngPrincipal(
			"user-id", "provider-id", RepositoryProvider.GITHUB, "42", "octo", "Octo", null, null
		);
		when(githubOAuth.exchangeAndLoadIdentity("code", "verifier")).thenReturn(proof);
		when(accounts.authenticate(proof.identity(), proof.credential())).thenReturn(principal);

		assertThat(controller.complete(request)).containsEntry("returnUrl", "/library");
		MockHttpSession session = (MockHttpSession) request.getSession(false);
		assertThat(session.getAttribute(AuthSessionAttributes.STUDY_ING_USER)).isEqualTo(principal);
		assertThat(session.getAttribute(AuthSessionAttributes.GITHUB_LOGIN_PENDING_CODE)).isNull();
		verify(accounts).authenticate(proof.identity(), proof.credential());
		verify(sessions).register(session, "user-id");
		assertThatThrownBy(() -> controller.complete(request))
			.isInstanceOf(WorkspaceException.class).extracting("code").isEqualTo("GITHUB_OAUTH_STATE_INVALID");
	}

	private static MockHttpServletRequest pendingRequest() {
		MockHttpServletRequest request = new MockHttpServletRequest();
		MockHttpSession session = (MockHttpSession) request.getSession(true);
		session.setAttribute(AuthSessionAttributes.GITHUB_LOGIN_PENDING_CODE, "code");
		session.setAttribute(AuthSessionAttributes.GITHUB_LOGIN_PENDING_VERIFIER, "verifier");
		session.setAttribute(AuthSessionAttributes.GITHUB_LOGIN_PENDING_RETURN_URL, "/library");
		session.setAttribute(AuthSessionAttributes.GITHUB_LOGIN_PENDING_CREATED_AT, Instant.now());
		return request;
	}
}
