package com.studyworkspace.workspace.dto;

import java.util.List;

public record RepositorySchemaMigrationPreview(
	int currentSchemaVersion,
	int targetSchemaVersion,
	String currentBasePath,
	String targetBasePath,
	String treeFingerprint,
	int sessionFiles,
	int submissionFiles,
	int totalMoves,
	boolean ready,
	List<FileMove> moves,
	List<Blocker> blockers
) {
	public record FileMove(String sourcePath, String targetPath, String type) { }
	public record Blocker(String path, String code, String message) { }
}
