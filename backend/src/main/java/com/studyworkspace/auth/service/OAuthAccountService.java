package com.studyworkspace.auth.service;

import static com.studyworkspace.policy.LegalDocumentPolicy.PRIVACY_VERSION;
import static com.studyworkspace.policy.LegalDocumentPolicy.TERMS_VERSION;

import java.time.Instant;
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
import com.studyworkspace.workspace.domain.RepositoryProvider;
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

	public record UpdateProfileRequest(
		String displayName,
		String repositoryFileName,
		String timezone,
		boolean acceptTerms,
		boolean acceptPrivacy,
		boolean confirmMinimumAge
	) { }

	public record UpdatePreferencesRequest(String themeMode, String accentColor) { }

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
	public StudyIngPrincipal upsert(GitLabOAuthSession oauth) {
		Instant now = Instant.now();
		ProviderAccountEntity providerAccount = providerAccountRepository
			.findByProviderAndExternalUserId(RepositoryProvider.GITLAB.name(), Long.toString(oauth.user().id()))
			.orElse(null);
		UserAccountEntity user;
		if (providerAccount == null) {
			user = userRepository.findByGitLabUserId(oauth.user().id())
				.orElseGet(() -> UserAccountEntity.create(oauth.user(), now));
			user.updateFrom(oauth.user(), now);
			user = userRepository.save(user);
			providerAccount = ProviderAccountEntity.createGitLab(user.id(), oauth.user(), now);
		} else {
			user = userRepository.findById(providerAccount.userId())
				.orElseThrow(() -> new WorkspaceException("ACCOUNT_NOT_FOUND", "사용자 계정을 찾을 수 없습니다.", 404));
			user.updateFrom(oauth.user(), now);
			userRepository.save(user);
			providerAccount.updateGitLab(oauth.user(), now);
		}
		providerAccount = providerAccountRepository.save(providerAccount);

		String providerAccountId = providerAccount.id();
		OAuthCredentialEntity credential = credentialRepository.findById(providerAccountId)
			.orElseGet(() -> OAuthCredentialEntity.create(providerAccountId));
		credential.rotate(
			tokenCipher.encrypt(oauth.accessToken()),
			tokenCipher.encrypt(oauth.refreshToken()),
			oauth.expiresAt(),
			oauth.scope(),
			now
		);
		credentialRepository.save(credential);
		return principal(user, providerAccount);
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
		ProviderAccountEntity account = requireProviderAccount(userId, RepositoryProvider.GITLAB);
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
		return profile(userRepository.save(user), requireProviderAccount(userId, RepositoryProvider.GITLAB));
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
		if (request == null) {
			throw new WorkspaceException("INVALID_PREFERENCES", "테마 설정이 필요합니다.", 400);
		}
		String themeMode = normalizeChoice(request.themeMode(), "LIGHT", "DARK");
		String accentColor = normalizeChoice(request.accentColor(), "PURPLE", "BLUE", "TEAL", "ORANGE", "ROSE");
		UserAccountEntity user = userRepository.findById(userId)
			.orElseThrow(() -> new WorkspaceException("ACCOUNT_NOT_FOUND", "사용자 계정을 찾을 수 없습니다.", 404));
		user.updatePreferences(themeMode, accentColor, Instant.now());
		return profile(userRepository.save(user), requireProviderAccount(userId, RepositoryProvider.GITLAB));
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

	private ProviderAccountEntity requireProviderAccount(String userId, RepositoryProvider provider) {
		return providerAccountRepository.findByUserIdAndProvider(userId, provider.name())
			.orElseThrow(() -> new WorkspaceException("PROVIDER_ACCOUNT_REQUIRED", provider.name() + " 계정 연결이 필요합니다.", 401));
	}

	private static StudyIngPrincipal principal(UserAccountEntity user, ProviderAccountEntity account) {
		return new StudyIngPrincipal(user.id(), account.id(), account.provider(), account.externalUserId(), account.username(),
			user.displayName(), account.avatarUrl(), account.webUrl());
	}

	private static AccountProfile profile(UserAccountEntity user, ProviderAccountEntity account) {
		boolean requiresReconsent = !TERMS_VERSION.equals(user.termsVersion())
			|| !PRIVACY_VERSION.equals(user.privacyVersion())
			|| user.minimumAgeConfirmedAt() == null;
		return new AccountProfile(
			Long.parseLong(account.externalUserId()), account.username(), user.displayName(), account.avatarUrl(), account.webUrl(),
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
		source = java.text.Normalizer.normalize(source, java.text.Normalizer.Form.NFKC);
		if (source.toLowerCase().endsWith(".md")) source = source.substring(0, source.length() - 3);
		String normalized = source.replaceAll("[\\s/\\\\]+", "-")
			.replaceAll("[^\\p{L}\\p{N}._-]", "-")
			.replaceAll("-+", "-")
			.replaceAll("^[.-]+|[.-]+$", "");
		if (!StringUtils.hasText(normalized) || normalized.length() > 80 || normalized.equals(".") || normalized.equals("..")) {
			throw new WorkspaceException("INVALID_REPOSITORY_FILE_NAME", "GitLab 기록 이름은 문자와 숫자를 사용해 80자 이하로 입력해 주세요.", 400);
		}
		return normalized + ".md";
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
}
