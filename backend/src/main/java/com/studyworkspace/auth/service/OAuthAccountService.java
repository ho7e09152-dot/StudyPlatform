package com.studyworkspace.auth.service;

import static com.studyworkspace.policy.LegalDocumentPolicy.PRIVACY_VERSION;
import static com.studyworkspace.policy.LegalDocumentPolicy.TERMS_VERSION;

import java.io.Serial;
import java.io.Serializable;
import java.time.Instant;
import java.util.Comparator;
import java.util.Optional;

import com.studyworkspace.auth.dto.GitLabOAuthSession;
import com.studyworkspace.auth.persistence.OAuthCredentialEntity;
import com.studyworkspace.auth.persistence.OAuthCredentialRepository;
import com.studyworkspace.auth.persistence.ProviderAccountEntity;
import com.studyworkspace.auth.persistence.ProviderAccountRepository;
import com.studyworkspace.auth.persistence.UserAccountEntity;
import com.studyworkspace.auth.persistence.UserAccountRepository;
import com.studyworkspace.auth.security.TokenCipher;
import com.studyworkspace.auth.security.StudyIngPrincipal;
import com.studyworkspace.provider.ProviderIdentity;
import com.studyworkspace.provider.ProviderOAuthCredential;
import com.studyworkspace.workspace.domain.RepositoryProvider;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import com.studyworkspace.workspace.domain.WorkspaceException;

@Service
public class OAuthAccountService {
	public record AccountProfile(
		long id,
		String username,
		String name,
		String avatarUrl,
		String webUrl,
		boolean profileCompleted,
		String repositoryFileName,
		String timezone,
		String termsVersion,
		Instant termsAgreedAt,
		String privacyVersion,
		Instant privacyAgreedAt,
		Instant minimumAgeConfirmedAt,
		boolean requiresReconsent,
		String themeMode,
		String accentColor,
		String userId
	) {
		public AccountProfile(
			long id, String username, String name, String avatarUrl, String webUrl,
			boolean profileCompleted, String repositoryFileName, String timezone,
			String termsVersion, Instant termsAgreedAt, String privacyVersion, Instant privacyAgreedAt,
			Instant minimumAgeConfirmedAt, boolean requiresReconsent, String themeMode, String accentColor
		) {
			this(id, username, name, avatarUrl, webUrl, profileCompleted, repositoryFileName, timezone,
				termsVersion, termsAgreedAt, privacyVersion, privacyAgreedAt, minimumAgeConfirmedAt,
				requiresReconsent, themeMode, accentColor, null);
		}
	}

	public record ProviderAccountView(
		String id,
		RepositoryProvider provider,
		String externalUserId,
		String username,
		String displayName,
		String avatarUrl,
		String webUrl,
		String status
	) { }

	/** Decrypted credential returned only to trusted backend provider adapters. */
	public record ProviderCredential(
		String providerAccountId,
		String accessToken,
		String refreshToken,
		Instant expiresAt,
		String scope
	) { }

	public record UpdateProfileRequest(
		String displayName,
		String repositoryFileName,
		String timezone,
		boolean acceptTerms,
		boolean acceptPrivacy,
		boolean confirmMinimumAge
	) { }

	public record UpdatePreferencesRequest(String themeMode, String accentColor) { }

	/**
	 * Short-lived signup proof stored in Spring Session until the user accepts the policies.
	 * Credentials are encrypted before this object leaves the service boundary.
	 */
	public record PendingRegistration(
		RepositoryProvider provider,
		String externalUserId,
		String username,
		String displayName,
		String avatarUrl,
		String webUrl,
		String accessTokenCiphertext,
		String refreshTokenCiphertext,
		Instant expiresAt,
		String scope,
		Instant createdAt
	) implements Serializable {
		@Serial private static final long serialVersionUID = 1L;

		@Override
		public String toString() {
			return "PendingRegistration[provider=%s, externalUserId=%s, username=%s, credentials=<redacted>, createdAt=%s]"
				.formatted(provider, externalUserId, username, createdAt);
		}
	}

