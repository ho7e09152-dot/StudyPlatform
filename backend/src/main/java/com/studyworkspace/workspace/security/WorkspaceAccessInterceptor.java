package com.studyworkspace.workspace.security;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.studyworkspace.gitlab.dto.GitLabUser;
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

	public WorkspaceAccessInterceptor(WorkspaceAccessService workspaceAccessService) {
		this.workspaceAccessService = workspaceAccessService;
	}

	@Override
	public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
		if ("/api/v1/workspaces/deleted".equals(request.getRequestURI())) return true;
		Matcher matcher = WORKSPACE_PATH.matcher(request.getRequestURI());
		if (!matcher.matches()) return true;

		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		if (authentication == null || !(authentication.getPrincipal() instanceof GitLabUser user)) return true;

		boolean restoreRequest = request.getRequestURI().endsWith("/restore") && "POST".equals(request.getMethod());
		workspaceAccessService.requireActiveMember(matcher.group(1), user.id(), restoreRequest);
		return true;
	}
}
