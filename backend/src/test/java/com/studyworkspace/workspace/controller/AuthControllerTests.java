package com.studyworkspace.workspace.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;

import com.studyworkspace.auth.config.GitLabOAuthProperties;
import com.studyworkspace.auth.dto.GitLabOAuthSession;
import com.studyworkspace.auth.security.AuthSessionAttributes;
import com.studyworkspace.auth.service.GitLabOAuthService;
import com.studyworkspace.auth.service.GitLabOAuthTokenProvider;
import com.studyworkspace.auth.service.OAuthAccountService;
import com.studyworkspace.gitlab.dto.GitLabUser;
import com.studyworkspace.workspace.domain.WorkspaceException;
import com.studyworkspace.workspace.service.WorkspaceService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpSession;

class AuthControllerTests {

	private GitLabOAuthService oauthService;
	private OAuthAccountService accountService;
	private AuthController controller;

	@BeforeEach
	void setUp() {
		oauthService = mock(GitLabOAuthService.class);
		accountService = mock(OAuthAccountService.class);
		controller = new AuthController(
			"http://localhost:3000",
			oauthService,
			new GitLabOAuthProperties("client", "secret", "http://localhost:8080/api/v1/auth/gitlab/callback", "api", Duration.ofMinutes(10)),
			accountService,
			mock(GitLabOAuthTokenProvider.class),
			mock(WorkspaceService.class)
		);
	}

	@Test
	void callbackStagesCodeAndCompletesOAuthFromFrontendTransition() {
		MockHttpServletRequest request = oauthRequest("expected-state", "/schedule");
		MockHttpSession session = (MockHttpSession) request.getSession(false);
		GitLabUser user = new GitLabUser(17, "study-user", "Study User", null, "https://gitlab.example/study-user");
		GitLabOAuthSession oauth = new GitLabOAuthSession(user, "access", "refresh", Instant.now().plusSeconds(3600), "api");
		when(oauthService.exchangeAndLoadUser("authorization-code")).thenReturn(oauth);

		var callback = controller.callback("authorization-code", "expected-state", null, request);

		assertThat(callback.getStatusCode()).isEqualTo(HttpStatus.FOUND);
		assertThat(callback.getHeaders().getLocation()).hasToString("http://localhost:3000/auth/callback");
		assertThat(session.getAttribute(AuthSessionAttributes.OAUTH_PENDING_CODE)).isEqualTo("authorization-code");
		verifyNoInteractions(accountService);

		Map<String, String> completed = controller.complete(request);

		assertThat(completed).containsEntry("returnUrl", "/schedule");
		assertThat(session.getAttribute(AuthSessionAttributes.GITLAB_USER)).isEqualTo(user);
		assertThat(session.getAttribute(AuthSessionAttributes.OAUTH_PENDING_CODE)).isNull();
		verify(oauthService).exchangeAndLoadUser("authorization-code");
		verify(accountService).upsert(oauth);
	}

	@Test
	void invalidCallbackStateRedirectsToLoginWithoutExchangingCode() {
		MockHttpServletRequest request = oauthRequest("expected-state", "/today");

		var callback = controller.callback("authorization-code", "different-state", null, request);

		assertThat(callback.getStatusCode()).isEqualTo(HttpStatus.FOUND);
		assertThat(callback.getHeaders().getLocation()).hasToString("http://localhost:3000/login?oauthError=session_expired");
		verifyNoInteractions(oauthService, accountService);
	}

	@Test
	void completionCanOnlyConsumePendingCodeOnce() {
		MockHttpServletRequest request = oauthRequest("expected-state", "/today");
		GitLabUser user = new GitLabUser(17, "study-user", "Study User", null, "https://gitlab.example/study-user");
		GitLabOAuthSession oauth = new GitLabOAuthSession(user, "access", "refresh", Instant.now().plusSeconds(3600), "api");
		when(oauthService.exchangeAndLoadUser("authorization-code")).thenReturn(oauth);
		controller.callback("authorization-code", "expected-state", null, request);
		controller.complete(request);

		assertThatThrownBy(() -> controller.complete(request))
			.isInstanceOf(WorkspaceException.class)
			.extracting("code")
			.isEqualTo("GITLAB_OAUTH_STATE_INVALID");
	}

	private static MockHttpServletRequest oauthRequest(String state, String returnUrl) {
		MockHttpServletRequest request = new MockHttpServletRequest();
		MockHttpSession session = (MockHttpSession) request.getSession(true);
		session.setAttribute(AuthSessionAttributes.OAUTH_STATE, state);
		session.setAttribute(AuthSessionAttributes.OAUTH_STATE_CREATED_AT, Instant.now());
		session.setAttribute(AuthSessionAttributes.OAUTH_RETURN_URL, returnUrl);
		return request;
	}
}
