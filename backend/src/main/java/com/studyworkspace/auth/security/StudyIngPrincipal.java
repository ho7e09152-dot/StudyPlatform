package com.studyworkspace.auth.security;

import java.io.Serial;

import com.studyworkspace.gitlab.dto.GitLabUser;
import com.studyworkspace.workspace.domain.RepositoryProvider;

/** Stable Study-ing session identity plus the provider proof used to establish it. */
public final class StudyIngPrincipal extends GitLabUser {
	@Serial
	private static final long serialVersionUID = 1L;

	private final String userId;
	private final String providerAccountId;
	private final RepositoryProvider provider;
	private final String externalUserId;
	private final long membershipUserId;

	public StudyIngPrincipal(String userId, String providerAccountId, RepositoryProvider provider,
		String externalUserId, String username, String displayName, String avatarUrl, String webUrl) {
		this(userId, providerAccountId, provider, externalUserId, Long.parseLong(externalUserId),
			username, displayName, avatarUrl, webUrl);
	}

	public StudyIngPrincipal(String userId, String providerAccountId, RepositoryProvider provider,
		String externalUserId, long membershipUserId, String username, String displayName, String avatarUrl, String webUrl) {
		super(membershipUserId, username, displayName, avatarUrl, webUrl);
		this.userId = userId;
		this.providerAccountId = providerAccountId;
		this.provider = provider;
		this.externalUserId = externalUserId;
		this.membershipUserId = membershipUserId;
	}

	public String userId() { return userId; }
	public String providerAccountId() { return providerAccountId; }
	public RepositoryProvider provider() { return provider; }
	public String externalUserId() { return externalUserId; }
	public String displayName() { return name(); }

	public long gitLabUserId() {
		return membershipUserId;
	}

	/** Transitional adapter for GitLab-only workspace services. */
	public GitLabUser toGitLabUser() {
		return new GitLabUser(gitLabUserId(), username(), displayName(), avatarUrl(), webUrl());
	}
}
