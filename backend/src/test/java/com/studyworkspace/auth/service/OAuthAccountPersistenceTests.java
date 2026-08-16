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
	void newOAuthIdentityLeavesNoAccountRowsUntilConsentThenStoresOnlyEncryptedTokens() {
		var login = accountService.resolveGitLabLogin(new GitLabOAuthSession(
			new GitLabUser(987654321L, "persisted-user", "Persisted User", null, "https://gitlab.example/persisted-user"),
			"plain-access-token",
			"plain-refresh-token",
			Instant.now().plusSeconds(7200),
			"api"
		));
		entityManager.flush();
		assertThat(login.requiresRegistration()).isTrue();
		assertThat(jdbcClient.sql("SELECT COUNT(*) FROM user_accounts").query(Long.class).single()).isZero();
		assertThat(jdbcClient.sql("SELECT COUNT(*) FROM provider_accounts").query(Long.class).single()).isZero();
		assertThat(jdbcClient.sql("SELECT COUNT(*) FROM oauth_credentials").query(Long.class).single()).isZero();
		assertThat(login.pendingRegistration().accessTokenCiphertext()).doesNotContain("plain-access-token");
		assertThat(login.pendingRegistration().toString()).doesNotContain("plain-access-token", "plain-refresh-token");

		accountService.completeRegistration(login.pendingRegistration(), new OAuthAccountService.UpdateProfileRequest(
			"가입 사용자", "persisted-user", "Asia/Seoul", true, true, true
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
		var pending = accountService.resolveGitLabLogin(first).pendingRegistration();
		var profile = accountService.completeRegistration(pending, new OAuthAccountService.UpdateProfileRequest(
			"김서연", "서연-학습", "Asia/Seoul", true, true, true
		)).profile();
		assertThat(profile.profileCompleted()).isTrue();
		assertThat(profile.repositoryFileName()).isEqualTo("서연-학습.md");

		accountService.resolveGitLabLogin(new GitLabOAuthSession(
			new GitLabUser(123456789L, "gitlab-id", "Changed GitLab Name", null, null),
			"access-2", "refresh-2", Instant.now().plusSeconds(7200), "api"
		));

		assertThat(accountService.requireProfile(123456789L).name()).isEqualTo("김서연");
		assertThat(accountService.findOAuthSession(123456789L).orElseThrow().user().name()).isEqualTo("김서연");
	}

	@Test
	void storesIndependentConsentOnceAndProfileEditsDoNotOverwriteAgreementTime() {
		long gitLabUserId = 314159265L;
		var pending = accountService.resolveGitLabLogin(new GitLabOAuthSession(
			new GitLabUser(gitLabUserId, "consent-user", "Consent User", null, null),
			"access", "refresh", Instant.now().plusSeconds(3600), "api"
		)).pendingRegistration();

		var first = accountService.completeRegistration(pending, new OAuthAccountService.UpdateProfileRequest(
			"동의 사용자", "consent-user", "Asia/Seoul", true, true, true
		)).profile();
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
		var pending = accountService.resolveGitLabLogin(new GitLabOAuthSession(
			new GitLabUser(gitLabUserId, "policy-user", "Policy User", null, null),
			"access", "refresh", Instant.now().plusSeconds(3600), "api"
		)).pendingRegistration();

		assertThatThrownBy(() -> accountService.completeRegistration(pending,
			new OAuthAccountService.UpdateProfileRequest("정책 사용자", "policy-user", "Asia/Seoul", true, true, false)))
			.hasMessageContaining("만 14세 이상");
		assertThatThrownBy(() -> accountService.completeRegistration(pending,
			new OAuthAccountService.UpdateProfileRequest("정책 사용자", "policy-user", "Asia/Seoul", false, true, true)))
			.hasMessageContaining("이용약관");
		assertThatThrownBy(() -> accountService.completeRegistration(pending,
			new OAuthAccountService.UpdateProfileRequest("정책 사용자", "policy-user", "Asia/Seoul", true, false, true)))
			.hasMessageContaining("개인정보");
		assertThat(jdbcClient.sql("SELECT COUNT(*) FROM user_accounts WHERE gitlab_user_id = :id")
			.param("id", gitLabUserId).query(Long.class).single()).isZero();
	}

	@Test
	void registrationRejectsUnicodeFormatCharactersInRepositoryRecordNameWithoutCreatingAccount() {
		long gitLabUserId = 271828183L;
		var pending = accountService.resolveGitLabLogin(new GitLabOAuthSession(
			new GitLabUser(gitLabUserId, "format-character-user", "Format Character User", null, null),
			"access", "refresh", Instant.now().plusSeconds(3600), "api"
		)).pendingRegistration();

		assertThatThrownBy(() -> accountService.completeRegistration(pending,
			new OAuthAccountService.UpdateProfileRequest("정상 표시 이름", "김\u202E서연", "Asia/Seoul", true, true, true)))
			.hasMessageContaining("사용할 수 없는 문자");
		assertThat(jdbcClient.sql("SELECT COUNT(*) FROM user_accounts WHERE gitlab_user_id = :id")
			.param("id", gitLabUserId).query(Long.class).single()).isZero();
	}

	@Test
	void reportsReconsentWhenAnAcceptedDocumentVersionIsOutdated() {
		long gitLabUserId = 161803398L;
		completeGitLabRegistration(accountService, new GitLabOAuthSession(
			new GitLabUser(gitLabUserId, "reconsent-user", "Reconsent User", null, null),
			"access", "refresh", Instant.now().plusSeconds(3600), "api"
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
		completeGitLabRegistration(accountService, new GitLabOAuthSession(
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
		var pending = accountService.resolveProviderLogin(identity,
			new ProviderOAuthCredential("github-token-1", "github-refresh-1", Instant.now().plusSeconds(3600), ""));
		var first = accountService.completeRegistration(pending.pendingRegistration(),
			new OAuthAccountService.UpdateProfileRequest("Octo Study", "octostudy", "Asia/Seoul", true, true, true)).principal();
		var second = accountService.resolveProviderLogin(identity,
			new ProviderOAuthCredential("github-token-2", "github-refresh-2", Instant.now().plusSeconds(7200), "")).principal();
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
		var gitLabPrincipal = completeGitLabRegistration(accountService, new GitLabOAuthSession(
			new GitLabUser(gitLabUserId, "linked-gitlab", "Linked User", null, null),
			"gitlab-token", "gitlab-refresh", Instant.now().plusSeconds(3600), "api"
		));
		ProviderIdentity github = new ProviderIdentity(
			RepositoryProvider.GITHUB, "838383", "linked-github", "Linked User", null, "https://github.com/linked-github"
		);
		linkingService.link(gitLabPrincipal.userId(), github,
			new ProviderOAuthCredential("github-token", "github-refresh", Instant.now().plusSeconds(3600), ""));

		var githubPrincipal = accountService.resolveProviderLogin(github,
			new ProviderOAuthCredential("github-token-2", "github-refresh-2", Instant.now().plusSeconds(7200), "")).principal();

		assertThat(githubPrincipal.userId()).isEqualTo(gitLabPrincipal.userId());
		assertThat(githubPrincipal.provider()).isEqualTo(RepositoryProvider.GITHUB);
		assertThat(githubPrincipal.id()).isEqualTo(gitLabUserId);
		assertThat(accountService.listProviderAccounts(gitLabPrincipal.userId())).hasSize(2);
	}
}
