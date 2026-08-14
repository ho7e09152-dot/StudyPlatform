package com.studyworkspace.workspace.security;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.studyworkspace.gitlab.dto.GitLabUser;
import com.studyworkspace.auth.service.GitLabOAuthTokenProvider;
import com.studyworkspace.auth.security.StudyIngPrincipal;
import com.studyworkspace.workspace.service.RepositoryCredentialResolver;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class WorkspaceAccessInterceptor implements HandlerInterceptor {

	private static final Pattern WORKSPACE_PATH = Pattern.compile("^/api/v1/workspaces/([^/]+)(?:/.*)?$");

	private final WorkspaceAccessService workspaceAccessService;
	private final WorkspaceRepositoryAccessVerifier repositoryAccessVerifier;
	private final GitLabOAuthTokenProvider tokenProvider;
	private final RepositoryCredentialResolver credentialResolver;

	public WorkspaceAccessInterceptor(
		WorkspaceAccessService workspaceAccessService,
		WorkspaceRepositoryAccessVerifier repositoryAccessVerifier,
		GitLabOAuthTokenProvider tokenProvider,
		RepositoryCredentialResolver credentialResolver
	) {
		this.workspaceAccessService = workspaceAccessService;
		this.repositoryAccessVerifier = repositoryAccessVerifier;
		this.tokenProvider = tokenProvider;
		this.credentialResolver = credentialResolver;
	}

	@Override
	public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
		if ("/api/v1/workspaces/deleted".equals(request.getRequestURI())
			|| "/api/v1/workspaces/discoverable".equals(request.getRequestURI())
			|| request.getRequestURI().matches("^/api/v1/workspaces/[^/]+/join$")) return true;
		Matcher matcher = WORKSPACE_PATH.matcher(request.getRequestURI());
		if (!matcher.matches()) return true;

		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		if (authentication == null || !(authentication.getPrincipal() instanceof GitLabUser user)) return true;

		boolean restoreRequest = request.getRequestURI().endsWith("/restore") && "POST".equals(request.getMethod());
		workspaceAccessService.requireActiveMember(matcher.group(1), user.id(), restoreRequest);
		String accessToken = user instanceof StudyIngPrincipal principal
			? credentialResolver.resolve(principal, workspaceAccessService.workspace(workspaceId(matcher)), request).accessToken()
			: tokenProvider.requireValidSession(request).accessToken();
		if (user instanceof StudyIngPrincipal principal) {
			repositoryAccessVerifier.requireRepositoryAccess(matcher.group(1), principal.userId(), accessToken);
		} else {
			repositoryAccessVerifier.requireRepositoryAccess(matcher.group(1), user.id(), accessToken);
		}
		return true;
	}

	private static String workspaceId(Matcher matcher) { return matcher.group(1); }
}
