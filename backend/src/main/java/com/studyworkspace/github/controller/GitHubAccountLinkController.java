package com.studyworkspace.github.controller;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;

import com.studyworkspace.auth.security.AuthSessionAttributes;
import com.studyworkspace.auth.security.StudyIngPrincipal;
import com.studyworkspace.auth.service.ProviderAccountLinkingService;
import com.studyworkspace.github.config.GitHubAppProperties;
import com.studyworkspace.github.service.GitHubOAuthService;
import com.studyworkspace.provider.ProviderCapabilities;
import com.studyworkspace.workspace.domain.RepositoryProvider;
import com.studyworkspace.workspace.domain.WorkspaceException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/provider-accounts/github")
public class GitHubAccountLinkController {
	private static final String LINK_ACTION = "LINK";
	private static final String LOGIN_ACTION = "LOGIN";

	private final String frontendUrl;
	private final GitHubOAuthService githubOAuth;
	private final GitHubAppProperties properties;
	private final ProviderCapabilities capabilities;
	private final ProviderAccountLinkingService linkingService;

	public GitHubAccountLinkController(
		@Value("${app.frontend-url:http://localhost:3000}") String frontendUrl,
		GitHubOAuthService githubOAuth,
		GitHubAppProperties properties,
		ProviderCapabilities capabilities,
		ProviderAccountLinkingService linkingService
	) {
		this.frontendUrl = frontendUrl.replaceAll("/+$", "");
		this.githubOAuth = githubOAuth;
		this.properties = properties;
		this.capabilities = capabilities;
		this.linkingService = linkingService;
	}

	@GetMapping("/link")
	public ResponseEntity<Void> start(
		@AuthenticationPrincipal StudyIngPrincipal principal,
		HttpServletRequest request
	) {
		requireAuthenticated(principal);
		if (!capabilities.supportsAccountLinkProvider(RepositoryProvider.GITHUB)) {
			throw new WorkspaceException("GITHUB_LINK_NOT_AVAILABLE", "GitHub 계정 연결이 아직 준비되지 않았습니다.", 503);
		}
		String state = githubOAuth.createState();
		String verifier = githubOAuth.createCodeVerifier();
		HttpSession session = request.getSession(true);
		clearLinkState(session);
		session.setAttribute(AuthSessionAttributes.GITHUB_LINK_STATE, state);
		session.setAttribute(AuthSessionAttributes.GITHUB_LINK_STATE_CREATED_AT, Instant.now());
		session.setAttribute(AuthSessionAttributes.GITHUB_LINK_USER_ID, principal.userId());
		session.setAttribute(AuthSessionAttributes.GITHUB_LINK_ACTION, LINK_ACTION);
		session.setAttribute(AuthSessionAttributes.GITHUB_LINK_CODE_VERIFIER, verifier);
		return redirect(githubOAuth.authorizationUrl(state, githubOAuth.codeChallenge(verifier)));
	}

