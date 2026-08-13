package com.studyworkspace.workspace.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;

import com.studyworkspace.auth.dto.GitLabOAuthSession;
import com.studyworkspace.auth.service.OAuthAccountService;
import com.studyworkspace.common.exception.GitLabApiException;
import com.studyworkspace.gitlab.dto.GitLabUser;
import com.studyworkspace.workspace.domain.RepositoryMembership;
import com.studyworkspace.workspace.domain.RepositoryProvider;
import com.studyworkspace.workspace.domain.WorkspaceException;
import com.studyworkspace.workspace.port.RepositoryMembershipPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import tools.jackson.databind.ObjectMapper;

class WorkspaceDiscoveryServiceTests {
	private static final long JOINING_USER_ID = 909L;
	private static final String WORKSPACE_ID = "workspace-evening";
	private static final String REPOSITORY_ID = "48213";

	@TempDir
	Path temporaryDirectory;

	private WorkspaceService workspaces;
	private OAuthAccountService accounts;
	private RepositoryMembershipPort memberships;
	private WorkspaceDiscoveryService discovery;
	private GitLabOAuthSession oauth;

	@BeforeEach
	void setUp() {
		workspaces = new WorkspaceService(new ObjectMapper(), temporaryDirectory.resolve("state.json").toString(), true);
		accounts = mock(OAuthAccountService.class);
		memberships = mock(RepositoryMembershipPort.class);
		when(memberships.provider()).thenReturn(RepositoryProvider.GITLAB);
		when(accounts.requireProfile(JOINING_USER_ID)).thenReturn(new OAuthAccountService.AccountProfile(
			JOINING_USER_ID, "joining-user", "새 멤버", null, null, true, "joining-user.md", "Asia/Seoul",
			"2026-08-13", Instant.now(), "2026-08-13", Instant.now(), Instant.now(), false, "LIGHT", "PURPLE"
		));
		discovery = new WorkspaceDiscoveryService(workspaces, accounts, List.of(memberships));
		oauth = new GitLabOAuthSession(
			new GitLabUser(JOINING_USER_ID, "joining-user", "새 멤버", null, null),
			"access-token", "refresh-token", Instant.now().plusSeconds(3600), "api"
		);
	}

	@Test
	void discoversOnlyAccessibleWritableActiveWorkspacesForNonMembers() {
		when(memberships.listAccessibleRepositories("access-token")).thenReturn(List.of(repository(30)));

		assertThat(discovery.discover(oauth))
			.extracting("workspaceId")
			.containsExactly(WORKSPACE_ID);
	}

	@Test
	void doesNotLeakWorkspaceWhenRepositoryIsNotAccessible() {
		when(memberships.listAccessibleRepositories("access-token")).thenReturn(List.of());

		assertThat(discovery.discover(oauth)).isEmpty();
		assertThatThrownBy(() -> discovery.join("guessed-workspace-id", oauth))
			.isInstanceOf(WorkspaceException.class)
			.extracting("code")
			.isEqualTo("WORKSPACE_NOT_DISCOVERABLE");
	}

	@Test
	void excludesSoftDeletedWorkspacesFromDiscoveryAndJoin() {
		workspaces.setStatus(WORKSPACE_ID, "SOFT_DELETED");
		when(memberships.listAccessibleRepositories("access-token")).thenReturn(List.of(repository(30)));

		assertThat(discovery.discover(oauth)).isEmpty();
		assertThatThrownBy(() -> discovery.join(WORKSPACE_ID, oauth))
			.isInstanceOf(WorkspaceException.class)
			.extracting("code")
			.isEqualTo("WORKSPACE_NOT_DISCOVERABLE");
	}

	@Test
	void revalidatesRepositoryPermissionAtJoinTime() {
		when(memberships.listAccessibleRepositories("access-token")).thenReturn(List.of(repository(30)));
		when(memberships.getRepositoryMembership("access-token", REPOSITORY_ID)).thenThrow(
			new GitLabApiException("GITLAB_PROJECT_NOT_FOUND", "not found", 404)
		);
		assertThat(discovery.discover(oauth)).hasSize(1);

		assertThatThrownBy(() -> discovery.join(WORKSPACE_ID, oauth))
			.isInstanceOf(WorkspaceException.class)
			.extracting("code")
			.isEqualTo("WORKSPACE_NOT_DISCOVERABLE");
	}

	@Test
	void requiresDeveloperAccessForJoinAndSubmissionSafety() {
		when(memberships.getRepositoryMembership("access-token", REPOSITORY_ID)).thenReturn(repository(20));

		assertThatThrownBy(() -> discovery.join(WORKSPACE_ID, oauth))
			.isInstanceOf(WorkspaceException.class)
			.extracting("code")
			.isEqualTo("WORKSPACE_JOIN_PERMISSION_REQUIRED");
	}

	@Test
	void joinsAsMemberAndIsIdempotent() {
		when(memberships.getRepositoryMembership("access-token", REPOSITORY_ID)).thenReturn(repository(40));

		var first = discovery.join(WORKSPACE_ID, oauth);
		var second = discovery.join(WORKSPACE_ID, oauth);

		assertThat(first.joined()).isTrue();
		assertThat(second.joined()).isFalse();
		assertThat(second.workspace().members())
			.filteredOn(member -> member.gitlabUserId() == JOINING_USER_ID)
			.singleElement()
			.satisfies(member -> {
				assertThat(member.role()).isEqualTo("MEMBER");
				assertThat(member.accessLevel()).isEqualTo(40);
			});
	}

	@Test
	void concurrentDuplicateJoinCreatesOneMembership() throws Exception {
		when(memberships.getRepositoryMembership("access-token", REPOSITORY_ID)).thenReturn(repository(30));
		try (var executor = Executors.newFixedThreadPool(6)) {
			List<Callable<Void>> requests = java.util.stream.IntStream.range(0, 12)
				.mapToObj(index -> (Callable<Void>) () -> { discovery.join(WORKSPACE_ID, oauth); return null; })
				.toList();
			for (var result : executor.invokeAll(requests)) result.get();
		}

		assertThat(workspaces.get(WORKSPACE_ID).members())
			.filteredOn(member -> member.gitlabUserId() == JOINING_USER_ID)
			.hasSize(1);
	}

	private static RepositoryMembership repository(int accessLevel) {
		return new RepositoryMembership(
			RepositoryProvider.GITLAB,
			REPOSITORY_ID,
			"evening-workspace",
			"study-team/evening-workspace",
			"main",
			accessLevel
		);
	}
}
