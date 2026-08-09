package com.studyworkspace.auth.security;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

import com.studyworkspace.auth.config.TokenEncryptionProperties;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class AesGcmTokenCipher implements TokenCipher {

	private static final int NONCE_LENGTH = 12;
	private static final int TAG_LENGTH_BITS = 128;
	private final SecretKeySpec key;
	private final SecureRandom secureRandom = new SecureRandom();

	public AesGcmTokenCipher(TokenEncryptionProperties properties) {
		try {
			byte[] decoded = Base64.getDecoder().decode(properties.tokenEncryptionKey());
			if (decoded.length != 32) throw new IllegalArgumentException("key length");
			this.key = new SecretKeySpec(decoded, "AES");
		} catch (RuntimeException exception) {
			throw new IllegalStateException("OAUTH_TOKEN_ENCRYPTION_KEY는 Base64로 인코딩한 32바이트 키여야 합니다.", exception);
		}
	}

	@Override
	public String encrypt(String plaintext) {
		if (!StringUtils.hasText(plaintext)) return "";
		try {
			byte[] nonce = new byte[NONCE_LENGTH];
			secureRandom.nextBytes(nonce);
			Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
			cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_LENGTH_BITS, nonce));
			byte[] encrypted = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
			return Base64.getEncoder().encodeToString(
				ByteBuffer.allocate(nonce.length + encrypted.length).put(nonce).put(encrypted).array()
			);
		} catch (GeneralSecurityException exception) {
			throw new IllegalStateException("OAuth token을 암호화하지 못했습니다.", exception);
		}
	}

	@Override
	public String decrypt(String ciphertext) {
		if (!StringUtils.hasText(ciphertext)) return "";
		try {
			byte[] payload = Base64.getDecoder().decode(ciphertext);
			if (payload.length <= NONCE_LENGTH) throw new GeneralSecurityException("invalid payload");
			ByteBuffer buffer = ByteBuffer.wrap(payload);
			byte[] nonce = new byte[NONCE_LENGTH];
			buffer.get(nonce);
			byte[] encrypted = new byte[buffer.remaining()];
			buffer.get(encrypted);
			Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
			cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_LENGTH_BITS, nonce));
			return new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
		} catch (GeneralSecurityException | IllegalArgumentException exception) {
			throw new IllegalStateException("저장된 OAuth token을 복호화하지 못했습니다.", exception);
		}
	}
}
