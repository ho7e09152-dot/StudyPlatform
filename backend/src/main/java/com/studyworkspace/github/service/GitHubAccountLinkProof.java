package com.studyworkspace.github.service;

import com.studyworkspace.provider.ProviderIdentity;
import com.studyworkspace.provider.ProviderOAuthCredential;

public record GitHubAccountLinkProof(
	ProviderIdentity identity,
	ProviderOAuthCredential credential
) {
	@Override
	public String toString() {
		return "GitHubAccountLinkProof[identity=%s, credential=<redacted>]".formatted(identity);
	}
}
