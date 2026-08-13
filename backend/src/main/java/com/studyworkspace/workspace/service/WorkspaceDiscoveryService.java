package com.studyworkspace.workspace.service;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.studyworkspace.auth.dto.GitLabOAuthSession;
import com.studyworkspace.auth.service.OAuthAccountService;
import com.studyworkspace.common.exception.GitLabApiException;
import com.studyworkspace.workspace.domain.RepositoryMembership;
import com.studyworkspace.workspace.domain.RepositoryProvider;
import com.studyworkspace.workspace.domain.WorkspaceException;
import com.studyworkspace.workspace.domain.WorkspaceModels.StudyMember;
import com.studyworkspace.workspace.domain.WorkspaceModels.WorkspaceState;
import com.studyworkspace.workspace.dto.DiscoverableWorkspace;
import com.studyworkspace.workspace.dto.WorkspaceJoinResponse;
import com.studyworkspace.workspace.port.RepositoryMembershipPort;
import org.springframework.stereotype.Service;

@Service
public class WorkspaceDiscoveryService {
	public static final int JOIN_MINIMUM_ACCESS_LEVEL = 30;

	private final WorkspaceService workspaces;
	private final OAuthAccountService accounts;
	private final Map<RepositoryProvider, RepositoryMembershipPort> membershipPorts;

	public WorkspaceDiscoveryService(
		WorkspaceService workspaces,
		OAuthAccountService accounts,
		List<RepositoryMembershipPort> membershipPorts
	) {
		this.workspaces = workspaces;
		this.accounts = accounts;
		this.membershipPorts = membershipPorts.stream().collect(Collectors.toUnmodifiableMap(
			RepositoryMembershipPort::provider,
			Function.identity()
		));
	}

	public List<DiscoverableWorkspace> discover(GitLabOAuthSession oauth) {
		RepositoryMembershipPort port = requirePort(RepositoryProvider.GITLAB);
		Map<String, RepositoryMembership> accessible = port.listAccessibleRepositories(oauth.accessToken()).stream()
			.filter(WorkspaceDiscoveryService::canJoin)
			.collect(Collectors.toMap(
				RepositoryMembership::repositoryId,
				Function.identity(),
				(left, right) -> left
			));

		return workspaces.listActiveRepositoryWorkspaces().stream()
			.filter(workspace -> workspace.members().stream().noneMatch(member ->
				member.gitlabUserId() == oauth.user().id() && "ACTIVE".equals(member.status())
			))
			.filter(workspace -> workspace.repository() != null
				&& RepositoryProvider.GITLAB.name().equals(workspace.repository().provider()))
			.filter(workspace -> accessible.containsKey(workspace.repository().externalRepositoryId()))
			.map(workspace -> new DiscoverableWorkspace(
				workspace.id(),
				workspace.name(),
				workspace.repository().provider(),
				workspace.repository().externalRepositoryId(),
				accessible.get(workspace.repository().externalRepositoryId()).repositoryPath(),
				workspace.repository().externalRepositoryId(),
				accessible.get(workspace.repository().externalRepositoryId()).repositoryPath(),
				accessible.get(workspace.repository().externalRepositoryId()).defaultBranch(),
				"REPOSITORY_WRITE_CONFIRMED"
			))
			.sorted(java.util.Comparator.comparing(DiscoverableWorkspace::workspaceName))
			.toList();
	}

	public WorkspaceJoinResponse join(String workspaceId, GitLabOAuthSession oauth) {
		WorkspaceState workspace = workspaces.listActiveRepositoryWorkspaces().stream()
			.filter(candidate -> candidate.id().equals(workspaceId))
			.findFirst()
			.orElseThrow(WorkspaceDiscoveryService::notDiscoverable);

		boolean alreadyJoined = workspace.members().stream().anyMatch(member ->
			member.gitlabUserId() == oauth.user().id() && "ACTIVE".equals(member.status())
		);
		if (alreadyJoined) return new WorkspaceJoinResponse(workspace, false);

		if (workspace.repository() == null) throw notDiscoverable();
		RepositoryProvider provider = RepositoryProvider.valueOf(workspace.repository().provider());
		RepositoryMembership membership;
		try {
			membership = requirePort(provider).getRepositoryMembership(
				oauth.accessToken(), workspace.repository().externalRepositoryId()
			);
		} catch (GitLabApiException exception) {
			if (exception.upstreamStatus() == 403 || exception.upstreamStatus() == 404) throw notDiscoverable();
			throw exception;
		}
		if (!canJoin(membership)) {
			throw new WorkspaceException(
				"WORKSPACE_JOIN_PERMISSION_REQUIRED",
				"Workspace 참여와 학습 제출을 위해 GitLab 프로젝트 쓰기 권한이 필요합니다.",
				403
			);
		}

		OAuthAccountService.AccountProfile profile = accounts.requireProfile(oauth.user().id());
		if (!profile.profileCompleted()) {
			throw new WorkspaceException("PROFILE_REQUIRED", "Workspace에 참여하기 전에 프로필을 설정해 주세요.", 409);
		}
		String displayName = profile.name() == null || profile.name().isBlank()
			? oauth.user().username()
			: profile.name();
		StudyMember candidate = new StudyMember(
			"member-" + oauth.user().id(),
			oauth.user().id(),
			oauth.user().username(),
			displayName,
			displayName.isBlank() ? "?" : displayName.substring(0, 1).toUpperCase(),
			"#6d52b5",
			profile.repositoryFileName(),
			"MEMBER",
			"ACTIVE",
			membership.accessLevel(),
			profile.userId()
		);
		return new WorkspaceJoinResponse(workspaces.joinMember(workspaceId, candidate), true);
	}

	private RepositoryMembershipPort requirePort(RepositoryProvider provider) {
		RepositoryMembershipPort port = membershipPorts.get(provider);
		if (port == null) throw new WorkspaceException("REPOSITORY_PROVIDER_UNAVAILABLE", "저장소 연결을 확인할 수 없습니다.", 503);
		return port;
	}

	private static boolean canJoin(RepositoryMembership membership) {
		return membership.accessLevel() != null && membership.accessLevel() >= JOIN_MINIMUM_ACCESS_LEVEL;
	}

	private static WorkspaceException notDiscoverable() {
		return new WorkspaceException("WORKSPACE_NOT_DISCOVERABLE", "참여 가능한 Workspace를 찾을 수 없습니다.", 404);
	}
}
