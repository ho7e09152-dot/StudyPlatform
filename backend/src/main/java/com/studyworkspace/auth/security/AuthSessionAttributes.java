package com.studyworkspace.auth.security;

public final class AuthSessionAttributes {

	public static final String GITLAB_USER = "gitlabUser";
	public static final String LEGACY_GITLAB_OAUTH = "gitlabOAuth";
	public static final String OAUTH_STATE = "gitlabOAuthState";
	public static final String OAUTH_STATE_CREATED_AT = "gitlabOAuthStateCreatedAt";
	public static final String OAUTH_RETURN_URL = "gitlabOAuthReturnUrl";
	public static final String OAUTH_PENDING_CODE = "gitlabOAuthPendingCode";
	public static final String OAUTH_PENDING_RETURN_URL = "gitlabOAuthPendingReturnUrl";
	public static final String OAUTH_PENDING_CREATED_AT = "gitlabOAuthPendingCreatedAt";

	private AuthSessionAttributes() {
	}
}
