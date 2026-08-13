package com.studyworkspace.auth.service;

import java.time.Instant;

import com.studyworkspace.auth.persistence.OAuthCredentialEntity;
import com.studyworkspace.auth.persistence.OAuthCredentialRepository;
import com.studyworkspace.auth.persistence.ProviderAccountEntity;
import com.studyworkspace.auth.persistence.ProviderAccountRepository;
import com.studyworkspace.auth.persistence.UserAccountRepository;
import com.studyworkspace.auth.security.TokenCipher;
import com.studyworkspace.provider.ProviderIdentity;
import com.studyworkspace.provider.ProviderOAuthCredential;
import com.studyworkspace.workspace.domain.RepositoryProvider;
import com.studyworkspace.workspace.domain.WorkspaceException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Explicitly links a proved provider identity to an already authenticated Study-ing user. */
@Service
public class ProviderAccountLinkingService {
	private final UserAccountRepository userRepository;
	private final ProviderAccountRepository providerAccountRepository;
	private final OAuthCredentialRepository credentialRepository;
	private final TokenCipher tokenCipher;

	public ProviderAccountLinkingService(
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
	public OAuthAccountService.ProviderAccountView link(
		String authenticatedUserId,
		ProviderIdentity identity,
		ProviderOAuthCredential oauthCredential
	) {
		if (authenticatedUserId == null || !userRepository.existsById(authenticatedUserId)) {
			throw new WorkspaceException("AUTH_REQUIRED", "Study-ing 로그인이 필요합니다.", 401);
		}
		if (identity == null || identity.provider() == null || oauthCredential == null
			|| oauthCredential.accessToken() == null || oauthCredential.accessToken().isBlank()) {
			throw new WorkspaceException("PROVIDER_LINK_INVALID", "Provider 계정 연결 정보를 확인할 수 없습니다.", 400);
		}

		ProviderAccountEntity externalMatch = providerAccountRepository
			.findByProviderAndExternalUserId(identity.provider().name(), identity.externalUserId())
			.orElse(null);
		if (externalMatch != null && !authenticatedUserId.equals(externalMatch.userId())) {
			throw collision(identity.provider());
		}

		ProviderAccountEntity userProviderAccount = providerAccountRepository
			.findByUserIdAndProvider(authenticatedUserId, identity.provider().name())
			.orElse(null);
		if (userProviderAccount != null
			&& !userProviderAccount.externalUserId().equals(identity.externalUserId())) {
			throw new WorkspaceException(
				"PROVIDER_ACCOUNT_ALREADY_LINKED",
				"이미 다른 %s 계정이 연결되어 있습니다.".formatted(displayName(identity.provider())),
				409
			);
		}

		Instant now = Instant.now();
		ProviderAccountEntity account = externalMatch != null ? externalMatch : userProviderAccount;
		if (account == null) {
			account = ProviderAccountEntity.create(
				authenticatedUserId, identity.provider(), identity.externalUserId(), identity.username(),
				identity.displayName(), identity.avatarUrl(), identity.webUrl(), now
			);
		} else {
			account.updateIdentity(
				identity.provider(), identity.externalUserId(), identity.username(), identity.displayName(),
				identity.avatarUrl(), identity.webUrl(), now
			);
		}

		try {
			account = providerAccountRepository.saveAndFlush(account);
		} catch (DataIntegrityViolationException exception) {
			throw collision(identity.provider());
		}

		String providerAccountId = account.id();
		OAuthCredentialEntity credential = credentialRepository.findById(providerAccountId)
			.orElseGet(() -> OAuthCredentialEntity.create(providerAccountId, authenticatedUserId));
		credential.rotate(
			tokenCipher.encrypt(oauthCredential.accessToken()),
			oauthCredential.refreshToken() == null || oauthCredential.refreshToken().isBlank()
				? null : tokenCipher.encrypt(oauthCredential.refreshToken()),
			oauthCredential.expiresAt(),
			oauthCredential.scope(),
			now
		);
		credentialRepository.save(credential);
		return new OAuthAccountService.ProviderAccountView(
			account.id(), account.provider(), account.externalUserId(), account.username(), account.displayName(),
			account.avatarUrl(), account.webUrl(), account.status()
		);
	}

	private static WorkspaceException collision(RepositoryProvider provider) {
		return new WorkspaceException(
			"PROVIDER_ACCOUNT_COLLISION",
			"이 %s 계정은 이미 다른 Study-ing 계정에 연결되어 있습니다.".formatted(displayName(provider)),
			409
		);
	}

	private static String displayName(RepositoryProvider provider) {
		return provider == RepositoryProvider.GITHUB ? "GitHub" : "GitLab";
	}
}
