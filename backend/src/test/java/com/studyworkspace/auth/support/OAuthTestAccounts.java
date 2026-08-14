package com.studyworkspace.auth.support;

import com.studyworkspace.auth.dto.GitLabOAuthSession;
import com.studyworkspace.auth.security.StudyIngPrincipal;
import com.studyworkspace.auth.service.OAuthAccountService;

public final class OAuthTestAccounts {
	private OAuthTestAccounts() { }

	public static StudyIngPrincipal completeGitLabRegistration(OAuthAccountService accounts, GitLabOAuthSession oauth) {
		OAuthAccountService.LoginResult result = accounts.resolveGitLabLogin(oauth);
		if (!result.requiresRegistration()) return result.principal();
		return accounts.completeRegistration(result.pendingRegistration(), new OAuthAccountService.UpdateProfileRequest(
			oauth.user().name() == null || oauth.user().name().isBlank() ? oauth.user().username() : oauth.user().name(),
			oauth.user().username(), "Asia/Seoul", true, true, true
		)).principal();
	}
}
