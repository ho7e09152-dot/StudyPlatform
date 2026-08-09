package com.studyworkspace.auth.service;

import com.studyworkspace.auth.dto.GitLabOAuthSession;
import com.studyworkspace.auth.security.AuthSessionAttributes;
import com.studyworkspace.gitlab.dto.GitLabUser;
import com.studyworkspace.workspace.domain.WorkspaceException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.stereotype.Service;

@Service
public class GitLabOAuthTokenProvider {

	private final GitLabOAuthService oauthService;
	private final OAuthAccountService accountService;

	public GitLabOAuthTokenProvider(GitLabOAuthService oauthService, OAuthAccountService accountService) {
		this.oauthService = oauthService;
		this.accountService = accountService;
	}

	public GitLabOAuthSession requireValidSession(HttpServletRequest request) {
		HttpSession session = request.getSession(false);
		Object stored = session == null ? null : session.getAttribute(AuthSessionAttributes.GITLAB_USER);
		if (!(stored instanceof GitLabUser user)) {
			throw new WorkspaceException("AUTH_REQUIRED", "GitLab 로그인이 필요합니다.", 401);
		}
		GitLabOAuthSession oauth = accountService.findOAuthSession(user.id())
			.orElseThrow(() -> new WorkspaceException("GITLAB_RECONNECT_REQUIRED", "GitLab 연결을 다시 승인해 주세요.", 401));
		if (oauth.expiresWithinSeconds(60)) {
			oauth = oauthService.refresh(oauth);
			accountService.upsert(oauth);
			oauth = accountService.findOAuthSession(user.id()).orElse(oauth);
			session.setAttribute(AuthSessionAttributes.GITLAB_USER, oauth.user());
		}
		return oauth;
	}
}
