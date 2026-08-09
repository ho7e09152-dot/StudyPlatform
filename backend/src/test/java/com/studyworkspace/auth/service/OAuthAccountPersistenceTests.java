package com.studyworkspace.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;

import com.studyworkspace.auth.dto.GitLabOAuthSession;
import com.studyworkspace.auth.security.TokenCipher;
import com.studyworkspace.gitlab.dto.GitLabUser;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional
class OAuthAccountPersistenceTests {

	@Autowired
	private OAuthAccountService accountService;

	@Autowired
	private TokenCipher tokenCipher;

	@Autowired
	private JdbcClient jdbcClient;

	@Autowired
	private EntityManager entityManager;

	@Test
	void upsertsUserAndStoresOnlyEncryptedOAuthTokens() {
		accountService.upsert(new GitLabOAuthSession(
			new GitLabUser(987654321L, "persisted-user", "Persisted User", null, "https://gitlab.example/persisted-user"),
			"plain-access-token",
			"plain-refresh-token",
			Instant.now().plusSeconds(7200),
			"api"
		));
		entityManager.flush();

		String ciphertext = jdbcClient.sql("""
			SELECT c.access_token_ciphertext
			FROM oauth_credentials c
			JOIN user_accounts u ON u.id = c.user_id
			WHERE u.gitlab_user_id = :gitlabUserId
			""")
			.param("gitlabUserId", 987654321L)
			.query(String.class)
			.single();

		assertThat(ciphertext).doesNotContain("plain-access-token");
		assertThat(tokenCipher.decrypt(ciphertext)).isEqualTo("plain-access-token");
	}

	@Test
	void completedProfileUsesCustomNameAndIsNotOverwrittenByOAuthRefresh() {
		GitLabOAuthSession first = new GitLabOAuthSession(
			new GitLabUser(123456789L, "gitlab-id", "GitLab Default", null, null),
			"access-1", "refresh-1", Instant.now().plusSeconds(3600), "api"
		);
		accountService.upsert(first);
		var profile = accountService.updateProfile(123456789L, new OAuthAccountService.UpdateProfileRequest(
			"김서연", "서연-학습", "Asia/Seoul", true
		));
		assertThat(profile.profileCompleted()).isTrue();
		assertThat(profile.repositoryFileName()).isEqualTo("서연-학습.md");

		accountService.upsert(new GitLabOAuthSession(
			new GitLabUser(123456789L, "gitlab-id", "Changed GitLab Name", null, null),
			"access-2", "refresh-2", Instant.now().plusSeconds(7200), "api"
		));

		assertThat(accountService.requireProfile(123456789L).name()).isEqualTo("김서연");
		assertThat(accountService.findOAuthSession(123456789L).orElseThrow().user().name()).isEqualTo("김서연");
	}

	@Test
	void persistsValidatedAccountThemePreferences() {
		long gitLabUserId = 246813579L;
		accountService.upsert(new GitLabOAuthSession(
			new GitLabUser(gitLabUserId, "theme-user", "Theme User", null, null),
			"access", "refresh", Instant.now().plusSeconds(3600), "api"
		));

		var updated = accountService.updatePreferences(gitLabUserId,
			new OAuthAccountService.UpdatePreferencesRequest("dark", "teal"));

		assertThat(updated.themeMode()).isEqualTo("DARK");
		assertThat(updated.accentColor()).isEqualTo("TEAL");
		assertThat(accountService.requireProfile(gitLabUserId).themeMode()).isEqualTo("DARK");
		assertThatThrownBy(() -> accountService.updatePreferences(gitLabUserId,
			new OAuthAccountService.UpdatePreferencesRequest("MIDNIGHT", "TEAL")))
			.hasMessageContaining("지원하지 않는 테마");
	}
}
