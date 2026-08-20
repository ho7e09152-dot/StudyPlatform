package com.studyworkspace.workspace.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;

import com.studyworkspace.auth.config.GitLabOAuthProperties;
import com.studyworkspace.auth.dto.GitLabOAuthSession;
import com.studyworkspace.auth.security.AuthSessionAttributes;
import com.studyworkspace.auth.security.StudyIngPrincipal;
import com.studyworkspace.workspace.domain.RepositoryProvider;
import com.studyworkspace.auth.service.GitLabOAuthService;
import com.studyworkspace.auth.service.GitLabOAuthTokenProvider;
import com.studyworkspace.auth.service.OAuthAccountService;
import com.studyworkspace.auth.service.AccountDeletionService;
import com.studyworkspace.auth.service.AccountSessionService;
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
	private AccountDeletionService accountDeletionService;
	private AccountSessionService accountSessionService;
	private WorkspaceService workspaceService;
	private AuthController controller;

	@BeforeEach
	void setUp() {
		oauthService = mock(GitLabOAuthService.class);
		accountService = mock(OAuthAccountService.class);
		accountDeletionService = mock(AccountDeletionService.class);
		accountSessionService = mock(AccountSessionService.class);
		workspaceService = mock(WorkspaceService.class);
		controller = new AuthController(
			"http://localhost:3000",
			oauthService,
			new GitLabOAuthProperties("client", "secret", "http://localhost:8080/api/v1/auth/gitlab/callback", "api", Duration.ofMinutes(10)),
			accountService,
			mock(GitLabOAuthTokenProvider.class),
			workspaceService,
			accountDeletionService,
			accountSessionService
		);
	}

	@Test
	void callbackStagesCodeAndCompletesOAuthFromFrontendTransition() {
		MockHttpServletRequest request = oauthRequest("expected-state", "/schedule");
		MockHttpSession session = (MockHttpSession) request.getSession(false);
		GitLabUser user = new GitLabUser(17, "study-user", "Study User", null, "https://gitlab.example/study-user");
		GitLabOAuthSession oauth = new GitLabOAuthSession(user, "access", "refresh", Instant.now().plusSeconds(3600), "api");
		when(oauthService.exchangeAndLoadUser("authorization-code")).thenReturn(oauth);
		StudyIngPrincipal principal = principal(user);
		when(accountService.resolveGitLabLogin(oauth)).thenReturn(OAuthAccountService.LoginResult.authenticated(principal));

		var callback = controller.callback("authorization-code", "expected-state", null, request);

		assertThat(callback.getStatusCode()).isEqualTo(HttpStatus.FOUND);
		assertThat(callback.getHeaders().getLocation()).hasToString("http://localhost:3000/auth/callback");
		assertThat(session.getAttribute(AuthSessionAttributes.OAUTH_PENDING_CODE)).isEqualTo("authorization-code");
		verifyNoInteractions(accountService);

		Map<String, String> completed = controller.complete(request);

		assertThat(completed).containsEntry("returnUrl", "/schedule");
		assertThat(session.getAttribute(AuthSessionAttributes.STUDY_ING_USER)).isEqualTo(principal);
		assertThat(session.getAttribute(AuthSessionAttributes.GITLAB_USER)).isNull();
		assertThat(session.getAttribute(AuthSessionAttributes.OAUTH_PENDING_CODE)).isNull();
		verify(oauthService).exchangeAndLoadUser("authorization-code");
		verify(accountService).resolveGitLabLogin(oauth);
		verify(accountSessionService).register(session, "study-user-id");
	}

	@Test
	void firstLoginKeepsOnlyEncryptedPendingRegistrationUntilProfileConsent() {
		MockHttpServletRequest request = oauthRequest("expected-state", "/today");
		MockHttpSession session = (MockHttpSession) request.getSession(false);
		GitLabUser user = new GitLabUser(18, "new-user", "New User", null, null);
		GitLabOAuthSession oauth = new GitLabOAuthSession(user, "access", "refresh", Instant.now().plusSeconds(3600), "api");
		OAuthAccountService.PendingRegistration pending = pending(RepositoryProvider.GITLAB, "18", "new-user");
		when(oauthService.exchangeAndLoadUser("authorization-code")).thenReturn(oauth);
		when(accountService.resolveGitLabLogin(oauth)).thenReturn(OAuthAccountService.LoginResult.pending(pending));
		controller.callback("authorization-code", "expected-state", null, request);

		controller.complete(request);

		assertThat(session.getAttribute(AuthSessionAttributes.STUDY_ING_USER)).isNull();
		assertThat(session.getAttribute(AuthSessionAttributes.PENDING_REGISTRATION)).isEqualTo(pending);
		assertThat(controller.me(null, request).getBody()).containsEntry("authenticated", true).containsEntry("accountCreated", false);
		verify(accountSessionService).clear(session);
		verify(accountSessionService, never()).register(session, "study-user-id");
	}

	@Test
	void profileConsentAtomicallyPromotesPendingRegistrationToAuthenticatedAccount() {
		MockHttpServletRequest request = new MockHttpServletRequest();
		MockHttpSession session = (MockHttpSession) request.getSession(true);
		OAuthAccountService.PendingRegistration pending = pending(RepositoryProvider.GITLAB, "18", "new-user");
		session.setAttribute(AuthSessionAttributes.PENDING_REGISTRATION, pending);
		var input = new OAuthAccountService.UpdateProfileRequest("완료 사용자", "completed-user", "Asia/Seoul", true, true, true);
		StudyIngPrincipal principal = new StudyIngPrincipal(
			"created-user-id", "created-provider-id", RepositoryProvider.GITLAB, "18", "new-user", "완료 사용자", null, null
		);
		Instant agreedAt = Instant.now();
		var profile = new OAuthAccountService.AccountProfile(
			18, "new-user", "완료 사용자", null, null, true, "completed-user.md", "Asia/Seoul",
			"2026-08-13", agreedAt, "2026-08-13", agreedAt, agreedAt, false, "LIGHT", "PURPLE", "created-user-id"
		);
		when(accountService.completeRegistration(pending, input))
			.thenReturn(new OAuthAccountService.CompletedRegistration(principal, profile));

		Map<String, Object> response = controller.updateProfile(input, request);

		assertThat(response).containsEntry("id", "created-user-id").containsEntry("profileCompleted", true);
		assertThat(session.getAttribute(AuthSessionAttributes.PENDING_REGISTRATION)).isNull();
		assertThat(session.getAttribute(AuthSessionAttributes.STUDY_ING_USER)).isEqualTo(principal);
		verify(accountSessionService).register(session, "created-user-id");
		verify(workspaceService).updateUserProfile(18, "완료 사용자", "completed-user.md");
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
		when(accountService.resolveGitLabLogin(oauth)).thenReturn(OAuthAccountService.LoginResult.authenticated(principal(user)));
		controller.callback("authorization-code", "expected-state", null, request);
		controller.complete(request);

		assertThatThrownBy(() -> controller.complete(request))
			.isInstanceOf(WorkspaceException.class)
			.extracting("code")
			.isEqualTo("GITLAB_OAUTH_STATE_INVALID");
	}

	@Test
	void accountDeletionRemovesLocalAccountBeforeRevokingProviderAndInvalidatesSession() {
		MockHttpServletRequest request = new MockHttpServletRequest();
		MockHttpSession session = (MockHttpSession) request.getSession(true);
		GitLabUser user = new GitLabUser(17, "study-user", "Study User", null, null);
		session.setAttribute(AuthSessionAttributes.STUDY_ING_USER, principal(user));
		when(accountService.findGitLabOAuthSessionByUserId("study-user-id")).thenReturn(java.util.Optional.of(new GitLabOAuthSession(
			user, "access-token", "refresh-token", Instant.now().plusSeconds(3600), "api"
		)));

		var response = controller.deleteAccount(request);

		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
		verify(accountDeletionService).delete("study-user-id", 17);
		verify(oauthService).revoke("access-token");
		verify(accountSessionService).deleteAll("study-user-id");
		assertThat(session.isInvalid()).isTrue();
	}

	private static StudyIngPrincipal principal(GitLabUser user) {
		return new StudyIngPrincipal("study-user-id", "provider-account-id", RepositoryProvider.GITLAB,
			Long.toString(user.id()), user.username(), user.name(), user.avatarUrl(), user.webUrl());
	}

	private static OAuthAccountService.PendingRegistration pending(RepositoryProvider provider, String externalId, String username) {
		return new OAuthAccountService.PendingRegistration(
			provider, externalId, username, "Pending User", null, null,
			"encrypted-access", "encrypted-refresh", Instant.now().plusSeconds(3600), "api", Instant.now()
		);
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
