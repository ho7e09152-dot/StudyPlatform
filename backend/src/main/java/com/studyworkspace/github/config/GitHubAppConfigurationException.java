package com.studyworkspace.github.config;

/** Safe configuration failure that never includes credential material. */
public class GitHubAppConfigurationException extends IllegalStateException {
	public GitHubAppConfigurationException(String message) {
		super(message);
	}
}
