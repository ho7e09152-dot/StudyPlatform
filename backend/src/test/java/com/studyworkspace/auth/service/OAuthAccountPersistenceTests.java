package com.studyworkspace.auth.service;

import static org.assertj.core.api.Assertions.assertThat;

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
}
