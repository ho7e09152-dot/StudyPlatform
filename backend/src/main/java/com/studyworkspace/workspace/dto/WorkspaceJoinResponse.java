package com.studyworkspace.workspace.dto;

import com.studyworkspace.workspace.domain.WorkspaceModels.WorkspaceState;

public record WorkspaceJoinResponse(
	WorkspaceState workspace,
	boolean joined
) {
}