	public record LoginResult(StudyIngPrincipal principal, PendingRegistration pendingRegistration) {
		public static LoginResult authenticated(StudyIngPrincipal principal) {
			return new LoginResult(principal, null);
		}

		public static LoginResult pending(PendingRegistration pendingRegistration) {
			return new LoginResult(null, pendingRegistration);
		}

		public boolean requiresRegistration() {
			return pendingRegistration != null;
		}
	}

	public record CompletedRegistration(StudyIngPrincipal principal, AccountProfile profile) { }
	private record ValidatedProfile(String displayName, String repositoryFileName, String timezone) { }

	private final UserAccountRepository userRepository;
	private final ProviderAccountRepository providerAccountRepository;
	private final OAuthCredentialRepository credentialRepository;
	private final TokenCipher tokenCipher;

	public OAuthAccountService(
		UserAccountRepository userRepository,
		ProviderAccountRepository providerAccountRepository,
		OAuthCredentialRepository credentialRepository,
		TokenCipher tokenCipher
	) {
		this.userRepository = userRepository;
		this.providerAccountRepository = providerAccountRepository;
		this.credentialRepository = credentialRepository;
		this.tokenCipher = tokenCipher;
	}

	@Transactional
	public LoginResult resolveGitLabLogin(GitLabOAuthSession oauth) {
		Instant now = Instant.now();
		ProviderAccountEntity providerAccount = providerAccountRepository
			.findByProviderAndExternalUserId(RepositoryProvider.GITLAB.name(), Long.toString(oauth.user().id()))
			.orElse(null);
		if (providerAccount == null) {
			UserAccountEntity legacyUser = userRepository.findByGitLabUserId(oauth.user().id()).orElse(null);
			if (legacyUser == null) {
				return LoginResult.pending(pendingRegistration(
					new ProviderIdentity(RepositoryProvider.GITLAB, Long.toString(oauth.user().id()), oauth.user().username(),
						oauth.user().name(), oauth.user().avatarUrl(), oauth.user().webUrl()),
					new ProviderOAuthCredential(oauth.accessToken(), oauth.refreshToken(), oauth.expiresAt(), oauth.scope()), now
				));
			}
			legacyUser.updateFrom(oauth.user(), now);
			UserAccountEntity user = userRepository.save(legacyUser);
			providerAccount = ProviderAccountEntity.createGitLab(user.id(), oauth.user(), now);
			providerAccount = providerAccountRepository.save(providerAccount);
			rotateCredential(providerAccount, user.id(), oauth.accessToken(), oauth.refreshToken(), oauth.expiresAt(), oauth.scope(), now);
			return LoginResult.authenticated(principal(user, providerAccount));
		}
		UserAccountEntity user = userRepository.findById(providerAccount.userId())
			.orElseThrow(() -> new WorkspaceException("ACCOUNT_NOT_FOUND", "사용자 계정을 찾을 수 없습니다.", 404));
		user.updateFrom(oauth.user(), now);
		userRepository.save(user);
		providerAccount.updateGitLab(oauth.user(), now);
		providerAccount = providerAccountRepository.save(providerAccount);
		rotateCredential(providerAccount, user.id(), oauth.accessToken(), oauth.refreshToken(), oauth.expiresAt(), oauth.scope(), now);
		return LoginResult.authenticated(principal(user, providerAccount));
	}

	@Transactional
	public StudyIngPrincipal refreshGitLabCredential(GitLabOAuthSession oauth) {
		LoginResult result = resolveGitLabLogin(oauth);
		if (result.requiresRegistration()) {
			throw new WorkspaceException("ACCOUNT_NOT_FOUND", "기존 GitLab 계정을 찾을 수 없습니다.", 404);
		}
		return result.principal();
	}

