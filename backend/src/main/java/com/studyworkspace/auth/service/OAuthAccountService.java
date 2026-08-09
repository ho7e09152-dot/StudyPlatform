package com.studyworkspace.auth.service;

import java.time.Instant;
import java.util.Optional;

import com.studyworkspace.auth.dto.GitLabOAuthSession;
import com.studyworkspace.auth.persistence.OAuthCredentialEntity;
import com.studyworkspace.auth.persistence.OAuthCredentialRepository;
import com.studyworkspace.auth.persistence.UserAccountEntity;
import com.studyworkspace.auth.persistence.UserAccountRepository;
import com.studyworkspace.auth.security.TokenCipher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import com.studyworkspace.workspace.domain.WorkspaceException;

@Service
public class OAuthAccountService {
	public static final String CURRENT_TERMS_VERSION = "2026-08-10";

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
		Instant termsAcceptedAt,
		String themeMode,
		String accentColor
	) { }

	public record UpdateProfileRequest(
		String displayName,
		String repositoryFileName,
		String timezone,
		boolean acceptTerms
	) { }

	public record UpdatePreferencesRequest(String themeMode, String accentColor) { }

	private final UserAccountRepository userRepository;
	private final OAuthCredentialRepository credentialRepository;
	private final TokenCipher tokenCipher;

	public OAuthAccountService(
		UserAccountRepository userRepository,
		OAuthCredentialRepository credentialRepository,
		TokenCipher tokenCipher
	) {
		this.userRepository = userRepository;
		this.credentialRepository = credentialRepository;
		this.tokenCipher = tokenCipher;
	}

	@Transactional
	public void upsert(GitLabOAuthSession oauth) {
		Instant now = Instant.now();
		UserAccountEntity user = userRepository.findByGitLabUserId(oauth.user().id())
			.orElseGet(() -> UserAccountEntity.create(oauth.user(), now));
		user.updateFrom(oauth.user(), now);
		userRepository.save(user);

		OAuthCredentialEntity credential = credentialRepository.findById(user.id())
			.orElseGet(() -> OAuthCredentialEntity.create(user.id()));
		credential.rotate(
			tokenCipher.encrypt(oauth.accessToken()),
			tokenCipher.encrypt(oauth.refreshToken()),
			oauth.expiresAt(),
			oauth.scope(),
			now
		);
		credentialRepository.save(credential);
	}

	@Transactional(readOnly = true)
	public AccountProfile requireProfile(long gitLabUserId) {
		return userRepository.findByGitLabUserId(gitLabUserId)
			.map(OAuthAccountService::profile)
			.orElseThrow(() -> new WorkspaceException("ACCOUNT_NOT_FOUND", "사용자 계정을 찾을 수 없습니다.", 404));
	}

	@Transactional
	public AccountProfile updateProfile(long gitLabUserId, UpdateProfileRequest request) {
		if (request == null || !request.acceptTerms()) {
			throw new WorkspaceException("TERMS_ACCEPTANCE_REQUIRED", "이용약관과 개인정보 처리 안내에 동의해 주세요.", 400);
		}
		String displayName = normalizeDisplayName(request.displayName());
		String repositoryFileName = normalizeRepositoryFileName(request.repositoryFileName(), displayName);
		String timezone = normalizeTimezone(request.timezone());
		UserAccountEntity user = userRepository.findByGitLabUserId(gitLabUserId)
			.orElseThrow(() -> new WorkspaceException("ACCOUNT_NOT_FOUND", "사용자 계정을 찾을 수 없습니다.", 404));
		user.completeProfile(displayName, repositoryFileName, timezone, CURRENT_TERMS_VERSION, Instant.now());
		return profile(userRepository.save(user));
	}

	@Transactional
	public AccountProfile updatePreferences(long gitLabUserId, UpdatePreferencesRequest request) {
		if (request == null) {
			throw new WorkspaceException("INVALID_PREFERENCES", "테마 설정이 필요합니다.", 400);
		}
		String themeMode = normalizeChoice(request.themeMode(), "LIGHT", "DARK");
		String accentColor = normalizeChoice(request.accentColor(), "PURPLE", "BLUE", "TEAL", "ORANGE", "ROSE");
		UserAccountEntity user = userRepository.findByGitLabUserId(gitLabUserId)
			.orElseThrow(() -> new WorkspaceException("ACCOUNT_NOT_FOUND", "사용자 계정을 찾을 수 없습니다.", 404));
		user.updatePreferences(themeMode, accentColor, Instant.now());
		return profile(userRepository.save(user));
	}

	@Transactional
	public void deleteCredential(long gitLabUserId) {
		userRepository.findByGitLabUserId(gitLabUserId)
			.ifPresent(user -> credentialRepository.deleteById(user.id()));
	}

	@Transactional
	public void deleteAccount(long gitLabUserId) {
		userRepository.findByGitLabUserId(gitLabUserId).ifPresent(userRepository::delete);
	}

	@Transactional(readOnly = true)
	public Optional<GitLabOAuthSession> findOAuthSession(long gitLabUserId) {
		return userRepository.findByGitLabUserId(gitLabUserId).flatMap(user ->
			credentialRepository.findById(user.id()).map(credential -> new GitLabOAuthSession(
				user.toGitLabUser(),
				tokenCipher.decrypt(credential.accessTokenCiphertext()),
				tokenCipher.decrypt(credential.refreshTokenCiphertext()),
				credential.expiresAt(),
				credential.scope()
			))
		);
	}

	private static AccountProfile profile(UserAccountEntity user) {
		return new AccountProfile(
			user.gitLabUserId(), user.username(), user.displayName(), user.avatarUrl(), user.webUrl(),
			user.profileCompleted(), user.repositoryFileName(), user.timezone(), user.termsVersion(), user.termsAcceptedAt(),
			user.themeMode(), user.accentColor()
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
