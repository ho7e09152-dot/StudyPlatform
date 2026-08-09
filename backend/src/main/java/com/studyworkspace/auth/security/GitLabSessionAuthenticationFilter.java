package com.studyworkspace.auth.security;

import java.io.IOException;
import com.studyworkspace.auth.dto.GitLabOAuthSession;
import com.studyworkspace.gitlab.dto.GitLabUser;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class GitLabSessionAuthenticationFilter extends OncePerRequestFilter {

	@Override
	protected void doFilterInternal(
		HttpServletRequest request,
		HttpServletResponse response,
		FilterChain filterChain
	) throws ServletException, IOException {
		if (SecurityContextHolder.getContext().getAuthentication() == null) {
			HttpSession session = request.getSession(false);
			Object stored = session == null ? null : session.getAttribute(AuthSessionAttributes.GITLAB_USER);
			if (stored == null && session != null) {
				Object legacy = session.getAttribute(AuthSessionAttributes.LEGACY_GITLAB_OAUTH);
				if (legacy instanceof GitLabOAuthSession oauth) {
					stored = oauth.user();
					session.setAttribute(AuthSessionAttributes.GITLAB_USER, oauth.user());
					session.removeAttribute(AuthSessionAttributes.LEGACY_GITLAB_OAUTH);
				}
			}
			if (stored instanceof GitLabUser user) {
				var authentication = new GitLabAuthenticationToken(user);
				SecurityContextHolder.getContext().setAuthentication(authentication);
			}
		}
		filterChain.doFilter(request, response);
	}
}