	@Transactional(readOnly = true)
	public AccountProfile requireProfile(long gitLabUserId) {
		return providerAccountRepository.findByProviderAndExternalUserId(RepositoryProvider.GITLAB.name(), Long.toString(gitLabUserId))
			.flatMap(account -> userRepository.findById(account.userId()).map(user -> profile(user, account)))
			.orElseThrow(() -> new WorkspaceException("ACCOUNT_NOT_FOUND", "사용자 계정을 찾을 수 없습니다.", 404));
	}

	@Transactional(readOnly = true)
	public AccountProfile requireProfileByUserId(String userId) {
		UserAccountEntity user = userRepository.findById(userId)
			.orElseThrow(() -> new WorkspaceException("ACCOUNT_NOT_FOUND", "사용자 계정을 찾을 수 없습니다.", 404));
		ProviderAccountEntity account = preferredProviderAccount(userId);
		return profile(user, account);
	}

	@Transactional(readOnly = true)
	public AccountProfile requireProfileByProviderAccountId(String userId, String providerAccountId) {
		UserAccountEntity user = userRepository.findById(userId)
			.orElseThrow(() -> new WorkspaceException("ACCOUNT_NOT_FOUND", "사용자 계정을 찾을 수 없습니다.", 404));
		ProviderAccountEntity account = providerAccountRepository.findById(providerAccountId)
			.filter(candidate -> candidate.userId().equals(userId))
			.orElseGet(() -> preferredProviderAccount(userId));
		return profile(user, account);
	}

	@Transactional
	public AccountProfile updateProfile(long gitLabUserId, UpdateProfileRequest request) {
		ProviderAccountEntity account = providerAccountRepository
			.findByProviderAndExternalUserId(RepositoryProvider.GITLAB.name(), Long.toString(gitLabUserId))
			.orElseThrow(() -> new WorkspaceException("ACCOUNT_NOT_FOUND", "사용자 계정을 찾을 수 없습니다.", 404));
		return updateProfileByUserId(account.userId(), request);
	}

	@Transactional
	public AccountProfile updateProfileByUserId(String userId, UpdateProfileRequest request) {
		return updateProfileByUserId(userId, null, request);
	}

	@Transactional
	public AccountProfile updateProfileByUserId(String userId, String providerAccountId, UpdateProfileRequest request) {
		if (request == null) throw new WorkspaceException("INVALID_PROFILE", "프로필 정보가 필요합니다.", 400);
		String displayName = normalizeDisplayName(request.displayName());
		String repositoryFileName = normalizeRepositoryFileName(request.repositoryFileName(), displayName);
		String timezone = normalizeTimezone(request.timezone());
		UserAccountEntity user = userRepository.findById(userId)
			.orElseThrow(() -> new WorkspaceException("ACCOUNT_NOT_FOUND", "사용자 계정을 찾을 수 없습니다.", 404));
		Instant now = Instant.now();
		if (!user.profileCompleted()) {
			if (!request.confirmMinimumAge()) {
				throw new WorkspaceException("MINIMUM_AGE_CONFIRMATION_REQUIRED", "Study-ing은 만 14세 이상부터 이용할 수 있습니다.", 400);
			}
			if (!request.acceptTerms()) {
				throw new WorkspaceException("TERMS_ACCEPTANCE_REQUIRED", "이용약관에 동의해 주세요.", 400);
			}
			if (!request.acceptPrivacy()) {
				throw new WorkspaceException("PRIVACY_ACCEPTANCE_REQUIRED", "개인정보 처리 안내에 동의해 주세요.", 400);
			}
			user.agreeToPolicies(TERMS_VERSION, PRIVACY_VERSION, now);
		}
		user.completeProfile(displayName, repositoryFileName, timezone, now);
		ProviderAccountEntity account = providerAccountId == null ? preferredProviderAccount(userId)
			: providerAccountRepository.findById(providerAccountId)
				.filter(candidate -> candidate.userId().equals(userId)).orElseGet(() -> preferredProviderAccount(userId));
		return profile(userRepository.save(user), account);
	}

