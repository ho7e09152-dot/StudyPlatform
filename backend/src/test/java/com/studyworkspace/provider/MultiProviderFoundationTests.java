package com.studyworkspace.provider;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static com.studyworkspace.auth.support.OAuthTestAccounts.completeGitLabRegistration;

import java.time.Instant;

import com.studyworkspace.auth.dto.GitLabOAuthSession;
import com.studyworkspace.auth.service.OAuthAccountService;
import com.studyworkspace.gitlab.dto.GitLabUser;
import com.studyworkspace.workspace.domain.RepositoryProvider;
import com.studyworkspace.github.config.GitHubAppProperties;
import com.studyworkspace.github.config.GitHubAppConfigurationValidator;
import java.time.Duration;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional
class MultiProviderFoundationTests {
	@Autowired private OAuthAccountService accounts;
	@Autowired private ProviderCapabilities capabilities;
	@Autowired private JdbcClient jdbc;
	@Autowired private EntityManager entityManager;

	@Test
	void repeatedGitLabLoginResolvesTheSameStudyIngUserAndProviderAccount() {
		var first = completeGitLabRegistration(accounts, oauth(8080L, "first-token", "first-name"));
		var second = accounts.resolveGitLabLogin(oauth(8080L, "rotated-token", "changed-name")).principal();
		entityManager.flush();

		assertThat(second.userId()).isEqualTo(first.userId());
		assertThat(second.providerAccountId()).isEqualTo(first.providerAccountId());
		assertThat(jdbc.sql("SELECT COUNT(*) FROM provider_accounts WHERE provider = 'GITLAB' AND external_user_id = '8080'")
			.query(Long.class).single()).isEqualTo(1);
		assertThat(jdbc.sql("SELECT COUNT(*) FROM user_accounts WHERE id = :id").param("id", first.userId())
			.query(Long.class).single()).isEqualTo(1);
		assertThat(accounts.findGitLabOAuthSessionByUserId(first.userId()).orElseThrow().accessToken())
			.isEqualTo("rotated-token");
	}

