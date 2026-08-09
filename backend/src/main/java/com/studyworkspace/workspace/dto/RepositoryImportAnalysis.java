package com.studyworkspace.workspace.dto;

import java.util.List;

public record RepositoryImportAnalysis(
	long projectId,
	String projectPath,
	String defaultBranch,
	String classification,
	String repositoryBasePath,
	String treeFingerprint,
	int totalFiles,
	int compatibleSessions,
	int compatibleSubmissions,
	int ignoredFiles,
	List<ImportIssue> issues
) {
	public record ImportIssue(String path, String code, String message) { }
}
