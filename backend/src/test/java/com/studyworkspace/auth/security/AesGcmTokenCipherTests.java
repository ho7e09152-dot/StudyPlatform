package com.studyworkspace.auth.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.studyworkspace.auth.config.TokenEncryptionProperties;
import org.junit.jupiter.api.Test;

class AesGcmTokenCipherTests {

	private final AesGcmTokenCipher cipher = new AesGcmTokenCipher(
		new TokenEncryptionProperties("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")
	);

	@Test
	void encryptsWithRandomNonceAndDecryptsWithoutStoringPlaintext() {
		String first = cipher.encrypt("oauth-access-token");
		String second = cipher.encrypt("oauth-access-token");

		assertThat(first).isNotEqualTo(second).doesNotContain("oauth-access-token");
		assertThat(cipher.decrypt(first)).isEqualTo("oauth-access-token");
		assertThat(cipher.decrypt(second)).isEqualTo("oauth-access-token");
	}

	@Test
	void rejectsInvalidKeyMaterial() {
		assertThatThrownBy(() -> new AesGcmTokenCipher(new TokenEncryptionProperties("not-a-valid-key")))
			.isInstanceOf(IllegalStateException.class)
			.hasMessageContaining("32바이트");
	}
}
