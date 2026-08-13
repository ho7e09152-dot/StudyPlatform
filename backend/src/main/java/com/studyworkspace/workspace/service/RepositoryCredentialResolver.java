package com.studyworkspace.workspace.service;

import com.studyworkspace.auth.security.StudyIngPrincipal;
import com.studyworkspace.auth.service.GitLabOAuthTokenProvider;
import com.studyworkspace.auth.service.OAuthAccountService;
import com.studyworkspace.provider.ProviderCapabilities;
import com.studyworkspace.workspace.domain.RepositoryProvider;
import com.studyworkspace.workspace.domain.WorkspaceException;
import com.studyworkspace.workspace.domain.WorkspaceModels.WorkspaceState;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Service;

/** Resolves a credential owned by the acting user, never by the Workspace. */
@Service
public class RepositoryCredentialResolver {
	public record ResolvedCredential(RepositoryProvider provider, String providerAccountId, String accessToken) { }

	private final GitLabOAuthTokenProvider gitLabTokens;
	private final ProviderCapabilities capabilities;
	private final OAuthAccountService accounts;

	public RepositoryCredentialResolver(GitLabOAuthTokenProvider gitLabTokens, ProviderCapabilities capabilities,
		OAuthAccountService accounts) {
		this.gitLabTokens = gitLabTokens;
		this.capabilities = capabilities;
		this.accounts = accounts;
	}

	public ResolvedCredential resolve(StudyIngPrincipal principal, WorkspaceState workspace, HttpServletRequest request) {
		if (workspace.repository() == null) {
			throw new WorkspaceException("REPOSITORY_CONNECTION_REQUIRED", "Workspace 저장소 연결이 필요합니다.", 409);
		}
		RepositoryProvider provider = RepositoryProvider.valueOf(workspace.repository().provider());
		if (!capabilities.supportsRepositoryProvider(provider)) {
			throw new WorkspaceException("REPOSITORY_PROVIDER_UNAVAILABLE", "현재 저장소 Provider를 사용할 수 없습니다.", 503);
		}
		if (provider != RepositoryProvider.GITLAB) {
			throw new WorkspaceException("PROVIDER_ACCOUNT_REQUIRED", provider.name() + " 계정 연결이 필요합니다.", 401);
		}
		var providerAccount = accounts.requireProviderAccountView(principal.userId(), provider);
		var oauth = gitLabTokens.requireValidSession(request);
		return new ResolvedCredential(provider, providerAccount.id(), oauth.accessToken());
	}
}
