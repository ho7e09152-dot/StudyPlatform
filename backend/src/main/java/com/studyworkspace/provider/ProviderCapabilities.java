package com.studyworkspace.provider;

import java.util.List;
import java.util.Map;

import com.studyworkspace.workspace.domain.RepositoryProvider;
import com.studyworkspace.github.config.GitHubOAuthProperties;
import org.springframework.stereotype.Service;

/** Single backend source of truth for providers that are safe to expose. */
@Service
public class ProviderCapabilities {
	private static final List<RepositoryProvider> AUTH_PROVIDERS = List.of(RepositoryProvider.GITLAB);
	private static final List<RepositoryProvider> REPOSITORY_PROVIDERS = List.of(RepositoryProvider.GITLAB);
	private final GitHubOAuthProperties githubOAuth;

	public ProviderCapabilities(GitHubOAuthProperties githubOAuth) {
		this.githubOAuth = githubOAuth;
	}

	public List<RepositoryProvider> authProviders() { return AUTH_PROVIDERS; }
	public List<RepositoryProvider> accountLinkProviders() {
		return githubOAuth.isConfigured()
			? List.of(RepositoryProvider.GITLAB, RepositoryProvider.GITHUB)
			: List.of(RepositoryProvider.GITLAB);
	}
	public List<RepositoryProvider> repositoryProviders() { return REPOSITORY_PROVIDERS; }
	public Map<String, Boolean> features() { return Map.of("workspaceDiscovery", true); }

	public boolean supportsRepositoryProvider(RepositoryProvider provider) {
		return REPOSITORY_PROVIDERS.contains(provider);
	}

	public boolean supportsAccountLinkProvider(RepositoryProvider provider) {
		return accountLinkProviders().contains(provider);
	}
}
