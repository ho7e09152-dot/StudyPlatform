package com.studyworkspace.workspace.security;

import com.studyworkspace.workspace.domain.WorkspaceException;
import com.studyworkspace.workspace.domain.WorkspaceModels.StudyMember;
import com.studyworkspace.workspace.domain.WorkspaceModels.WorkspaceState;
import com.studyworkspace.workspace.service.WorkspaceService;
import org.springframework.stereotype.Service;

@Service
public class WorkspaceAccessService {

	private final WorkspaceService workspaceService;

	public WorkspaceAccessService(WorkspaceService workspaceService) {
		this.workspaceService = workspaceService;
	}

	public StudyMember requireActiveMember(String workspaceId, long gitLabUserId, boolean allowDeleted) {
		WorkspaceState workspace = workspaceService.get(workspaceId);
		StudyMember member = workspace.members().stream()
			.filter(candidate -> candidate.gitlabUserId() == gitLabUserId)
			.filter(candidate -> "ACTIVE".equals(candidate.status()))
			.findFirst()
			.orElseThrow(() -> new WorkspaceException(
				"WORKSPACE_ACCESS_DENIED", "Workspace 활성 멤버가 아닙니다.", 403
			));
		if (!allowDeleted && !"ACTIVE".equals(workspace.status())) {
			throw new WorkspaceException("WORKSPACE_DELETED", "삭제된 Workspace에는 접근할 수 없습니다.", 410);
		}
		return member;
	}

	public StudyMember requireManager(String workspaceId, long gitLabUserId, boolean allowDeleted) {
		StudyMember member = requireActiveMember(workspaceId, gitLabUserId, allowDeleted);
		if (!"OWNER".equals(member.role()) && !"MANAGER".equals(member.role())) {
			throw new WorkspaceException("WORKSPACE_MANAGER_REQUIRED", "Workspace 관리자 권한이 필요합니다.", 403);
		}
		return member;
	}

	public StudyMember requireOwner(String workspaceId, long gitLabUserId, boolean allowDeleted) {
		StudyMember member = requireActiveMember(workspaceId, gitLabUserId, allowDeleted);
		if (!"OWNER".equals(member.role())) {
			throw new WorkspaceException("WORKSPACE_OWNER_REQUIRED", "Workspace Owner 권한이 필요합니다.", 403);
		}
		return member;
	}
}
