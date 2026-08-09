package com.studyworkspace.auth.security;

public interface TokenCipher {

	String encrypt(String plaintext);

	String decrypt(String ciphertext);
}
