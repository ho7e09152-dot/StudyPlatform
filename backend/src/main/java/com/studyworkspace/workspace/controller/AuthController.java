package com.studyworkspace.workspace.controller;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Map;
import java.util.LinkedHashMap;

import com.studyworkspace.auth.config.GitLabOAuthProperties;
import com.studyworkspace.auth.dto.GitLabOAuthSession;
import com.studyworkspace.auth.security.AuthSessionAttributes;
import com.studyworkspace.auth.service.GitLabOAuthService;
import com.studyworkspace.auth.service.OAuthAccountService;
import com.studyworkspace.auth.service.GitLabOAuthTokenProvider;
import com.studyworkspace.gitlab.dto.GitLabUser;
import com.studyworkspace.workspace.domain.WorkspaceException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.studyworkspace.workspace.service.WorkspaceService;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

	private final String frontendUrl;
	private final GitLabOAuthService oauthService;
	private final GitLabOAuthProperties oauthProperties;
	private final OAuthAccountService accountService;
	private final GitLabOAuthTokenProvider tokenProvider;
	private final WorkspaceService workspaceService;

	public AuthController(
		@Value("${app.frontend-url:http://localhost:3000}") String frontendUrl,
		GitLabOAuthService oauthService,
		GitLabOAuthProperties oauthProperties,
		OAuthAccountService accountService,
		GitLabOAuthTokenProvider tokenProvider,
		WorkspaceService workspaceService
	) {
		this.frontendUrl = frontendUrl.replaceAll("/+$", "");
		this.oauthService = oauthService;
		this.oauthProperties = oauthProperties;
		this.accountService = accountService;
		this.tokenProvider = tokenProvider;
		this.workspaceService = workspaceService;
	}

	@GetMapping("/me")
	public ResponseEntity<Map<String, Object>> me(HttpServletRequest request) {
		GitLabUser user = getGitLabUser(request);
		if (user == null) {
			return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("authenticated", false));
		}
		GitLabOAuthSession oauth = tokenProvider.requireValidSession(request);
		return ResponseEntity.ok(Map.of(
			"authenticated", true,
			"mode", "gitlab-oauth",
			"user", profileResponse(accountService.requireProfile(oauth.user().id()))
		));
	}

	@PutMapping("/profile")
	public Map<String, Object> updateProfile(
		@RequestBody OAuthAccountService.UpdateProfileRequest profileRequest,
		HttpServletRequest request
	) {
		GitLabUser current = getGitLabUser(request);
		if (current == null) throw new WorkspaceException("AUTH_REQUIRED", "GitLab 로그인이 필요합니다.", 401);
		OAuthAccountService.AccountProfile profile = accountService.updateProfile(current.id(), profileRequest);
		GitLabUser updatedUser = new GitLabUser(
			profile.id(), profile.username(), profile.name(), profile.avatarUrl(), profile.webUrl()
		);
		HttpSession session = request.getSession(false);
		if (session != null) session.setAttribute(AuthSessionAttributes.GITLAB_USER, updatedUser);
		workspaceService.updateUserProfile(profile.id(), profile.name(), profile.repositoryFileName());
		return profileResponse(profile);
	}

	@PatchMapping("/preferences")
	public Map<String, Object> updatePreferences(
		@RequestBody OAuthAccountService.UpdatePreferencesRequest preferencesRequest,
		HttpServletRequest request
	) {
		GitLabUser current = getGitLabUser(request);
		if (current == null) throw new WorkspaceException("AUTH_REQUIRED", "GitLab 로그인이 필요합니다.", 401);
		return profileResponse(accountService.updatePreferences(current.id(), preferencesRequest));
	}

	@GetMapping("/gitlab/login")
	public ResponseEntity<Void> login(
		@RequestParam(defaultValue = "/today") String returnUrl,
		HttpServletRequest request
	) {
		String state = oauthService.createState();
		HttpSession session = request.getSession(true);
		clearPendingOAuth(session);
		session.setAttribute(AuthSessionAttributes.OAUTH_STATE, state);
		session.setAttribute(AuthSessionAttributes.OAUTH_STATE_CREATED_AT, Instant.now());
		session.setAttribute(AuthSessionAttributes.OAUTH_RETURN_URL, safeReturnUrl(returnUrl));
		return redirect(oauthService.authorizationUrl(state));
	}

	@GetMapping("/gitlab/callback")
	public ResponseEntity<Void> callback(
		@RequestParam(required = false) String code,
		@RequestParam(required = false) String state,
		@RequestParam(required = false) String error,
		HttpServletRequest request
	) {
		if (error != null) return redirect(frontendUrl + "/login?oauthError=access_denied");
		HttpSession session = request.getSession(false);
		if (session == null) return redirect(frontendUrl + "/login?oauthError=session_expired");
		String expectedState = (String) session.getAttribute(AuthSessionAttributes.OAUTH_STATE);
		Instant stateCreatedAt = (Instant) session.getAttribute(AuthSessionAttributes.OAUTH_STATE_CREATED_AT);
		String returnUrl = safeReturnUrl((String) session.getAttribute(AuthSessionAttributes.OAUTH_RETURN_URL));
		session.removeAttribute(AuthSessionAttributes.OAUTH_STATE);
		session.removeAttribute(AuthSessionAttributes.OAUTH_STATE_CREATED_AT);
		session.removeAttribute(AuthSessionAttributes.OAUTH_RETURN_URL);

		if (!stateMatches(expectedState, state)
			|| stateCreatedAt == null
			|| stateCreatedAt.plus(oauthProperties.stateTtl()).isBefore(Instant.now())) {
			return redirect(frontendUrl + "/login?oauthError=session_expired");
		}
		if (code == null || code.isBlank()) {
			return redirect(frontendUrl + "/login?oauthError=oauth_failed");
		}

		session.setAttribute(AuthSessionAttributes.OAUTH_PENDING_CODE, code);
		session.setAttribute(AuthSessionAttributes.OAUTH_PENDING_RETURN_URL, returnUrl);
		session.setAttribute(AuthSessionAttributes.OAUTH_PENDING_CREATED_AT, Instant.now());
		return redirect(frontendUrl + "/auth/callback");
	}

	@PostMapping("/gitlab/complete")
	public Map<String, String> complete(HttpServletRequest request) {
		HttpSession session = request.getSession(false);
		if (session == null) throw oauthStateError();
		String code = (String) session.getAttribute(AuthSessionAttributes.OAUTH_PENDING_CODE);
		String returnUrl = safeReturnUrl((String) session.getAttribute(AuthSessionAttributes.OAUTH_PENDING_RETURN_URL));
		Instant pendingCreatedAt = (Instant) session.getAttribute(AuthSessionAttributes.OAUTH_PENDING_CREATED_AT);
		clearPendingOAuth(session);
		if (code == null || code.isBlank()
			|| pendingCreatedAt == null
			|| pendingCreatedAt.plus(oauthProperties.stateTtl()).isBefore(Instant.now())) {
			throw oauthStateError();
		}

		GitLabOAuthSession oauth = oauthService.exchangeAndLoadUser(code);
		accountService.upsert(oauth);
		request.changeSessionId();
		session.setAttribute(AuthSessionAttributes.GITLAB_USER, oauth.user());
		return Map.of("returnUrl", returnUrl);
	}

	@PostMapping("/logout")
	public ResponseEntity<Void> logout(HttpServletRequest request) {
		HttpSession session = request.getSession(false);
		if (session != null) {
			GitLabUser user = getGitLabUser(request);
			if (user != null) {
				accountService.findOAuthSession(user.id()).ifPresent(oauth -> oauthService.revoke(oauth.accessToken()));
				accountService.deleteCredential(user.id());
			}
			session.invalidate();
		}
		return ResponseEntity.noContent().build();
	}

	@DeleteMapping("/account")
	public ResponseEntity<Void> deleteAccount(HttpServletRequest request) {
		GitLabUser user = getGitLabUser(request);
		if (user == null) throw new WorkspaceException("AUTH_REQUIRED", "GitLab 로그인이 필요합니다.", 401);
		workspaceService.anonymizeUserForAccountDeletion(user.id());
		accountService.findOAuthSession(user.id()).ifPresent(oauth -> oauthService.revoke(oauth.accessToken()));
		accountService.deleteAccount(user.id());
		HttpSession session = request.getSession(false);
		if (session != null) session.invalidate();
		return ResponseEntity.noContent().build();
	}

	private static GitLabUser getGitLabUser(HttpServletRequest request) {
		HttpSession session = request.getSession(false);
		if (session == null) return null;
		Object stored = session.getAttribute(AuthSessionAttributes.GITLAB_USER);
		if (stored instanceof GitLabUser user) return user;
		Object legacy = session.getAttribute(AuthSessionAttributes.LEGACY_GITLAB_OAUTH);
		return legacy instanceof GitLabOAuthSession oauth ? oauth.user() : null;
	}

	private static boolean stateMatches(String expected, String actual) {
		if (expected == null || actual == null) return false;
		return MessageDigest.isEqual(
			expected.getBytes(StandardCharsets.UTF_8),
			actual.getBytes(StandardCharsets.UTF_8)
		);
	}

	private static WorkspaceException oauthStateError() {
		return new WorkspaceException("GITLAB_OAUTH_STATE_INVALID", "GitLab OAuth 요청이 만료되었거나 유효하지 않습니다.", 400);
	}

	private static void clearPendingOAuth(HttpSession session) {
		session.removeAttribute(AuthSessionAttributes.OAUTH_PENDING_CODE);
		session.removeAttribute(AuthSessionAttributes.OAUTH_PENDING_RETURN_URL);
		session.removeAttribute(AuthSessionAttributes.OAUTH_PENDING_CREATED_AT);
	}

	private static String safeReturnUrl(String value) {
		if (value == null || !value.startsWith("/") || value.startsWith("//") || value.contains("\\") || value.contains("\r") || value.contains("\n")) {
			return "/today";
		}
		return value;
	}

	private static ResponseEntity<Void> redirect(String location) {
		return ResponseEntity.status(HttpStatus.FOUND).header(HttpHeaders.LOCATION, location).build();
	}

	private static Map<String, Object> profileResponse(OAuthAccountService.AccountProfile profile) {
		Map<String, Object> response = new LinkedHashMap<>();
		response.put("id", profile.id());
		response.put("username", profile.username());
		response.put("name", profile.name());
		response.put("avatarUrl", profile.avatarUrl());
		response.put("webUrl", profile.webUrl());
		response.put("profileCompleted", profile.profileCompleted());
		response.put("repositoryFileName", profile.repositoryFileName());
		response.put("timezone", profile.timezone());
		response.put("termsVersion", profile.termsVersion());
		response.put("termsAcceptedAt", profile.termsAcceptedAt());
		response.put("themeMode", profile.themeMode());
		response.put("accentColor", profile.accentColor());
		return response;
	}
}
