package com.studyworkspace.workspace.security;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.studyworkspace.auth.dto.GitLabOAuthSession;
import com.studyworkspace.common.exception.GitLabApiException;
import com.studyworkspace.workspace.domain.RepositoryMembership;
import com.studyworkspace.workspace.domain.RepositoryProvider;
import com.studyworkspace.workspace.domain.WorkspaceException;
import com.studyworkspace.workspace.domain.WorkspaceModels.WorkspaceState;
import com.studyworkspace.workspace.port.RepositoryMembershipPort;
import com.studyworkspace.workspace.service.WorkspaceService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Verifies that an existing Study-ing member still has access to the Workspace repository.
 * App membership is intentionally not mutated: a temporary provider outage and a repository
 * membership revocation are different states, and a restored provider permission should not
 * destroy the member's existing role or history.
 */
@Service
public class WorkspaceRepositoryAccessVerifier {
	private enum State { VERIFIED, REVOKED }
	private record CacheKey(long gitLabUserId, String workspaceId) { }
	private record Verification(State state, Instant expiresAt) { }

	private final WorkspaceService workspaces;
	private final Map<RepositoryProvider, RepositoryMembershipPort> membershipPorts;
	private final Duration verificationTtl;
	private final Clock clock;
	private final ConcurrentHashMap<CacheKey, Verification> cache = new ConcurrentHashMap<>();

	@Autowired
	public WorkspaceRepositoryAccessVerifier(
		WorkspaceService workspaces,
		List<RepositoryMembershipPort> membershipPorts,
		@Value("${app.workspace.repository-membership-verification-ttl:5m}") Duration verificationTtl
	) {
		this(workspaces, membershipPorts, verificationTtl, Clock.systemUTC());
	}

	WorkspaceRepositoryAccessVerifier(
		WorkspaceService workspaces,
		List<RepositoryMembershipPort> membershipPorts,
		Duration verificationTtl,
		Clock clock
	) {
		this.workspaces = workspaces;
		this.membershipPorts = membershipPorts.stream().collect(Collectors.toUnmodifiableMap(
			RepositoryMembershipPort::provider,
			Function.identity()
		));
		this.verificationTtl = verificationTtl;
		this.clock = clock;
	}

	/** Login/bootstrap verification uses one provider project-list call for all joined Workspaces. */
	public List<WorkspaceState> verifyAtLogin(List<WorkspaceState> joined, GitLabOAuthSession oauth) {
		if (joined.isEmpty()) return List.of();
		Map<String, RepositoryMembership> accessible;
		try {
			accessible = requirePort(RepositoryProvider.GITLAB).listAccessibleRepositories(oauth.accessToken()).stream()
				.collect(Collectors.toMap(RepositoryMembership::repositoryId, Function.identity(), (left, right) -> left));
		} catch (GitLabApiException exception) {
			throw providerFailure(exception);
		}

		List<WorkspaceState> verified = joined.stream().filter(workspace -> {
			boolean hasAccess = workspace.repository() == null
				|| RepositoryProvider.GITLAB.name().equals(workspace.repository().provider())
					&& accessible.containsKey(workspace.repository().externalRepositoryId());
			remember(oauth.user().id(), workspace.id(), hasAccess ? State.VERIFIED : State.REVOKED);
			return hasAccess;
		}).toList();
		if (verified.isEmpty()) throw accessRevoked();
		return verified;
	}

	/** Workspace-scoped requests reuse a short verification TTL instead of calling GitLab per page request. */
	public void requireRepositoryAccess(String workspaceId, long gitLabUserId, String accessToken) {
		WorkspaceState workspace = workspaces.get(workspaceId);
		if (workspace.repository() == null) return;
		RepositoryProvider provider = RepositoryProvider.valueOf(workspace.repository().provider());
		CacheKey key = new CacheKey(gitLabUserId, workspaceId);
		Verification current = cache.get(key);
		if (current != null && current.expiresAt().isAfter(clock.instant())) {
			if (current.state() == State.REVOKED) throw accessRevoked();
			return;
		}

		try {
			requirePort(provider).getRepositoryMembership(
				accessToken,
				workspace.repository().externalRepositoryId()
			);
			remember(gitLabUserId, workspaceId, State.VERIFIED);
		} catch (GitLabApiException exception) {
			if (exception.upstreamStatus() == 403 || exception.upstreamStatus() == 404) {
				remember(gitLabUserId, workspaceId, State.REVOKED);
				throw accessRevoked();
			}
			throw providerFailure(exception);
		}
	}

	public void invalidate(long gitLabUserId, String workspaceId) {
		cache.remove(new CacheKey(gitLabUserId, workspaceId));
	}

	/** A successful provider connection check is also a fresh Workspace-switch verification. */
	public void confirmRepositoryAccess(long gitLabUserId, long repositoryId) {
		workspaces.list(gitLabUserId).stream()
			.filter(workspace -> workspace.repository() != null
				&& RepositoryProvider.GITLAB.name().equals(workspace.repository().provider())
				&& Long.toString(repositoryId).equals(workspace.repository().externalRepositoryId()))
			.forEach(workspace -> remember(gitLabUserId, workspace.id(), State.VERIFIED));
	}

	private RepositoryMembershipPort requirePort(RepositoryProvider provider) {
		RepositoryMembershipPort port = membershipPorts.get(provider);
		if (port == null) throw new WorkspaceException(
			"REPOSITORY_PROVIDER_UNAVAILABLE", "저장소 연결 상태를 확인하지 못했습니다.", 503
		);
		return port;
	}

	private void remember(long gitLabUserId, String workspaceId, State state) {
		cache.put(new CacheKey(gitLabUserId, workspaceId), new Verification(state, clock.instant().plus(verificationTtl)));
	}

	private static WorkspaceException accessRevoked() {
		return new WorkspaceException(
			"REPOSITORY_ACCESS_REVOKED",
			"GitLab 프로젝트 접근 권한을 확인해주세요.",
			403
		);
	}

	private static RuntimeException providerFailure(GitLabApiException exception) {
		if (exception.upstreamStatus() == 401) return exception;
		return new WorkspaceException(
			"REPOSITORY_PROVIDER_UNAVAILABLE",
			"GitLab 연결 상태를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.",
			503
		);
	}
}
