package com.studyworkspace.workspace.dto;

import java.util.List;

import com.studyworkspace.workspace.domain.WorkspaceModels.WorkspaceState;
import com.studyworkspace.workspace.dto.WorkspaceSyncResponse.SyncFailure;

public record RepositorySchemaMigrationResult(
	WorkspaceState workspace,
	String commitId,
	int movedFiles,
	List<SyncFailure> failures,
	String syncedAt
) {
}
