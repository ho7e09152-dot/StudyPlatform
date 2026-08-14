package com.studyworkspace.github.service;

import java.time.Duration;
import java.time.Instant;

import com.studyworkspace.auth.service.OAuthAccountService;
import com.studyworkspace.workspace.domain.RepositoryProvider;
import org.springframework.stereotype.Service;

/** Resolves and refreshes the acting Study-ing user's GitHub App user access token. */
@Service
public class GitHubUserTokenProvider {
	private static final Duration REFRESH_SKEW = Duration.ofMinutes(2);

	private final OAuthAccountService accounts;
	private final GitHubOAuthService oauth;

	public GitHubUserTokenProvider(OAuthAccountService accounts, GitHubOAuthService oauth) {
		this.accounts = accounts;
		this.oauth = oauth;
	}

	public OAuthAccountService.ProviderCredential requireValidCredential(String userId) {
		var current = accounts.requireProviderCredential(userId, RepositoryProvider.GITHUB);
		if (current.expiresAt() == null || current.expiresAt().isAfter(Instant.now().plus(REFRESH_SKEW))) {
			return current;
		}
		var refreshed = oauth.refreshUserAccessToken(current.refreshToken());
		return accounts.rotateProviderCredential(
			userId,
			RepositoryProvider.GITHUB,
			refreshed.accessToken(),
			refreshed.refreshToken(),
			refreshed.expiresAt(),
			refreshed.scope()
		);
	}
}