	@Transactional
	public AccountProfile updatePreferences(long gitLabUserId, UpdatePreferencesRequest request) {
		ProviderAccountEntity account = providerAccountRepository
			.findByProviderAndExternalUserId(RepositoryProvider.GITLAB.name(), Long.toString(gitLabUserId))
			.orElseThrow(() -> new WorkspaceException("ACCOUNT_NOT_FOUND", "사용자 계정을 찾을 수 없습니다.", 404));
		return updatePreferencesByUserId(account.userId(), request);
	}

	@Transactional
	public AccountProfile updatePreferencesByUserId(String userId, UpdatePreferencesRequest request) {
		return updatePreferencesByUserId(userId, null, request);
	}

	@Transactional
	public AccountProfile updatePreferencesByUserId(String userId, String providerAccountId, UpdatePreferencesRequest request) {
		if (request == null) {
			throw new WorkspaceException("INVALID_PREFERENCES", "테마 설정이 필요합니다.", 400);
		}
		String themeMode = normalizeChoice(request.themeMode(), "LIGHT", "DARK");
		String accentColor = normalizeChoice(request.accentColor(), "PURPLE", "BLUE", "TEAL", "ORANGE", "ROSE");
		UserAccountEntity user = userRepository.findById(userId)
			.orElseThrow(() -> new WorkspaceException("ACCOUNT_NOT_FOUND", "사용자 계정을 찾을 수 없습니다.", 404));
		user.updatePreferences(themeMode, accentColor, Instant.now());
		ProviderAccountEntity account = providerAccountId == null ? preferredProviderAccount(userId)
			: providerAccountRepository.findById(providerAccountId)
				.filter(candidate -> candidate.userId().equals(userId)).orElseGet(() -> preferredProviderAccount(userId));
		return profile(userRepository.save(user), account);
	}

	/** Resolves a verified provider identity without persisting a new user before explicit signup consent. */
	@Transactional
	public LoginResult resolveProviderLogin(ProviderIdentity identity, ProviderOAuthCredential oauthCredential) {
		if (identity == null || identity.provider() == null || !StringUtils.hasText(identity.externalUserId())
			|| oauthCredential == null || !StringUtils.hasText(oauthCredential.accessToken())) {
			throw new WorkspaceException("PROVIDER_AUTH_INVALID", "Provider 로그인 정보를 확인할 수 없습니다.", 400);
		}
		Instant now = Instant.now();
		ProviderAccountEntity account = providerAccountRepository
			.findByProviderAndExternalUserId(identity.provider().name(), identity.externalUserId()).orElse(null);
		if (account == null) {
			return LoginResult.pending(pendingRegistration(identity, oauthCredential, now));
		}
		UserAccountEntity user = userRepository.findById(account.userId())
			.orElseThrow(() -> new WorkspaceException("ACCOUNT_NOT_FOUND", "사용자 계정을 찾을 수 없습니다.", 404));
		account.updateIdentity(identity.provider(), identity.externalUserId(), identity.username(),
			identity.displayName(), identity.avatarUrl(), identity.webUrl(), now);
		account = providerAccountRepository.save(account);
		rotateCredential(account, user.id(), oauthCredential.accessToken(), oauthCredential.refreshToken(),
			oauthCredential.expiresAt(), oauthCredential.scope(), now);
		return LoginResult.authenticated(principal(user, account));
	}

