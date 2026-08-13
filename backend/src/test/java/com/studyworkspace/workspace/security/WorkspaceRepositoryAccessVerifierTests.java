package com.studyworkspace.workspace.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.nio.file.Path;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;

import com.studyworkspace.auth.dto.GitLabOAuthSession;
import com.studyworkspace.common.exception.GitLabApiException;
import com.studyworkspace.gitlab.dto.GitLabUser;
import com.studyworkspace.workspace.domain.RepositoryMembership;
import com.studyworkspace.workspace.domain.RepositoryProvider;
import com.studyworkspace.workspace.domain.WorkspaceException;
import com.studyworkspace.workspace.port.RepositoryMembershipPort;
import com.studyworkspace.workspace.service.WorkspaceService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import tools.jackson.databind.ObjectMapper;

class WorkspaceRepositoryAccessVerifierTests {
	private static final String WORKSPACE_ID = "workspace-evening";
	private static final String REPOSITORY_ID = "48213";
	private static final long USER_ID = 101L;

	@TempDir
	Path temporaryDirectory;

	private RepositoryMembershipPort memberships;
	private WorkspaceService workspaces;
	private MutableClock clock;
	private WorkspaceRepositoryAccessVerifier verifier;

	@BeforeEach
	void setUp() {
		memberships = mock(RepositoryMembershipPort.class);
		when(memberships.provider()).thenReturn(RepositoryProvider.GITLAB);
		workspaces = new WorkspaceService(new ObjectMapper(), temporaryDirectory.resolve("state.json").toString(), true);
		clock = new MutableClock(Instant.parse("2026-08-13T00:00:00Z"));
		verifier = new WorkspaceRepositoryAccessVerifier(workspaces, List.of(memberships), Duration.ofMinutes(5), clock);
	}

	@Test
	void reusesVerifiedMembershipUntilTtlExpires() {
		when(memberships.getRepositoryMembership("token", REPOSITORY_ID)).thenReturn(repository(20));

		verifier.requireRepositoryAccess(WORKSPACE_ID, USER_ID, "token");
		verifier.requireRepositoryAccess(WORKSPACE_ID, USER_ID, "token");
		verify(memberships, times(1)).getRepositoryMembership("token", REPOSITORY_ID);

		clock.advance(Duration.ofMinutes(6));
		verifier.requireRepositoryAccess(WORKSPACE_ID, USER_ID, "token");
		verify(memberships, times(2)).getRepositoryMembership("token", REPOSITORY_ID);
	}

	@Test
	void confirmedRevocationIsDeniedAndCached() {
		when(memberships.getRepositoryMembership("token", REPOSITORY_ID)).thenThrow(
			new GitLabApiException("GITLAB_PROJECT_NOT_FOUND", "not found", 404)
		);

		assertThatThrownBy(() -> verifier.requireRepositoryAccess(WORKSPACE_ID, USER_ID, "token"))
			.isInstanceOf(WorkspaceException.class)
			.extracting("code")
			.isEqualTo("REPOSITORY_ACCESS_REVOKED");
		assertThatThrownBy(() -> verifier.requireRepositoryAccess(WORKSPACE_ID, USER_ID, "token"))
			.isInstanceOf(WorkspaceException.class)
			.extracting("code")
			.isEqualTo("REPOSITORY_ACCESS_REVOKED");
		verify(memberships, times(1)).getRepositoryMembership("token", REPOSITORY_ID);
	}

	@Test
	void providerOutageIsNotStoredAsRevocation() {
		when(memberships.getRepositoryMembership("token", REPOSITORY_ID))
			.thenThrow(new GitLabApiException("GITLAB_UPSTREAM_ERROR", "unavailable", 502))
			.thenReturn(repository(20));

		assertThatThrownBy(() -> verifier.requireRepositoryAccess(WORKSPACE_ID, USER_ID, "token"))
			.isInstanceOf(WorkspaceException.class)
			.extracting("code")
			.isEqualTo("REPOSITORY_PROVIDER_UNAVAILABLE");
		verifier.requireRepositoryAccess(WORKSPACE_ID, USER_ID, "token");
		verify(memberships, times(2)).getRepositoryMembership("token", REPOSITORY_ID);
	}

	@Test
	void loginProviderOutageIsDistinctFromRevocation() {
		when(memberships.listAccessibleRepositories("token"))
			.thenThrow(new GitLabApiException("GITLAB_UPSTREAM_ERROR", "unavailable", 502));
		GitLabOAuthSession oauth = new GitLabOAuthSession(
			new GitLabUser(USER_ID, "owner", "Owner", null, null),
			"token", "refresh", clock.instant().plusSeconds(3600), "api"
		);

		assertThatThrownBy(() -> verifier.verifyAtLogin(workspaces.list(USER_ID), oauth))
			.isInstanceOf(WorkspaceException.class)
			.extracting("code")
			.isEqualTo("REPOSITORY_PROVIDER_UNAVAILABLE");
	}

	@Test
	void successfulWorkspaceSwitchCheckClearsCachedRevocation() {
		when(memberships.getRepositoryMembership("token", REPOSITORY_ID)).thenThrow(
			new GitLabApiException("GITLAB_PROJECT_ACCESS_DENIED", "denied", 403)
		);
		assertThatThrownBy(() -> verifier.requireRepositoryAccess(WORKSPACE_ID, USER_ID, "token"))
			.isInstanceOf(WorkspaceException.class);

		verifier.confirmRepositoryAccess(USER_ID, Long.parseLong(REPOSITORY_ID));
		verifier.requireRepositoryAccess(WORKSPACE_ID, USER_ID, "token");
		verify(memberships, times(1)).getRepositoryMembership("token", REPOSITORY_ID);
	}

	@Test
	void loginBootstrapDoesNotReturnContentForRevokedRepositories() {
		when(memberships.listAccessibleRepositories("token")).thenReturn(List.of());
		GitLabOAuthSession oauth = new GitLabOAuthSession(
			new GitLabUser(USER_ID, "owner", "Owner", null, null),
			"token", "refresh", clock.instant().plusSeconds(3600), "api"
		);

		assertThatThrownBy(() -> verifier.verifyAtLogin(workspaces.list(USER_ID), oauth))
			.isInstanceOf(WorkspaceException.class)
			.extracting("code")
			.isEqualTo("REPOSITORY_ACCESS_REVOKED");
	}

	@Test
	void reporterRemainsEligibleForReadAfterAnExistingMembership() {
		when(memberships.getRepositoryMembership("token", REPOSITORY_ID)).thenReturn(repository(20));

		verifier.requireRepositoryAccess(WORKSPACE_ID, USER_ID, "token");

		assertThat(workspaces.list(USER_ID)).isNotEmpty();
	}

	private static RepositoryMembership repository(int accessLevel) {
		return new RepositoryMembership(
			RepositoryProvider.GITLAB, REPOSITORY_ID, "evening-workspace",
			"study-team/evening-workspace", "main", accessLevel
		);
	}

	private static final class MutableClock extends Clock {
		private Instant instant;

		private MutableClock(Instant instant) { this.instant = instant; }
		private void advance(Duration duration) { instant = instant.plus(duration); }
		@Override public ZoneId getZone() { return ZoneOffset.UTC; }
		@Override public Clock withZone(ZoneId zone) { return this; }
		@Override public Instant instant() { return instant; }
	}
}
