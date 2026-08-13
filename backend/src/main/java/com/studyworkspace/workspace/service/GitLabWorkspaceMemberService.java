package com.studyworkspace.workspace.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.studyworkspace.gitlab.dto.GitLabProjectMember;
import com.studyworkspace.gitlab.service.GitLabOAuthProjectService;
import com.studyworkspace.workspace.domain.WorkspaceException;
import com.studyworkspace.workspace.domain.WorkspaceModels.StudyMember;
import com.studyworkspace.workspace.domain.WorkspaceModels.WorkspaceState;
import org.springframework.stereotype.Service;

@Service
public class GitLabWorkspaceMemberService {
	private final GitLabOAuthProjectService gitLab;
	private final WorkspaceService workspaces;

	public GitLabWorkspaceMemberService(GitLabOAuthProjectService gitLab, WorkspaceService workspaces) {
		this.gitLab = gitLab;
		this.workspaces = workspaces;
	}

	public List<StudyMember> candidates(String accessToken, String workspaceId) {
		WorkspaceState workspace = workspaces.get(workspaceId);
		var existingIds = workspace.members().stream().map(StudyMember::gitlabUserId).collect(Collectors.toSet());
		return gitLab.getAllProjectMembers(accessToken, workspace.gitlabProjectId()).stream()
			.filter(member -> "active".equalsIgnoreCase(member.state()))
			.filter(member -> !existingIds.contains(member.id()))
			.map(member -> mapped(member, "MEMBER", "ACTIVE"))
			.toList();
	}

	public WorkspaceState addVerified(String accessToken, String workspaceId, long gitLabUserId) {
		GitLabProjectMember remote = gitLab.getAllProjectMembers(accessToken, workspaces.get(workspaceId).gitlabProjectId()).stream()
			.filter(member -> member.id() == gitLabUserId && "active".equalsIgnoreCase(member.state()))
			.findFirst()
			.orElseThrow(() -> new WorkspaceException("GITLAB_MEMBER_NOT_FOUND", "GitLab 프로젝트의 활성 멤버를 찾지 못했습니다.", 404));
		WorkspaceState workspace = workspaces.get(workspaceId);
		StudyMember candidate = mapped(remote, "MEMBER", "ACTIVE");
		String candidateFileName = candidate.fileName();
		boolean fileNameConflict = workspace.members().stream().anyMatch(member -> member.fileName().equalsIgnoreCase(candidateFileName));
		if (fileNameConflict) {
			candidate = new StudyMember(
				candidate.id(), candidate.gitlabUserId(), candidate.username(), candidate.displayName(), candidate.avatar(), candidate.color(),
				uniqueFileName(workspace, candidate.fileName()),
				candidate.role(), candidate.status(), candidate.accessLevel(), candidate.userId()
			);
		}
		return workspaces.addMember(workspaceId, candidate);
	}

	public WorkspaceState sync(String accessToken, String workspaceId) {
		WorkspaceState workspace = workspaces.get(workspaceId);
		Map<Long, GitLabProjectMember> remote = gitLab.getAllProjectMembers(accessToken, workspace.gitlabProjectId()).stream()
			.collect(Collectors.toMap(GitLabProjectMember::id, Function.identity(), (left, right) -> left));
		List<StudyMember> members = new ArrayList<>();
		for (StudyMember current : workspace.members()) {
			GitLabProjectMember match = remote.get(current.gitlabUserId());
			if (match == null || !"active".equalsIgnoreCase(match.state())) {
				members.add(new StudyMember(
					current.id(), current.gitlabUserId(), current.username(), current.displayName(), current.avatar(), current.color(),
					current.fileName(), current.role(), "PROJECT_ACCESS_LOST", current.accessLevel(), current.userId()
				));
			} else {
				members.add(new StudyMember(
					current.id(), match.id(), match.username(), current.displayName(), current.avatar(), current.color(), current.fileName(),
					current.role(), "ACTIVE", match.accessLevel(), current.userId()
				));
			}
		}
		return workspaces.replaceMembers(workspaceId, members);
	}

	private static StudyMember mapped(GitLabProjectMember member, String role, String status) {
		return new StudyMember(
			"member-" + member.id(), member.id(), member.username(), displayName(member), avatar(member), "#6d52b5",
			member.username().toLowerCase().replaceAll("[^a-z0-9._-]", "-") + ".md", role, status, member.accessLevel()
		);
	}

	private static String displayName(GitLabProjectMember member) {
		return member.name() == null || member.name().isBlank() ? member.username() : member.name();
	}

	private static String avatar(GitLabProjectMember member) {
		String displayName = displayName(member);
		return displayName.isBlank() ? "?" : displayName.substring(0, 1).toUpperCase();
	}

	private static String uniqueFileName(WorkspaceState workspace, String requested) {
		String base = requested.toLowerCase().endsWith(".md") ? requested.substring(0, requested.length() - 3) : requested;
		for (int suffix = 2; suffix <= 999; suffix++) {
			String candidate = base + "-" + suffix + ".md";
			if (workspace.members().stream().noneMatch(member -> member.fileName().equalsIgnoreCase(candidate))) return candidate;
		}
		throw new WorkspaceException("MEMBER_FILE_NAME_CONFLICT", "멤버 제출 파일명을 안전하게 만들지 못했습니다.", 409);
	}
}