	@Transactional
	public CompletedRegistration completeRegistration(PendingRegistration pending, UpdateProfileRequest request) {
		if (pending == null) throw new WorkspaceException("REGISTRATION_SESSION_REQUIRED", "가입 정보가 만료되었습니다. 다시 로그인해 주세요.", 401);
		ValidatedProfile validated = validateInitialProfile(request);
		Instant now = Instant.now();
		ProviderAccountEntity account = providerAccountRepository
			.findByProviderAndExternalUserId(pending.provider().name(), pending.externalUserId()).orElse(null);
		UserAccountEntity user;
		if (account == null) {
			user = pending.provider() == RepositoryProvider.GITLAB
				? UserAccountEntity.create(new com.studyworkspace.gitlab.dto.GitLabUser(
					Long.parseLong(pending.externalUserId()), pending.username(), pending.displayName(), pending.avatarUrl(), pending.webUrl()), now)
				: UserAccountEntity.createFromProvider(pending.username(), pending.displayName(), now);
			user.agreeToPolicies(TERMS_VERSION, PRIVACY_VERSION, now);
			user.completeProfile(validated.displayName(), validated.repositoryFileName(), validated.timezone(), now);
			user = userRepository.save(user);
			account = pending.provider() == RepositoryProvider.GITLAB
				? ProviderAccountEntity.createGitLab(user.id(), new com.studyworkspace.gitlab.dto.GitLabUser(
					Long.parseLong(pending.externalUserId()), pending.username(), pending.displayName(), pending.avatarUrl(), pending.webUrl()), now)
				: ProviderAccountEntity.create(user.id(), pending.provider(), pending.externalUserId(), pending.username(),
					pending.displayName(), pending.avatarUrl(), pending.webUrl(), now);
			try {
				account = providerAccountRepository.saveAndFlush(account);
			} catch (DataIntegrityViolationException exception) {
				throw new WorkspaceException("PROVIDER_AUTH_CONFLICT", "이미 연결된 Provider 계정입니다. 다시 로그인해 주세요.", 409);
			}
		} else {
			user = userRepository.findById(account.userId())
				.orElseThrow(() -> new WorkspaceException("ACCOUNT_NOT_FOUND", "사용자 계정을 찾을 수 없습니다.", 404));
			if (!user.profileCompleted()) {
				user.agreeToPolicies(TERMS_VERSION, PRIVACY_VERSION, now);
				user.completeProfile(validated.displayName(), validated.repositoryFileName(), validated.timezone(), now);
				user = userRepository.save(user);
			}
		}
		persistEncryptedCredential(account, user.id(), pending.accessTokenCiphertext(), pending.refreshTokenCiphertext(),
			pending.expiresAt(), pending.scope(), now);
		return new CompletedRegistration(principal(user, account), profile(user, account));
	}

	@Transactional
	public void deleteCredential(long gitLabUserId) {
		providerAccountRepository.findByProviderAndExternalUserId(RepositoryProvider.GITLAB.name(), Long.toString(gitLabUserId))
			.ifPresent(account -> credentialRepository.deleteById(account.id()));
	}

	@Transactional
	public void deleteCredential(String userId, RepositoryProvider provider) {
		providerAccountRepository.findByUserIdAndProvider(userId, provider.name())
			.ifPresent(account -> credentialRepository.deleteById(account.id()));
	}

	@Transactional(readOnly = true)
	public Optional<GitLabOAuthSession> findOAuthSession(long gitLabUserId) {
		return providerAccountRepository.findByProviderAndExternalUserId(RepositoryProvider.GITLAB.name(), Long.toString(gitLabUserId)).flatMap(account ->
			userRepository.findById(account.userId()).flatMap(user -> credentialRepository.findById(account.id()).map(credential -> new GitLabOAuthSession(
				new com.studyworkspace.gitlab.dto.GitLabUser(Long.parseLong(account.externalUserId()), account.username(), user.displayName(), account.avatarUrl(), account.webUrl()),
				tokenCipher.decrypt(credential.accessTokenCiphertext()),
				tokenCipher.decrypt(credential.refreshTokenCiphertext()),
				credential.expiresAt(),
				credential.scope()
			)))
		);
	}

