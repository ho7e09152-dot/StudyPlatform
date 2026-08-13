package com.studyworkspace.provider;

import com.studyworkspace.workspace.domain.RepositoryProvider;

/** Normalized external identity; provider API payloads must be adapted before this boundary. */
public record ProviderIdentity(
	RepositoryProvider provider,
	String externalUserId,
	String username,
	String displayName,
	String avatarUrl,
	String webUrl
) { }
