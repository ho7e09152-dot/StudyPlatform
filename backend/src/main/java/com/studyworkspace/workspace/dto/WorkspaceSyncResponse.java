package com.studyworkspace.workspace.dto;

import java.util.List;

import com.studyworkspace.workspace.domain.WorkspaceModels.WorkspaceState;

public record WorkspaceSyncResponse(
	WorkspaceState workspace,
	int importedSessions,
	int removedSessions,
	int importedSubmissions,
	int removedSubmissions,
	List<SyncFailure> failures,
	String syncedAt
) {
	public record SyncFailure(String path, String code, String message) {
	}
}
