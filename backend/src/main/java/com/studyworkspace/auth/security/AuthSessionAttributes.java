package com.studyworkspace.auth.security;

public final class AuthSessionAttributes {
	public static final String STUDY_ING_USER = "studyIngUser";

	/** @deprecated sessions now store {@link StudyIngPrincipal}. */
	@Deprecated
	public static final String GITLAB_USER = "gitlabUser";
	public static final String LEGACY_GITLAB_OAUTH = "gitlabOAuth";
	public static final String OAUTH_STATE = "gitlabOAuthState";
	public static final String OAUTH_STATE_CREATED_AT = "gitlabOAuthStateCreatedAt";
	public static final String OAUTH_RETURN_URL = "gitlabOAuthReturnUrl";
	public static final String OAUTH_PENDING_CODE = "gitlabOAuthPendingCode";
	public static final String OAUTH_PENDING_RETURN_URL = "gitlabOAuthPendingReturnUrl";
	public static final String OAUTH_PENDING_CREATED_AT = "gitlabOAuthPendingCreatedAt";

	public static final String GITHUB_LINK_STATE = "githubLinkState";
	public static final String GITHUB_LINK_STATE_CREATED_AT = "githubLinkStateCreatedAt";
	public static final String GITHUB_LINK_USER_ID = "githubLinkUserId";
	public static final String GITHUB_LINK_ACTION = "githubLinkAction";
	public static final String GITHUB_LINK_CODE_VERIFIER = "githubLinkCodeVerifier";

	private AuthSessionAttributes() {
	}
}
