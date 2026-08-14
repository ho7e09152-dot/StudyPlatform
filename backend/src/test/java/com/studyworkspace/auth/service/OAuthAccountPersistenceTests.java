package com.studyworkspace.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;

import com.studyworkspace.auth.dto.GitLabOAuthSession;
import com.studyworkspace.auth.security.TokenCipher;
import com.studyworkspace.gitlab.dto.GitLabUser;
import com.studyworkspace.provider.ProviderIdentity;
import com.studyworkspace.provider.ProviderOAuthCredential;
import com.studyworkspace.workspace.domain.RepositoryProvider;
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
	private ProviderAccountLinkingService linkingService;

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
			"김서연", "서연-학습", "Asia/Seoul", true, true, true
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
	void storesIndependentConsentOnceAndProfileEditsDoNotOverwriteAgreementTime() {
		long gitLabUserId = 314159265L;
		accountService.upsert(new GitLabOAuthSession(
			new GitLabUser(gitLabUserId, "consent-user", "Consent User", null, null),
			"access", "refresh", Instant.now().plusSeconds(3600), "api"
		));

		var first = accountService.updateProfile(gitLabUserId, new OAuthAccountService.UpdateProfileRequest(
			"동의 사용자", "consent-user", "Asia/Seoul", true, true, true
		));
		assertThat(first.termsVersion()).isEqualTo("2026-08-13");
		assertThat(first.privacyVersion()).isEqualTo("2026-08-13");
		assertThat(first.termsAgreedAt()).isNotNull();
		assertThat(first.privacyAgreedAt()).isNotNull();
		assertThat(first.minimumAgeConfirmedAt()).isNotNull();
		assertThat(first.requiresReconsent()).isFalse();

		var edited = accountService.updateProfile(gitLabUserId, new OAuthAccountService.UpdateProfileRequest(
			"수정된 이름", "consent-user", "Asia/Seoul", false, false, false
		));
		assertThat(edited.termsAgreedAt()).isEqualTo(first.termsAgreedAt());
		assertThat(edited.privacyAgreedAt()).isEqualTo(first.privacyAgreedAt());
		assertThat(edited.minimumAgeConfirmedAt()).isEqualTo(first.minimumAgeConfirmedAt());
	}

	@Test
	void initialProfileRequiresAgeTermsAndPrivacySeparately() {
		long gitLabUserId = 271828182L;
		accountService.upsert(new GitLabOAuthSession(
			new GitLabUser(gitLabUserId, "policy-user", "Policy User", null, null),
			"access", "refresh", Instant.now().plusSeconds(3600), "api"
		));

		assertThatThrownBy(() -> accountService.updateProfile(gitLabUserId,
			new OAuthAccountService.UpdateProfileRequest("정책 사용자", "policy-user", "Asia/Seoul", true, true, false)))
			.hasMessageContaining("만 14세 이상");
		assertThatThrownBy(() -> accountService.updateProfile(gitLabUserId,
			new OAuthAccountService.UpdateProfileRequest("정책 사용자", "policy-user", "Asia/Seoul", false, true, true)))
			.hasMessageContaining("이용약관");
		assertThatThrownBy(() -> accountService.updateProfile(gitLabUserId,
			new OAuthAccountService.UpdateProfileRequest("정책 사용자", "policy-user", "Asia/Seoul", true, false, true)))
			.hasMessageContaining("개인정보");
	}

	@Test
	void reportsReconsentWhenAnAcceptedDocumentVersionIsOutdated() {
		long gitLabUserId = 161803398L;
		accountService.upsert(new GitLabOAuthSession(
			new GitLabUser(gitLabUserId, "reconsent-user", "Reconsent User", null, null),
			"access", "refresh", Instant.now().plusSeconds(3600), "api"
		));
		accountService.updateProfile(gitLabUserId, new OAuthAccountService.UpdateProfileRequest(
			"재동의 사용자", "reconsent-user", "Asia/Seoul", true, true, true
		));
		entityManager.flush();
		jdbcClient.sql("UPDATE user_accounts SET privacy_version = 'old-version' WHERE gitlab_user_id = :id")
			.param("id", gitLabUserId).update();
		entityManager.clear();

		assertThat(accountService.requireProfile(gitLabUserId).requiresReconsent()).isTrue();
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

	@Test
	void githubLoginCreatesOneStableUserAndRotatesOnlyItsEncryptedCredential() {
		ProviderIdentity identity = new ProviderIdentity(
			RepositoryProvider.GITHUB, "424242", "octostudy", "Octo Study", "https://avatars.example/42", "https://github.com/octostudy"
		);
		var first = accountService.authenticate(identity,
			new ProviderOAuthCredential("github-token-1", "github-refresh-1", Instant.now().plusSeconds(3600), ""));
		var second = accountService.authenticate(identity,
			new ProviderOAuthCredential("github-token-2", "github-refresh-2", Instant.now().plusSeconds(7200), ""));
		entityManager.flush();

		assertThat(second.userId()).isEqualTo(first.userId());
		assertThat(second.providerAccountId()).isEqualTo(first.providerAccountId());
		assertThat(second.provider()).isEqualTo(RepositoryProvider.GITHUB);
		assertThat(second.id()).isEqualTo(424242L);
		assertThat(jdbcClient.sql("SELECT COUNT(*) FROM provider_accounts WHERE provider = 'GITHUB' AND external_user_id = '424242'")
			.query(Long.class).single()).isEqualTo(1);
		var credential = accountService.requireProviderCredential(first.userId(), RepositoryProvider.GITHUB);
		assertThat(credential.accessToken()).isEqualTo("github-token-2");
		assertThat(jdbcClient.sql("SELECT access_token_ciphertext FROM oauth_credentials WHERE provider_account_id = :id")
			.param("id", first.providerAccountId()).query(String.class).single()).doesNotContain("github-token-2");
		assertThat(accountService.requireProfileByProviderAccountId(first.userId(), first.providerAccountId()).username())
			.isEqualTo("octostudy");
	}

	@Test
	void githubLoginForAnExplicitlyLinkedIdentityReusesTheGitLabStudyIngAccount() {
		long gitLabUserId = 737373L;
		var gitLabPrincipal = accountService.upsert(new GitLabOAuthSession(
			new GitLabUser(gitLabUserId, "linked-gitlab", "Linked User", null, null),
			"gitlab-token", "gitlab-refresh", Instant.now().plusSeconds(3600), "api"
		));
		ProviderIdentity github = new ProviderIdentity(
			RepositoryProvider.GITHUB, "838383", "linked-github", "Linked User", null, "https://github.com/linked-github"
		);
		linkingService.link(gitLabPrincipal.userId(), github,
			new ProviderOAuthCredential("github-token", "github-refresh", Instant.now().plusSeconds(3600), ""));

		var githubPrincipal = accountService.authenticate(github,
			new ProviderOAuthCredential("github-token-2", "github-refresh-2", Instant.now().plusSeconds(7200), ""));

		assertThat(githubPrincipal.userId()).isEqualTo(gitLabPrincipal.userId());
		assertThat(githubPrincipal.provider()).isEqualTo(RepositoryProvider.GITHUB);
		assertThat(githubPrincipal.id()).isEqualTo(gitLabUserId);
		assertThat(accountService.listProviderAccounts(gitLabPrincipal.userId())).hasSize(2);
	}
}
