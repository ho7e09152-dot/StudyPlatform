package com.studyworkspace.provider;

import java.util.List;
import java.util.Map;

import com.studyworkspace.workspace.domain.RepositoryProvider;
import com.studyworkspace.github.config.GitHubAppProperties;
import com.studyworkspace.github.config.GitHubAppConfigurationValidator;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;

/** Single backend source of truth for providers that are safe to expose. */
@Service
public class ProviderCapabilities {
	private final GitHubAppProperties githubApp;
	private final GitHubAppConfigurationValidator githubConfiguration;

	@Autowired
	public ProviderCapabilities(GitHubAppProperties githubApp, GitHubAppConfigurationValidator githubConfiguration) {
		this.githubApp = githubApp;
		this.githubConfiguration = githubConfiguration;
	}

	ProviderCapabilities(GitHubAppProperties githubApp) {
		this(githubApp, null);
	}

	public List<RepositoryProvider> authProviders() {
		return githubLoginReady()
			? List.of(RepositoryProvider.GITLAB, RepositoryProvider.GITHUB)
			: List.of(RepositoryProvider.GITLAB);
	}
	public List<RepositoryProvider> accountLinkProviders() {
		return githubApp.accountLinkingReady()
			? List.of(RepositoryProvider.GITLAB, RepositoryProvider.GITHUB)
			: List.of(RepositoryProvider.GITLAB);
	}
	public List<RepositoryProvider> repositoryProviders() {
		return githubRepositoryReady()
			? List.of(RepositoryProvider.GITLAB, RepositoryProvider.GITHUB)
			: List.of(RepositoryProvider.GITLAB);
	}
	public Map<String, Boolean> features() { return Map.of("workspaceDiscovery", true); }

	public boolean supportsRepositoryProvider(RepositoryProvider provider) {
		return repositoryProviders().contains(provider);
	}

	public boolean supportsAccountLinkProvider(RepositoryProvider provider) {
		return accountLinkProviders().contains(provider);
	}

	public boolean supportsAuthProvider(RepositoryProvider provider) {
		return authProviders().contains(provider);
	}

	private boolean githubLoginReady() {
		return githubApp.features().login() && githubApp.userAuthorizationConfigured();
	}

	private boolean githubRepositoryReady() {
		return githubApp.features().repository()
			&& githubApp.userAuthorizationConfigured()
			&& githubConfiguration != null
			&& githubConfiguration.repositoryAuthenticationReady();
	}
}