	@Transactional(readOnly = true)
	public Optional<GitLabOAuthSession> findGitLabOAuthSessionByUserId(String userId) {
		return providerAccountRepository.findByUserIdAndProvider(userId, RepositoryProvider.GITLAB.name()).flatMap(account ->
			userRepository.findById(userId).flatMap(user -> credentialRepository.findById(account.id()).map(credential -> new GitLabOAuthSession(
				new com.studyworkspace.gitlab.dto.GitLabUser(Long.parseLong(account.externalUserId()), account.username(), user.displayName(), account.avatarUrl(), account.webUrl()), tokenCipher.decrypt(credential.accessTokenCiphertext()),
				tokenCipher.decrypt(credential.refreshTokenCiphertext()), credential.expiresAt(), credential.scope()
			)))
		);
	}

	@Transactional(readOnly = true)
	public StudyIngPrincipal requirePrincipalByGitLabUserId(long gitLabUserId) {
		ProviderAccountEntity account = providerAccountRepository
			.findByProviderAndExternalUserId(RepositoryProvider.GITLAB.name(), Long.toString(gitLabUserId))
			.orElseThrow(() -> new WorkspaceException("ACCOUNT_NOT_FOUND", "사용자 계정을 찾을 수 없습니다.", 404));
		UserAccountEntity user = userRepository.findById(account.userId())
			.orElseThrow(() -> new WorkspaceException("ACCOUNT_NOT_FOUND", "사용자 계정을 찾을 수 없습니다.", 404));
		return principal(user, account);
	}

	@Transactional(readOnly = true)
	public StudyIngPrincipal requirePrincipalByProviderAccountId(String userId, String providerAccountId) {
		ProviderAccountEntity account = providerAccountRepository.findById(providerAccountId)
			.filter(candidate -> candidate.userId().equals(userId))
			.orElseThrow(() -> new WorkspaceException("ACCOUNT_NOT_FOUND", "연결 계정을 찾을 수 없습니다.", 404));
		UserAccountEntity user = userRepository.findById(userId)
			.orElseThrow(() -> new WorkspaceException("ACCOUNT_NOT_FOUND", "사용자 계정을 찾을 수 없습니다.", 404));
		return principal(user, account);
	}

	@Transactional(readOnly = true)
	public Optional<String> findProviderExternalUserId(String userId, RepositoryProvider provider) {
		return providerAccountRepository.findByUserIdAndProvider(userId, provider.name())
			.map(ProviderAccountEntity::externalUserId);
	}

	@Transactional(readOnly = true)
	public java.util.List<ProviderAccountView> listProviderAccounts(String userId) {
		return providerAccountRepository.findAllByUserIdOrderByProvider(userId).stream()
			.map(account -> new ProviderAccountView(account.id(), account.provider(), account.externalUserId(), account.username(),
				account.displayName(), account.avatarUrl(), account.webUrl(), account.status()))
			.toList();
	}

	@Transactional(readOnly = true)
	public ProviderAccountView requireProviderAccountView(String userId, RepositoryProvider provider) {
		ProviderAccountEntity account = requireProviderAccount(userId, provider);
		return new ProviderAccountView(account.id(), account.provider(), account.externalUserId(), account.username(),
			account.displayName(), account.avatarUrl(), account.webUrl(), account.status());
	}

	@Transactional(readOnly = true)
	public ProviderCredential requireProviderCredential(String userId, RepositoryProvider provider) {
		ProviderAccountEntity account = requireProviderAccount(userId, provider);
		OAuthCredentialEntity credential = credentialRepository.findById(account.id())
			.orElseThrow(() -> new WorkspaceException(
				"PROVIDER_REAUTH_REQUIRED", displayName(provider) + " 계정을 다시 승인해 주세요.", 401
			));
		return new ProviderCredential(
			account.id(),
			tokenCipher.decrypt(credential.accessTokenCiphertext()),
			credential.refreshTokenCiphertext() == null ? null : tokenCipher.decrypt(credential.refreshTokenCiphertext()),
			credential.expiresAt(),
			credential.scope()
		);
	}

