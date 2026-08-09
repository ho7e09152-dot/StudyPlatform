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

@Service
public class OAuthAccountService {

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
}
