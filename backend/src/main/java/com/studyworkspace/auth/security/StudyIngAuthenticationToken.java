package com.studyworkspace.auth.security;

import java.util.List;

import org.springframework.security.authentication.AbstractAuthenticationToken;

public final class StudyIngAuthenticationToken extends AbstractAuthenticationToken {
	private final StudyIngPrincipal principal;

	public StudyIngAuthenticationToken(StudyIngPrincipal principal) {
		super(List.of());
		this.principal = principal;
		setAuthenticated(true);
	}

	@Override public Object getCredentials() { return null; }
	@Override public StudyIngPrincipal getPrincipal() { return principal; }
	@Override public String getName() { return principal.userId(); }
}
