package com.studyworkspace.auth.persistence;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "oauth_credentials")
public class OAuthCredentialEntity {

	@Id
	@Column(name = "user_id", length = 36)
	private String userId;

	@Column(name = "access_token_ciphertext", nullable = false, length = 8192)
	private String accessTokenCiphertext;

	@Column(name = "refresh_token_ciphertext", length = 8192)
	private String refreshTokenCiphertext;

	@Column(name = "expires_at", nullable = false)
	private Instant expiresAt;

	@Column(length = 1000)
	private String scope;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	protected OAuthCredentialEntity() {
	}

	public static OAuthCredentialEntity create(String userId) {
		OAuthCredentialEntity entity = new OAuthCredentialEntity();
		entity.userId = userId;
		return entity;
	}

	public void rotate(String accessToken, String refreshToken, Instant expiresAt, String scope, Instant now) {
		this.accessTokenCiphertext = accessToken;
		this.refreshTokenCiphertext = refreshToken;
		this.expiresAt = expiresAt;
		this.scope = scope;
		this.updatedAt = now;
	}

	public String accessTokenCiphertext() {
		return accessTokenCiphertext;
	}

	public String refreshTokenCiphertext() {
		return refreshTokenCiphertext;
	}

	public Instant expiresAt() {
		return expiresAt;
	}

	public String scope() {
		return scope;
	}
}
