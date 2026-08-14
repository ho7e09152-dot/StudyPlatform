package com.studyworkspace.github.config;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.interfaces.RSAPrivateKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.util.Base64;

import org.springframework.stereotype.Component;

/** Loads GitHub's PEM private key from a server-side secret file. */
@Component
public class GitHubAppPrivateKeyLoader {
	private static final long MAX_PEM_BYTES = 64 * 1024;
	private static final byte[] RSA_ALGORITHM_IDENTIFIER = new byte[] {
		0x30, 0x0d, 0x06, 0x09, 0x2a, (byte) 0x86, 0x48, (byte) 0x86,
		(byte) 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00
	};

	private final GitHubAppProperties properties;

	public GitHubAppPrivateKeyLoader(GitHubAppProperties properties) {
		this.properties = properties;
	}

	public RSAPrivateKey load() {
		if (properties.privateKeyPath().isBlank()) {
			throw configurationError("GitHub App private key path is not configured.");
		}
		try {
			Path path = Path.of(properties.privateKeyPath()).toAbsolutePath().normalize();
			if (!Files.isRegularFile(path) || !Files.isReadable(path) || Files.size(path) > MAX_PEM_BYTES) {
				throw configurationError("GitHub App private key file is missing, unreadable, or too large.");
			}
			String pem = Files.readString(path, StandardCharsets.US_ASCII);
			byte[] der = decodePem(pem);
			PrivateKey key = KeyFactory.getInstance("RSA").generatePrivate(new PKCS8EncodedKeySpec(der));
			if (!(key instanceof RSAPrivateKey rsaKey)) {
				throw configurationError("GitHub App private key is not an RSA key.");
			}
			return rsaKey;
		} catch (GitHubAppConfigurationException exception) {
			throw exception;
		} catch (IOException | RuntimeException | java.security.GeneralSecurityException exception) {
			throw configurationError("GitHub App private key is unreadable or malformed.");
		}
	}

	private static byte[] decodePem(String pem) {
		if (pem.contains("-----BEGIN ENCRYPTED PRIVATE KEY-----")) {
			throw configurationError("Encrypted GitHub App private keys are not supported by file-path loading.");
		}
		if (pem.contains("-----BEGIN PRIVATE KEY-----")) {
			return decodeBody(pem, "PRIVATE KEY");
		}
		if (pem.contains("-----BEGIN RSA PRIVATE KEY-----")) {
			return wrapPkcs1AsPkcs8(decodeBody(pem, "RSA PRIVATE KEY"));
		}
		throw configurationError("GitHub App private key PEM header is not supported.");
	}

	private static byte[] decodeBody(String pem, String label) {
		String body = pem
			.replace("-----BEGIN " + label + "-----", "")
			.replace("-----END " + label + "-----", "")
			.replaceAll("\\s", "");
		try {
			return Base64.getDecoder().decode(body);
		} catch (IllegalArgumentException exception) {
			throw configurationError("GitHub App private key PEM body is malformed.");
		}
	}

	private static byte[] wrapPkcs1AsPkcs8(byte[] pkcs1) {
		byte[] version = new byte[] {0x02, 0x01, 0x00};
		byte[] privateKey = tagged((byte) 0x04, pkcs1);
		return tagged((byte) 0x30, concatenate(version, RSA_ALGORITHM_IDENTIFIER, privateKey));
	}

	private static byte[] tagged(byte tag, byte[] value) {
		ByteArrayOutputStream output = new ByteArrayOutputStream(value.length + 5);
		output.write(tag);
		writeLength(output, value.length);
		output.writeBytes(value);
		return output.toByteArray();
	}

	private static void writeLength(ByteArrayOutputStream output, int length) {
		if (length < 128) {
			output.write(length);
			return;
		}
		int bytes = 0;
		for (int value = length; value > 0; value >>>= 8) bytes++;
		output.write(0x80 | bytes);
		for (int shift = (bytes - 1) * 8; shift >= 0; shift -= 8) output.write((length >>> shift) & 0xff);
	}

	private static byte[] concatenate(byte[]... values) {
		ByteArrayOutputStream output = new ByteArrayOutputStream();
		for (byte[] value : values) output.writeBytes(value);
		return output.toByteArray();
	}

	private static GitHubAppConfigurationException configurationError(String message) {
		return new GitHubAppConfigurationException(message);
	}
}
