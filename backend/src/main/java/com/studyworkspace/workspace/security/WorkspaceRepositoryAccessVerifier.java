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
import com.studyworkspace.common.exception.RepositoryProviderException;
import com.studyworkspace.auth.security.StudyIngPrincipal;
import com.studyworkspace.workspace.service.RepositoryCredentialResolver;
import jakarta.servlet.http.HttpServletRequest;
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
	private record CacheKey(String userId, String workspaceId) { }
	private record Verification(State state, Instant expiresAt) { }

	private final WorkspaceService workspaces;
	private final Map<RepositoryProvider, RepositoryMembershipPort> membershipPorts;
	private final Duration verificationTtl;
	private final Clock clock;
	private final RepositoryCredentialResolver credentials;
	private final ConcurrentHashMap<CacheKey, Verification> cache = new ConcurrentHashMap<>();

	@Autowired
	public WorkspaceRepositoryAccessVerifier(
		WorkspaceService workspaces,
		List<RepositoryMembershipPort> membershipPorts,
		@Value("${app.workspace.repository-membership-verification-ttl:5m}") Duration verificationTtl,
		RepositoryCredentialResolver credentials
	) {
		this(workspaces, membershipPorts, verificationTtl, Clock.systemUTC(), credentials);
	}

	WorkspaceRepositoryAccessVerifier(
		WorkspaceService workspaces,
		List<RepositoryMembershipPort> membershipPorts,
		Duration verificationTtl,
		Clock clock
	) {
		this(workspaces, membershipPorts, verificationTtl, clock, null);
	}

	WorkspaceRepositoryAccessVerifier(WorkspaceService workspaces, List<RepositoryMembershipPort> membershipPorts,
		Duration verificationTtl, Clock clock, RepositoryCredentialResolver credentials) {
		this.workspaces = workspaces;
		this.membershipPorts = membershipPorts.stream().collect(Collectors.toUnmodifiableMap(
			RepositoryMembershipPort::provider,
			Function.identity()
		));
		this.verificationTtl = verificationTtl;
		this.clock = clock;
		this.credentials = credentials;
	}

	public List<WorkspaceState> verifyAtLogin(List<WorkspaceState> joined, StudyIngPrincipal principal, HttpServletRequest request) {
		if (joined.isEmpty()) return List.of();
		Map<RepositoryProvider, Map<String, RepositoryMembership>> accessible = new java.util.EnumMap<>(RepositoryProvider.class);
		for (RepositoryProvider provider : joined.stream().filter(item -> item.repository() != null)
			.map(item -> RepositoryProvider.valueOf(item.repository().provider())).collect(java.util.stream.Collectors.toSet())) {
			try {
				String token = credentials.resolve(principal, provider, request).accessToken();
				accessible.put(provider, requirePort(provider).listAccessibleRepositories(token).stream()
					.collect(Collectors.toMap(RepositoryMembership::repositoryId, Function.identity(), (left, right) -> left)));
			} catch (WorkspaceException exception) {
				if (!"PROVIDER_ACCOUNT_REQUIRED".equals(exception.code())) throw exception;
				accessible.put(provider, Map.of());
			} catch (RepositoryProviderException exception) {
				throw providerFailure(exception);
			}
		}
		List<WorkspaceState> verified = joined.stream().filter(workspace -> {
			if (workspace.repository() == null) return true;
			RepositoryProvider provider = RepositoryProvider.valueOf(workspace.repository().provider());
			boolean hasAccess = accessible.getOrDefault(provider, Map.of()).containsKey(workspace.repository().externalRepositoryId());
			remember(principal.userId(), workspace.id(), hasAccess ? State.VERIFIED : State.REVOKED);
			return hasAccess;
		}).toList();
		if (verified.isEmpty()) throw accessRevoked(null);
		return verified;
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
			remember(Long.toString(oauth.user().id()), workspace.id(), hasAccess ? State.VERIFIED : State.REVOKED);
			return hasAccess;
		}).toList();
		if (verified.isEmpty()) throw accessRevoked(RepositoryProvider.GITLAB);
		return verified;
	}

	/** Workspace-scoped requests reuse a short verification TTL instead of calling GitLab per page request. */
	public void requireRepositoryAccess(String workspaceId, long gitLabUserId, String accessToken) {
		requireRepositoryAccess(workspaceId, Long.toString(gitLabUserId), accessToken);
	}

	public void requireRepositoryAccess(String workspaceId, String userId, String accessToken) {
		WorkspaceState workspace = workspaces.get(workspaceId);
		if (workspace.repository() == null) return;
		RepositoryProvider provider = RepositoryProvider.valueOf(workspace.repository().provider());
		CacheKey key = new CacheKey(userId, workspaceId);
		Verification current = cache.get(key);
		if (current != null && current.expiresAt().isAfter(clock.instant())) {
			if (current.state() == State.REVOKED) throw accessRevoked(provider);
			return;
		}

		try {
			requirePort(provider).getRepositoryMembership(
				accessToken,
				workspace.repository().externalRepositoryId()
			);
			remember(userId, workspaceId, State.VERIFIED);
		} catch (RepositoryProviderException exception) {
			if (exception.upstreamStatus() == 403 || exception.upstreamStatus() == 404) {
				remember(userId, workspaceId, State.REVOKED);
				throw accessRevoked(provider);
			}
			throw providerFailure(exception);
		}
	}

	public void invalidate(long gitLabUserId, String workspaceId) {
		cache.remove(new CacheKey(Long.toString(gitLabUserId), workspaceId));
	}

	/** A successful provider connection check is also a fresh Workspace-switch verification. */
	public void confirmRepositoryAccess(long gitLabUserId, long repositoryId) {
		workspaces.list(gitLabUserId).stream()
			.filter(workspace -> workspace.repository() != null
				&& RepositoryProvider.GITLAB.name().equals(workspace.repository().provider())
				&& Long.toString(repositoryId).equals(workspace.repository().externalRepositoryId()))
			.forEach(workspace -> remember(Long.toString(gitLabUserId), workspace.id(), State.VERIFIED));
	}

	private RepositoryMembershipPort requirePort(RepositoryProvider provider) {
		RepositoryMembershipPort port = membershipPorts.get(provider);
		if (port == null) throw new WorkspaceException(
			"REPOSITORY_PROVIDER_UNAVAILABLE", "저장소 연결 상태를 확인하지 못했습니다.", 503
		);
		return port;
	}

	private void remember(String userId, String workspaceId, State state) {
		cache.put(new CacheKey(userId, workspaceId), new Verification(state, clock.instant().plus(verificationTtl)));
	}

	private static WorkspaceException accessRevoked(RepositoryProvider provider) {
		return new WorkspaceException(
			"REPOSITORY_ACCESS_REVOKED",
			(provider == RepositoryProvider.GITHUB ? "GitHub 저장소" : "GitLab 프로젝트") + " 접근 권한을 확인해주세요.",
			403
		);
	}

	private static RuntimeException providerFailure(RepositoryProviderException exception) {
		if (exception.upstreamStatus() == 401) return exception;
		return new WorkspaceException(
			"REPOSITORY_PROVIDER_UNAVAILABLE",
			(exception.provider() == RepositoryProvider.GITHUB ? "GitHub" : "GitLab") + " 연결 상태를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.",
			503
		);
	}
}
