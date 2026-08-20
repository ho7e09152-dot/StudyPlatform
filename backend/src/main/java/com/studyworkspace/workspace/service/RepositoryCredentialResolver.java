package com.studyworkspace.workspace.service;

import com.studyworkspace.auth.security.StudyIngPrincipal;
import com.studyworkspace.auth.service.GitLabOAuthTokenProvider;
import com.studyworkspace.auth.service.OAuthAccountService;
import com.studyworkspace.provider.ProviderCapabilities;
import com.studyworkspace.github.service.GitHubUserTokenProvider;
import com.studyworkspace.workspace.domain.RepositoryProvider;
import com.studyworkspace.workspace.domain.WorkspaceException;
import com.studyworkspace.workspace.domain.WorkspaceModels.WorkspaceState;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Service;

/** Resolves a credential owned by the acting user, never by the Workspace. */
@Service
public class RepositoryCredentialResolver {
	public record ResolvedCredential(RepositoryProvider provider, String providerAccountId, String accessToken) { }

	public static boolean isCredentialUnavailable(String code) {
		return "PROVIDER_ACCOUNT_REQUIRED".equals(code)
			|| "PROVIDER_REAUTH_REQUIRED".equals(code)
			|| "GITHUB_REAUTH_REQUIRED".equals(code)
			|| "GITLAB_RECONNECT_REQUIRED".equals(code)
			|| "GITLAB_AUTHENTICATION_FAILED".equals(code);
	}

	private final GitLabOAuthTokenProvider gitLabTokens;
	private final ProviderCapabilities capabilities;
	private final OAuthAccountService accounts;
	private final GitHubUserTokenProvider gitHubTokens;

	public RepositoryCredentialResolver(GitLabOAuthTokenProvider gitLabTokens, ProviderCapabilities capabilities,
		OAuthAccountService accounts, GitHubUserTokenProvider gitHubTokens) {
		this.gitLabTokens = gitLabTokens;
		this.capabilities = capabilities;
		this.accounts = accounts;
		this.gitHubTokens = gitHubTokens;
	}

	public ResolvedCredential resolve(StudyIngPrincipal principal, WorkspaceState workspace, HttpServletRequest request) {
		if (workspace.repository() == null) {
			throw new WorkspaceException("REPOSITORY_CONNECTION_REQUIRED", "Workspace 저장소 연결이 필요합니다.", 409);
		}
		RepositoryProvider provider = RepositoryProvider.valueOf(workspace.repository().provider());
		return resolve(principal, provider, request);
	}

	public ResolvedCredential resolve(StudyIngPrincipal principal, RepositoryProvider provider, HttpServletRequest request) {
		if (!capabilities.supportsRepositoryProvider(provider)) {
			throw new WorkspaceException("REPOSITORY_PROVIDER_UNAVAILABLE", "현재 저장소 Provider를 사용할 수 없습니다.", 503);
		}
		var providerAccount = accounts.requireProviderAccountView(principal.userId(), provider);
		String accessToken = provider == RepositoryProvider.GITLAB
			? gitLabTokens.requireValidSession(request).accessToken()
			: gitHubTokens.requireValidCredential(principal.userId()).accessToken();
		return new ResolvedCredential(provider, providerAccount.id(), accessToken);
	}
}
