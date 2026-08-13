package com.studyworkspace.auth.security;

import java.io.IOException;
import com.studyworkspace.auth.dto.GitLabOAuthSession;
import com.studyworkspace.auth.service.OAuthAccountService;
import com.studyworkspace.gitlab.dto.GitLabUser;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import com.studyworkspace.workspace.domain.WorkspaceException;

@Component
public class GitLabSessionAuthenticationFilter extends OncePerRequestFilter {
	private final OAuthAccountService accountService;

	public GitLabSessionAuthenticationFilter(OAuthAccountService accountService) {
		this.accountService = accountService;
	}

	@Override
	protected void doFilterInternal(
		HttpServletRequest request,
		HttpServletResponse response,
		FilterChain filterChain
	) throws ServletException, IOException {
		if (SecurityContextHolder.getContext().getAuthentication() == null) {
			HttpSession session = request.getSession(false);
			Object stored = session == null ? null : session.getAttribute(AuthSessionAttributes.STUDY_ING_USER);
			if (stored == null && session != null) {
				Object legacy = session.getAttribute(AuthSessionAttributes.GITLAB_USER);
				if (legacy == null) legacy = session.getAttribute(AuthSessionAttributes.LEGACY_GITLAB_OAUTH);
				GitLabUser gitLabUser = legacy instanceof GitLabOAuthSession oauth ? oauth.user()
					: legacy instanceof GitLabUser user ? user : null;
				if (gitLabUser != null) {
					try {
						stored = accountService.requirePrincipalByGitLabUserId(gitLabUser.id());
						session.setAttribute(AuthSessionAttributes.STUDY_ING_USER, stored);
						session.removeAttribute(AuthSessionAttributes.GITLAB_USER);
						session.removeAttribute(AuthSessionAttributes.LEGACY_GITLAB_OAUTH);
					} catch (WorkspaceException ignored) {
						// One-release compatibility for sessions created before ProviderAccount backfill.
						stored = gitLabUser;
					}
				}
			}
			if (stored instanceof StudyIngPrincipal user) {
				var authentication = new StudyIngAuthenticationToken(user);
				SecurityContextHolder.getContext().setAuthentication(authentication);
			} else if (stored instanceof GitLabUser user) {
				SecurityContextHolder.getContext().setAuthentication(new GitLabAuthenticationToken(user));
			}
		}
		filterChain.doFilter(request, response);
	}
}
