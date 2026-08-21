package com.studyworkspace.workspace.dto;

import java.util.List;

import com.studyworkspace.workspace.domain.RepositoryStorageLayout;

public record RepositoryImportAnalysis(
	long projectId,
	String projectPath,
	String defaultBranch,
	String classification,
	String repositoryBasePath,
	int repositorySchemaVersion,
	String treeFingerprint,
	int totalFiles,
	int compatibleSessions,
	int compatibleSubmissions,
	int ignoredFiles,
	List<ImportIssue> issues,
	RepositoryStorageLayout detectedLayout,
	double layoutConfidence,
	int detectedRecords
) {
	public RepositoryImportAnalysis(
		long projectId, String projectPath, String defaultBranch, String classification,
		String repositoryBasePath, int repositorySchemaVersion, String treeFingerprint,
		int totalFiles, int compatibleSessions, int compatibleSubmissions, int ignoredFiles,
		List<ImportIssue> issues
	) {
		this(projectId, projectPath, defaultBranch, classification, repositoryBasePath,
			repositorySchemaVersion, treeFingerprint, totalFiles, compatibleSessions,
			compatibleSubmissions, ignoredFiles, issues, null, 0, 0);
	}

	public record ImportIssue(String path, String code, String message) { }
}
