package com.studyworkspace.workspace.domain;

public class WorkspaceException extends RuntimeException {

	private final String code;
	private final int status;

	public WorkspaceException(String code, String message, int status) {
		super(message);
		this.code = code;
		this.status = status;
	}

	public WorkspaceException(String code, String message, int status, Throwable cause) {
		super(message, cause);
		this.code = code;
		this.status = status;
	}

	public String code() {
		return code;
	}

	public int status() {
		return status;
	}
}