	@Transactional
	public ProviderCredential rotateProviderCredential(
		String userId,
		RepositoryProvider provider,
		String accessToken,
		String refreshToken,
		Instant expiresAt,
		String scope
	) {
		ProviderAccountEntity account = requireProviderAccount(userId, provider);
		OAuthCredentialEntity credential = credentialRepository.findById(account.id())
			.orElseGet(() -> OAuthCredentialEntity.create(account.id(), userId));
		credential.rotate(
			tokenCipher.encrypt(accessToken),
			StringUtils.hasText(refreshToken) ? tokenCipher.encrypt(refreshToken) : null,
			expiresAt,
			scope,
			Instant.now()
		);
		credentialRepository.save(credential);
		return new ProviderCredential(account.id(), accessToken, refreshToken, expiresAt, scope);
	}

	private PendingRegistration pendingRegistration(
		ProviderIdentity identity,
		ProviderOAuthCredential credential,
		Instant now
	) {
		return new PendingRegistration(
			identity.provider(), identity.externalUserId(), identity.username(), identity.displayName(), identity.avatarUrl(), identity.webUrl(),
			tokenCipher.encrypt(credential.accessToken()),
			StringUtils.hasText(credential.refreshToken()) ? tokenCipher.encrypt(credential.refreshToken()) : null,
			credential.expiresAt(), credential.scope(), now
		);
	}

	private void rotateCredential(
		ProviderAccountEntity account,
		String userId,
		String accessToken,
		String refreshToken,
		Instant expiresAt,
		String scope,
		Instant now
	) {
		persistEncryptedCredential(account, userId, tokenCipher.encrypt(accessToken),
			StringUtils.hasText(refreshToken) ? tokenCipher.encrypt(refreshToken) : null, expiresAt, scope, now);
	}

	private void persistEncryptedCredential(
		ProviderAccountEntity account,
		String userId,
		String accessTokenCiphertext,
		String refreshTokenCiphertext,
		Instant expiresAt,
		String scope,
		Instant now
	) {
		OAuthCredentialEntity credential = credentialRepository.findById(account.id())
			.orElseGet(() -> OAuthCredentialEntity.create(account.id(), userId));
		credential.rotate(accessTokenCiphertext, refreshTokenCiphertext, expiresAt, scope, now);
		credentialRepository.save(credential);
	}

	private static ValidatedProfile validateInitialProfile(UpdateProfileRequest request) {
		if (request == null) throw new WorkspaceException("INVALID_PROFILE", "프로필 정보가 필요합니다.", 400);
		String displayName = normalizeDisplayName(request.displayName());
		String repositoryFileName = normalizeRepositoryFileName(request.repositoryFileName(), displayName);
		String timezone = normalizeTimezone(request.timezone());
		if (!request.confirmMinimumAge()) {
			throw new WorkspaceException("MINIMUM_AGE_CONFIRMATION_REQUIRED", "Study-ing은 만 14세 이상부터 이용할 수 있습니다.", 400);
		}
		if (!request.acceptTerms()) {
			throw new WorkspaceException("TERMS_ACCEPTANCE_REQUIRED", "이용약관에 동의해 주세요.", 400);
		}
		if (!request.acceptPrivacy()) {
			throw new WorkspaceException("PRIVACY_ACCEPTANCE_REQUIRED", "개인정보 처리 안내에 동의해 주세요.", 400);
		}
		return new ValidatedProfile(displayName, repositoryFileName, timezone);
	}

	private ProviderAccountEntity requireProviderAccount(String userId, RepositoryProvider provider) {
		return providerAccountRepository.findByUserIdAndProvider(userId, provider.name())
			.orElseThrow(() -> new WorkspaceException("PROVIDER_ACCOUNT_REQUIRED", provider.name() + " 계정 연결이 필요합니다.", 401));
	}

	private ProviderAccountEntity preferredProviderAccount(String userId) {
		return providerAccountRepository.findAllByUserIdOrderByProvider(userId).stream()
			.min(Comparator.comparingInt(account -> account.provider() == RepositoryProvider.GITLAB ? 0 : 1))
			.orElseThrow(() -> new WorkspaceException("PROVIDER_ACCOUNT_REQUIRED", "연결된 Provider 계정이 필요합니다.", 401));
	}