	@Test
	void repositoryIdentityIsUniqueWithinAProviderButNotAcrossProviders() {
		insertWorkspace("provider-workspace-a", 8101L);
		insertWorkspace("provider-workspace-b", 8102L);
		insertWorkspace("provider-workspace-c", 8103L);
		insertConnection("provider-workspace-a", "GITLAB", "123");
		insertConnection("provider-workspace-b", "GITHUB", "123");

		assertThat(jdbc.sql("SELECT COUNT(*) FROM repository_connections WHERE external_repository_id = '123'")
			.query(Long.class).single()).isEqualTo(2);
		assertThatThrownBy(() -> insertConnection("provider-workspace-c", "GITLAB", "123"))
			.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void onlyImplementedProvidersAreExposedAsCapabilities() {
		assertThat(capabilities.authProviders()).containsExactly(RepositoryProvider.GITLAB);
		assertThat(capabilities.repositoryProviders()).containsExactly(RepositoryProvider.GITLAB);
		assertThat(capabilities.authProviders()).doesNotContain(RepositoryProvider.GITHUB);
		assertThat(capabilities.accountLinkProviders()).containsExactly(RepositoryProvider.GITLAB);
	}

	@Test
	void configuredGitHubLinkingDoesNotEnableGitHubLoginOrRepositories() {
		ProviderCapabilities configured = new ProviderCapabilities(new GitHubAppProperties(
			"", "study-ing", "client", "secret", "http://localhost/callback", "",
			new GitHubAppProperties.Features(true, false, false), "https://github.com",
			"https://api.github.com", Duration.ofSeconds(10), Duration.ofMinutes(10)
		));
		assertThat(configured.accountLinkProviders()).containsExactly(RepositoryProvider.GITLAB, RepositoryProvider.GITHUB);
		assertThat(configured.authProviders()).containsExactly(RepositoryProvider.GITLAB);
		assertThat(configured.repositoryProviders()).containsExactly(RepositoryProvider.GITLAB);
	}

	@Test
	void credentialsAloneDoNotEnableGitHubAccountLinking() {
		ProviderCapabilities disabled = new ProviderCapabilities(new GitHubAppProperties(
			"", "study-ing", "client", "secret", "http://localhost/callback", "",
			new GitHubAppProperties.Features(false, false, false), "https://github.com",
			"https://api.github.com", Duration.ofSeconds(10), Duration.ofMinutes(10)
		));
		assertThat(disabled.accountLinkProviders()).containsExactly(RepositoryProvider.GITLAB);
	}

	@Test
	void loginCapabilityIsIndependentFromLinkingAndRepositoryCapabilities() {
		ProviderCapabilities configured = new ProviderCapabilities(new GitHubAppProperties(
			"", "study-ing", "client", "secret", "http://localhost/callback", "",
			new GitHubAppProperties.Features(false, true, false), "https://github.com",
			"https://api.github.com", Duration.ofSeconds(10), Duration.ofMinutes(10)
		));

		assertThat(configured.authProviders()).containsExactly(RepositoryProvider.GITLAB, RepositoryProvider.GITHUB);
		assertThat(configured.accountLinkProviders()).containsExactly(RepositoryProvider.GITLAB);
		assertThat(configured.repositoryProviders()).containsExactly(RepositoryProvider.GITLAB);
	}

	@Test
	void repositoryCapabilityRequiresBothTheFeatureAndValidatedAppAuthentication() {
		GitHubAppConfigurationValidator validator = mock(GitHubAppConfigurationValidator.class);
		when(validator.repositoryAuthenticationReady()).thenReturn(true);
		ProviderCapabilities configured = new ProviderCapabilities(new GitHubAppProperties(
			"123456", "study-ing", "client", "secret", "http://localhost/callback", "/run/secrets/key.pem",
			new GitHubAppProperties.Features(true, false, true), "https://github.com",
			"https://api.github.com", Duration.ofSeconds(10), Duration.ofMinutes(10)
		), validator);

		assertThat(configured.repositoryProviders())
			.containsExactly(RepositoryProvider.GITLAB, RepositoryProvider.GITHUB);
		assertThat(configured.authProviders()).containsExactly(RepositoryProvider.GITLAB);
	}

	private static GitLabOAuthSession oauth(long externalId, String accessToken, String displayName) {
		return new GitLabOAuthSession(new GitLabUser(externalId, "user-" + externalId, displayName, null, null),
			accessToken, "refresh", Instant.now().plusSeconds(3600), "api");
	}

	private void insertWorkspace(String id, long legacyProjectId) {
		Instant now = Instant.parse("2026-08-13T00:00:00Z");
		jdbc.sql("""
			INSERT INTO workspace_metadata (
			 id, name, gitlab_project_id, gitlab_project_path, default_branch, timezone, status,
			 created_at, updated_at, state_json, repository_base_path, repository_schema_version, import_mode, entity_version
			) VALUES (:id, :id, :projectId, :id, 'main', 'Asia/Seoul', 'ACTIVE', :now, :now, '{}', '', 2, 'NEW', 0)
			""").param("id", id).param("projectId", legacyProjectId).param("now", now).update();
	}

	private void insertConnection(String workspaceId, String provider, String externalId) {
		Instant now = Instant.parse("2026-08-13T00:00:00Z");
		jdbc.sql("""
			INSERT INTO repository_connections (
			 workspace_id, provider, external_repository_id, full_name, default_branch, created_at, updated_at
			) VALUES (:workspaceId, :provider, :externalId, :fullName, 'main', :now, :now)
			""").param("workspaceId", workspaceId).param("provider", provider).param("externalId", externalId)
			.param("fullName", provider.toLowerCase() + "/repo").param("now", now).update();
	}
}
