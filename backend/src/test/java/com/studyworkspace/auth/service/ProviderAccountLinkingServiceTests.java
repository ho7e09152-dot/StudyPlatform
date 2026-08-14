package com.studyworkspace.auth.service;

import static com.studyworkspace.auth.support.OAuthTestAccounts.completeGitLabRegistration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;

import com.studyworkspace.auth.dto.GitLabOAuthSession;
import com.studyworkspace.auth.security.TokenCipher;
import com.studyworkspace.gitlab.dto.GitLabUser;
import com.studyworkspace.provider.ProviderIdentity;
import com.studyworkspace.provider.ProviderOAuthCredential;
import com.studyworkspace.workspace.domain.RepositoryProvider;
import com.studyworkspace.workspace.domain.WorkspaceException;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional
class ProviderAccountLinkingServiceTests {
	@Autowired private OAuthAccountService accounts;
	@Autowired private ProviderAccountLinkingService linking;
	@Autowired private TokenCipher tokenCipher;
	@Autowired private JdbcClient jdbc;
	@Autowired private EntityManager entityManager;

	@Test
	void explicitlyLinksGitHubAndStoresOnlyEncryptedCredential() {
		String userId = createUser(91001L);

		var linked = linking.link(userId, identity("501", "octocat"), credential("plain-github-token"));
		entityManager.flush();

		assertThat(linked.provider()).isEqualTo(RepositoryProvider.GITHUB);
		assertThat(linked.externalUserId()).isEqualTo("501");
		String ciphertext = jdbc.sql("SELECT access_token_ciphertext FROM oauth_credentials WHERE provider_account_id = :id")
			.param("id", linked.id()).query(String.class).single();
		assertThat(ciphertext).doesNotContain("plain-github-token");
		assertThat(tokenCipher.decrypt(ciphertext)).isEqualTo("plain-github-token");
		assertThat(jdbc.sql("SELECT COUNT(*) FROM provider_accounts WHERE user_id = :userId")
			.param("userId", userId).query(Long.class).single()).isEqualTo(2);
	}

	@Test
	void sameExternalGitHubIdentityCannotBeLinkedToAnotherStudyIngUser() {
		String firstUser = createUser(91002L);
		String secondUser = createUser(91003L);
		linking.link(firstUser, identity("502", "shared"), credential("first-token"));

		assertThatThrownBy(() -> linking.link(secondUser, identity("502", "shared"), credential("second-token")))
			.isInstanceOf(WorkspaceException.class)
			.extracting("code").isEqualTo("PROVIDER_ACCOUNT_COLLISION");
	}

	@Test
	void reauthorizationRotatesCredentialWithoutCreatingProviderAccount() {
		String userId = createUser(91004L);
		var first = linking.link(userId, identity("503", "reauth-user"), credential("old-token"));
		var second = linking.link(userId, identity("503", "reauth-user"), credential("new-token"));
		entityManager.flush();

		assertThat(second.id()).isEqualTo(first.id());
		assertThat(jdbc.sql("SELECT COUNT(*) FROM provider_accounts WHERE provider = 'GITHUB' AND external_user_id = '503'")
			.query(Long.class).single()).isEqualTo(1);
		String ciphertext = jdbc.sql("SELECT access_token_ciphertext FROM oauth_credentials WHERE provider_account_id = :id")
			.param("id", first.id()).query(String.class).single();
		assertThat(tokenCipher.decrypt(ciphertext)).isEqualTo("new-token");
	}

	private String createUser(long gitLabUserId) {
		return completeGitLabRegistration(accounts, new GitLabOAuthSession(
			new GitLabUser(gitLabUserId, "gitlab-" + gitLabUserId, "User", null, null),
			"gitlab-access", "gitlab-refresh", Instant.now().plusSeconds(3600), "api"
		)).userId();
	}

	private static ProviderIdentity identity(String externalId, String username) {
		return new ProviderIdentity(
			RepositoryProvider.GITHUB, externalId, username, "GitHub User", "https://avatars.example/user", "https://github.com/" + username
		);
	}

	private static ProviderOAuthCredential credential(String token) {
		return new ProviderOAuthCredential(token, null, null, "read:user");
	}
}
