package com.studyworkspace.github.controller;

import java.time.Instant;
import java.util.Map;

import com.studyworkspace.auth.security.AuthSessionAttributes;
import com.studyworkspace.auth.security.StudyIngPrincipal;
import com.studyworkspace.auth.service.AccountSessionService;
import com.studyworkspace.auth.service.OAuthAccountService;
import com.studyworkspace.github.config.GitHubAppProperties;
import com.studyworkspace.github.service.GitHubOAuthService;
import com.studyworkspace.provider.ProviderCapabilities;
import com.studyworkspace.workspace.domain.RepositoryProvider;
import com.studyworkspace.workspace.domain.WorkspaceException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** GitHub login is separate from explicit account linking even though both use the GitHub App callback. */
@RestController
@RequestMapping("/api/v1/auth/github")
public class GitHubLoginController {
	private static final String LOGIN_ACTION = "LOGIN";

	private final GitHubOAuthService githubOAuth;
	private final GitHubAppProperties properties;
	private final ProviderCapabilities capabilities;
	private final OAuthAccountService accounts;
	private final AccountSessionService sessions;

	public GitHubLoginController(GitHubOAuthService githubOAuth, GitHubAppProperties properties,
		ProviderCapabilities capabilities, OAuthAccountService accounts, AccountSessionService sessions) {
		this.githubOAuth = githubOAuth;
		this.properties = properties;
		this.capabilities = capabilities;
		this.accounts = accounts;
		this.sessions = sessions;
	}

	@GetMapping("/login")
	public ResponseEntity<Void> login(@RequestParam(defaultValue = "/today") String returnUrl, HttpServletRequest request) {
		if (!capabilities.supportsAuthProvider(RepositoryProvider.GITHUB)) {
			throw new WorkspaceException("GITHUB_LOGIN_NOT_AVAILABLE", "GitHub 로그인이 아직 준비되지 않았습니다.", 503);
		}
		String state = githubOAuth.createState();
		String verifier = githubOAuth.createCodeVerifier();
		HttpSession session = request.getSession(true);
		clearLoginState(session);
		session.setAttribute(AuthSessionAttributes.GITHUB_LINK_STATE, state);
		session.setAttribute(AuthSessionAttributes.GITHUB_LINK_STATE_CREATED_AT, Instant.now());
		session.setAttribute(AuthSessionAttributes.GITHUB_LINK_ACTION, LOGIN_ACTION);
		session.setAttribute(AuthSessionAttributes.GITHUB_LINK_CODE_VERIFIER, verifier);
		session.setAttribute(AuthSessionAttributes.GITHUB_LOGIN_RETURN_URL, safeReturnUrl(returnUrl));
		return redirect(githubOAuth.authorizationUrl(state, githubOAuth.codeChallenge(verifier)));
	}

	@PostMapping("/complete")
	public Map<String, String> complete(HttpServletRequest request) {
		HttpSession session = request.getSession(false);
		if (session == null) throw invalidState();
		String code = (String) session.getAttribute(AuthSessionAttributes.GITHUB_LOGIN_PENDING_CODE);
		String verifier = (String) session.getAttribute(AuthSessionAttributes.GITHUB_LOGIN_PENDING_VERIFIER);
		String returnUrl = safeReturnUrl((String) session.getAttribute(AuthSessionAttributes.GITHUB_LOGIN_PENDING_RETURN_URL));
		Instant createdAt = (Instant) session.getAttribute(AuthSessionAttributes.GITHUB_LOGIN_PENDING_CREATED_AT);
		clearPending(session);
		if (code == null || code.isBlank() || verifier == null || verifier.isBlank() || createdAt == null
			|| createdAt.plus(properties.stateTtl()).isBefore(Instant.now())) throw invalidState();

		var proof = githubOAuth.exchangeAndLoadIdentity(code, verifier);
		StudyIngPrincipal principal = accounts.authenticate(proof.identity(), proof.credential());
		request.changeSessionId();
		session.setAttribute(AuthSessionAttributes.STUDY_ING_USER, principal);
		sessions.register(session, principal.userId());
		return Map.of("returnUrl", returnUrl);
	}

	private static void clearLoginState(HttpSession session) {
		session.removeAttribute(AuthSessionAttributes.GITHUB_LINK_STATE);
		session.removeAttribute(AuthSessionAttributes.GITHUB_LINK_STATE_CREATED_AT);
		session.removeAttribute(AuthSessionAttributes.GITHUB_LINK_USER_ID);
		session.removeAttribute(AuthSessionAttributes.GITHUB_LINK_ACTION);
		session.removeAttribute(AuthSessionAttributes.GITHUB_LINK_CODE_VERIFIER);
		session.removeAttribute(AuthSessionAttributes.GITHUB_LOGIN_RETURN_URL);
		clearPending(session);
	}

	private static void clearPending(HttpSession session) {
		session.removeAttribute(AuthSessionAttributes.GITHUB_LOGIN_PENDING_CODE);
		session.removeAttribute(AuthSessionAttributes.GITHUB_LOGIN_PENDING_VERIFIER);
		session.removeAttribute(AuthSessionAttributes.GITHUB_LOGIN_PENDING_RETURN_URL);
		session.removeAttribute(AuthSessionAttributes.GITHUB_LOGIN_PENDING_CREATED_AT);
	}

	private static String safeReturnUrl(String value) {
		if (value == null || !value.startsWith("/") || value.startsWith("//") || value.contains("\\")
			|| value.contains("\r") || value.contains("\n")) return "/today";
		return value;
	}

	private static WorkspaceException invalidState() {
		return new WorkspaceException("GITHUB_OAUTH_STATE_INVALID", "GitHub OAuth 요청이 만료되었거나 유효하지 않습니다.", 400);
	}

	private static ResponseEntity<Void> redirect(String location) {
		return ResponseEntity.status(HttpStatus.FOUND).header(HttpHeaders.LOCATION, location).build();
	}
}
