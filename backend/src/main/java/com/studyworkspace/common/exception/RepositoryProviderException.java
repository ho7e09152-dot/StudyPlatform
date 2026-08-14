package com.studyworkspace.common.exception;

import com.studyworkspace.workspace.domain.RepositoryProvider;

/** Provider-neutral upstream failure with an HTTP status that callers can classify safely. */
public class RepositoryProviderException extends RuntimeException {
	private final RepositoryProvider provider;
	private final String code;
	private final int upstreamStatus;

	public RepositoryProviderException(RepositoryProvider provider, String code, String message, int upstreamStatus) {
		super(message);
		this.provider = provider;
		this.code = code;
		this.upstreamStatus = upstreamStatus;
	}

	public RepositoryProviderException(RepositoryProvider provider, String code, String message, int upstreamStatus, Throwable cause) {
		super(message, cause);
		this.provider = provider;
		this.code = code;
		this.upstreamStatus = upstreamStatus;
	}

	public RepositoryProvider provider() { return provider; }
	public String code() { return code; }
	public int upstreamStatus() { return upstreamStatus; }
}
