package com.studyworkspace.common.exception;

public class GitLabApiException extends RuntimeException {

	private final String code;
	private final int upstreamStatus;

	public GitLabApiException(String code, String message, int upstreamStatus) {
		super(message);
		this.code = code;
		this.upstreamStatus = upstreamStatus;
	}

	public String code() {
		return code;
	}

	public int upstreamStatus() {
		return upstreamStatus;
	}
}
