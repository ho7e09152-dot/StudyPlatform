package com.studyworkspace.common.exception;

import com.studyworkspace.workspace.domain.RepositoryProvider;

public class GitHubApiException extends RepositoryProviderException {
	public GitHubApiException(String code, String message, int upstreamStatus) {
		super(RepositoryProvider.GITHUB, code, message, upstreamStatus);
	}

	public GitHubApiException(String code, String message, int upstreamStatus, Throwable cause) {
		super(RepositoryProvider.GITHUB, code, message, upstreamStatus, cause);
	}
}
