package com.studyworkspace.common.exception;

import com.studyworkspace.workspace.domain.RepositoryProvider;

public class GitLabApiException extends RepositoryProviderException {

	public GitLabApiException(String code, String message, int upstreamStatus) {
		super(RepositoryProvider.GITLAB, code, message, upstreamStatus);
	}
}
