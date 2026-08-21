package com.studyworkspace.common.validation;

/** Shared character-level safety policy for repository path inputs and generated segments. */
public final class RepositoryPathSafety {
	private RepositoryPathSafety() { }

	public static boolean containsDisallowedUnicode(String value) {
		return value != null && value.codePoints().anyMatch(codePoint ->
			Character.isISOControl(codePoint) || Character.getType(codePoint) == Character.FORMAT
		);
	}
}
