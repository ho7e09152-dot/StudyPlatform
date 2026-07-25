package com.studyworkspace.gitlab.dto;

public record GitLabTreeItem(
	String id,
	String name,
	String type,
	String path,
	String mode
) {
}