	private StudyIngPrincipal principal(UserAccountEntity user, ProviderAccountEntity account) {
		long membershipUserId = providerAccountRepository.findByUserIdAndProvider(user.id(), RepositoryProvider.GITLAB.name())
			.map(ProviderAccountEntity::externalUserId).map(Long::parseLong)
			.orElseGet(() -> Long.parseLong(account.externalUserId()));
		return new StudyIngPrincipal(user.id(), account.id(), account.provider(), account.externalUserId(), membershipUserId, account.username(),
			user.displayName(), account.avatarUrl(), account.webUrl());
	}

	private AccountProfile profile(UserAccountEntity user, ProviderAccountEntity account) {
		boolean requiresReconsent = !TERMS_VERSION.equals(user.termsVersion())
			|| !PRIVACY_VERSION.equals(user.privacyVersion())
			|| user.minimumAgeConfirmedAt() == null;
		long membershipUserId = providerAccountRepository.findByUserIdAndProvider(user.id(), RepositoryProvider.GITLAB.name())
			.map(ProviderAccountEntity::externalUserId).map(Long::parseLong)
			.orElseGet(() -> Long.parseLong(account.externalUserId()));
		return new AccountProfile(
			membershipUserId, account.username(), user.displayName(), account.avatarUrl(), account.webUrl(),
			user.profileCompleted(), user.repositoryFileName(), user.timezone(), user.termsVersion(), user.termsAgreedAt(),
			user.privacyVersion(), user.privacyAgreedAt(), user.minimumAgeConfirmedAt(), requiresReconsent,
			user.themeMode(), user.accentColor(), user.id()
		);
	}

	private static String normalizeChoice(String value, String... allowed) {
		String normalized = value == null ? "" : value.trim().toUpperCase(java.util.Locale.ROOT);
		for (String candidate : allowed) {
			if (candidate.equals(normalized)) return normalized;
		}
		throw new WorkspaceException("INVALID_PREFERENCES", "지원하지 않는 테마 설정입니다.", 400);
	}

	private static String normalizeDisplayName(String value) {
		String normalized = value == null ? "" : value.trim().replaceAll("\\s+", " ");
		if (normalized.length() < 2 || normalized.length() > 40 || normalized.chars().anyMatch(Character::isISOControl)) {
			throw new WorkspaceException("INVALID_PROFILE_NAME", "이름은 제어 문자 없이 2자 이상 40자 이하로 입력해 주세요.", 400);
		}
		return normalized;
	}

	private static String normalizeRepositoryFileName(String value, String fallback) {
		String source = StringUtils.hasText(value) ? value.trim() : fallback;
		if (!StringUtils.hasText(source)) {
			throw new WorkspaceException("INVALID_REPOSITORY_FILE_NAME", "학습 기록 이름이 필요합니다.", 400);
		}
		if (source.toLowerCase().endsWith(".md")) source = source.substring(0, source.length() - 3);
		try {
			return com.studyworkspace.workspace.service.RepositoryStorageLayoutPolicy.validateSegment(source, "학습 기록 이름") + ".md";
		} catch (WorkspaceException exception) {
			throw new WorkspaceException("INVALID_REPOSITORY_FILE_NAME", "학습 기록 이름에 사용할 수 없는 문자가 포함되어 있습니다.", 400);
		}
	}

	private static String normalizeTimezone(String value) {
		String timezone = StringUtils.hasText(value) ? value.trim() : "Asia/Seoul";
		try {
			java.time.ZoneId.of(timezone);
			return timezone;
		} catch (java.time.DateTimeException exception) {
			throw new WorkspaceException("INVALID_TIMEZONE", "올바른 시간대를 선택해 주세요.", 400);
		}
	}

	private static String displayName(RepositoryProvider provider) {
		return provider == RepositoryProvider.GITHUB ? "GitHub" : "GitLab";
	}
}
