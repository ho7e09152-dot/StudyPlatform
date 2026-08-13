package com.studyworkspace.auth.security;

import com.studyworkspace.gitlab.dto.GitLabUser;
import com.studyworkspace.workspace.domain.RepositoryProvider;

/** Stable Study-ing session identity plus the provider proof used to establish it. */
public final class StudyIngPrincipal extends GitLabUser {
	private final String userId;
	private final String providerAccountId;
	private final RepositoryProvider provider;
	private final String externalUserId;

	public StudyIngPrincipal(String userId, String providerAccountId, RepositoryProvider provider,
		String externalUserId, String username, String displayName, String avatarUrl, String webUrl) {
		super(provider == RepositoryProvider.GITLAB ? Long.parseLong(externalUserId) : 0L,
			username, displayName, avatarUrl, webUrl);
		this.userId = userId;
		this.providerAccountId = providerAccountId;
		this.provider = provider;
		this.externalUserId = externalUserId;
	}

	public String userId() { return userId; }
	public String providerAccountId() { return providerAccountId; }
	public RepositoryProvider provider() { return provider; }
	public String externalUserId() { return externalUserId; }
	public String displayName() { return name(); }

	public long gitLabUserId() {
		if (provider != RepositoryProvider.GITLAB) {
			throw new IllegalStateException("The active identity is not GitLab.");
		}
		return Long.parseLong(externalUserId);
	}

	/** Transitional adapter for GitLab-only workspace services. */
	public GitLabUser toGitLabUser() {
		return new GitLabUser(gitLabUserId(), username(), displayName(), avatarUrl(), webUrl());
	}
}