	@GetMapping("/callback")
	public ResponseEntity<Void> callback(
		@RequestParam(required = false) String code,
		@RequestParam(required = false) String state,
		@RequestParam(required = false) String error,
		@AuthenticationPrincipal StudyIngPrincipal principal,
		HttpServletRequest request
	) {
		HttpSession session = request.getSession(false);
		if (session == null) return loginRedirect("session_expired");

		String expectedState = (String) session.getAttribute(AuthSessionAttributes.GITHUB_LINK_STATE);
		Instant createdAt = (Instant) session.getAttribute(AuthSessionAttributes.GITHUB_LINK_STATE_CREATED_AT);
		String expectedUserId = (String) session.getAttribute(AuthSessionAttributes.GITHUB_LINK_USER_ID);
		String action = (String) session.getAttribute(AuthSessionAttributes.GITHUB_LINK_ACTION);
		String verifier = (String) session.getAttribute(AuthSessionAttributes.GITHUB_LINK_CODE_VERIFIER);
		String returnUrl = safeReturnUrl((String) session.getAttribute(AuthSessionAttributes.GITHUB_LOGIN_RETURN_URL));
		clearLinkState(session);

		boolean invalidState = !stateMatches(expectedState, state)
			|| createdAt == null || createdAt.plus(properties.stateTtl()).isBefore(Instant.now())
			|| verifier == null || verifier.isBlank();
		if (invalidState) {
			return LOGIN_ACTION.equals(action) ? loginRedirect("session_expired") : settingsRedirect("github_expired");
		}

		if (LOGIN_ACTION.equals(action)) {
			if (error != null) return loginRedirect("access_denied".equals(error) ? "access_denied" : "oauth_failed");
			if (code == null || code.isBlank()) return loginRedirect("oauth_failed");
			session.setAttribute(AuthSessionAttributes.GITHUB_LOGIN_PENDING_CODE, code);
			session.setAttribute(AuthSessionAttributes.GITHUB_LOGIN_PENDING_VERIFIER, verifier);
			session.setAttribute(AuthSessionAttributes.GITHUB_LOGIN_PENDING_RETURN_URL, returnUrl);
			session.setAttribute(AuthSessionAttributes.GITHUB_LOGIN_PENDING_CREATED_AT, Instant.now());
			return redirect(frontendUrl + "/auth/callback?provider=GITHUB");
		}

		requireAuthenticated(principal);
		if (!LINK_ACTION.equals(action) || !principal.userId().equals(expectedUserId)) {
			return settingsRedirect("github_expired");
		}
		if (error != null) {
			return settingsRedirect("access_denied".equals(error) ? "github_cancelled" : "github_failed");
		}
		if (code == null || code.isBlank()) return settingsRedirect("github_failed");

		try {
			var proof = githubOAuth.exchangeAndLoadIdentity(code, verifier);
			linkingService.link(principal.userId(), proof.identity(), proof.credential());
			return settingsRedirect("github_success");
		} catch (WorkspaceException exception) {
			if ("PROVIDER_ACCOUNT_COLLISION".equals(exception.code())) {
				return settingsRedirect("github_collision");
			}
			if ("PROVIDER_ACCOUNT_ALREADY_LINKED".equals(exception.code())) {
				return settingsRedirect("github_account_exists");
			}
			return settingsRedirect("github_failed");
		} catch (RuntimeException exception) {
			return settingsRedirect("github_failed");
		}
	}

	private static void requireAuthenticated(StudyIngPrincipal principal) {
		if (principal == null || principal.userId() == null || principal.userId().startsWith("legacy:")) {
			throw new WorkspaceException("AUTH_REQUIRED", "Study-ing 로그인이 필요합니다.", 401);
		}
	}

	private static boolean stateMatches(String expected, String actual) {
		if (expected == null || actual == null) return false;
		return MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), actual.getBytes(StandardCharsets.UTF_8));
	}

	private static WorkspaceException invalidState() {
		return new WorkspaceException("GITHUB_LINK_STATE_INVALID", "GitHub 계정 연결 요청이 만료되었거나 유효하지 않습니다.", 400);
	}

	private void clearLinkState(HttpSession session) {
		session.removeAttribute(AuthSessionAttributes.GITHUB_LINK_STATE);
		session.removeAttribute(AuthSessionAttributes.GITHUB_LINK_STATE_CREATED_AT);
		session.removeAttribute(AuthSessionAttributes.GITHUB_LINK_USER_ID);
		session.removeAttribute(AuthSessionAttributes.GITHUB_LINK_ACTION);
		session.removeAttribute(AuthSessionAttributes.GITHUB_LINK_CODE_VERIFIER);
		session.removeAttribute(AuthSessionAttributes.GITHUB_LOGIN_RETURN_URL);
	}

	private ResponseEntity<Void> settingsRedirect(String result) {
		return redirect(frontendUrl + "/settings/accounts?providerLink=" + result);
	}

	private ResponseEntity<Void> loginRedirect(String error) {
		return redirect(frontendUrl + "/login?provider=GITHUB&oauthError=" + error);
	}

	private static String safeReturnUrl(String value) {
		if (value == null || !value.startsWith("/") || value.startsWith("//") || value.contains("\\")
			|| value.contains("\r") || value.contains("\n")) return "/today";
		return value;
	}

	private static ResponseEntity<Void> redirect(String location) {
		return ResponseEntity.status(HttpStatus.FOUND).header(HttpHeaders.LOCATION, location).build();
	}
}
