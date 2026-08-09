package com.studyworkspace.auth.security;

import java.util.List;

import com.studyworkspace.gitlab.dto.GitLabUser;
import org.springframework.security.authentication.AbstractAuthenticationToken;

public final class GitLabAuthenticationToken extends AbstractAuthenticationToken {

	private final GitLabUser principal;

	public GitLabAuthenticationToken(GitLabUser principal) {
		super(List.of());
		this.principal = principal;
		setAuthenticated(true);
	}

	@Override
	public Object getCredentials() {
		return null;
	}

	@Override
	public GitLabUser getPrincipal() {
		return principal;
	}

	@Override
	public String getName() {
		return principal.username();
	}
}
