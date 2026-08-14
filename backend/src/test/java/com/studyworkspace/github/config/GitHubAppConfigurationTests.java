package com.studyworkspace.github.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatNoException;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.charset.StandardCharsets;
import java.io.ByteArrayOutputStream;
import java.math.BigInteger;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPrivateCrtKey;
import java.time.Duration;
import java.util.Base64;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;

class GitHubAppConfigurationTests {
	@TempDir Path tempDir;

	private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
		.withUserConfiguration(PropertiesConfiguration.class);

	@Test
	void canonicalGitHubAppPropertiesBindWithoutLegacyNames() {
		contextRunner.withPropertyValues(
			"github.app.id=123456",
			"github.app.slug=study-ing",
			"github.app.client-id=Iv1.client",
			"github.app.client-secret=secret",
			"github.app.redirect-uri=https://sandbox.withroro.com/api/v1/provider-accounts/github/callback",
			"github.app.private-key-path=/run/secrets/study-ing-github-app.pem",
			"github.app.features.account-linking=true",
			"github.app.features.login=false",
			"github.app.features.repository=false"
		).run(context -> {
			GitHubAppProperties properties = context.getBean(GitHubAppProperties.class);
			assertThat(properties.accountLinkingReady()).isTrue();
			assertThat(properties.features().login()).isFalse();
			assertThat(properties.features().repository()).isFalse();
			assertThat(properties.toString()).doesNotContain("secret", "Iv1.client", "/run/secrets");
		});
	}

	@Test
	void disabledFeaturesNeedNoGitHubCredentials() {
		GitHubAppProperties properties = properties(false, false, false, "", "", "", "");
		GitHubAppConfigurationValidator validator = validator(properties);

		assertThatNoException().isThrownBy(validator::validate);
		assertThat(properties.accountLinkingReady()).isFalse();
		assertThat(validator.repositoryAuthenticationReady()).isFalse();
	}

	@Test
	void incompleteAccountLinkingConfigurationStaysUnavailableWithoutFailingStartup() {
		GitHubAppProperties properties = properties(true, false, false, "client", "", "https://example/callback", "");
		GitHubAppConfigurationValidator validator = validator(properties);

		assertThatNoException().isThrownBy(validator::validate);
		assertThat(properties.accountLinkingReady()).isFalse();
	}

	@Test
	void repositoryDisabledDoesNotReadThePrivateKey() {
		GitHubAppProperties properties = properties(false, false, false, "", "", "", "/missing/private-key.pem");
		assertThatNoException().isThrownBy(validator(properties)::validate);
	}

	@Test
	void repositoryFoundationAcceptsAValidPkcs8Pem() throws Exception {
		Path pem = writeRsaPrivateKey("valid.pem");
		GitHubAppProperties properties = properties(false, false, true, "", "", "", pem.toString());
		GitHubAppPrivateKeyLoader loader = new GitHubAppPrivateKeyLoader(properties);
		GitHubAppConfigurationValidator validator = new GitHubAppConfigurationValidator(properties, loader);

		validator.validate();

		assertThat(loader.load()).isInstanceOf(RSAPrivateKey.class);
		assertThat(validator.repositoryAuthenticationReady()).isTrue();
	}

	@Test
	void loaderAcceptsThePkcs1RsaPemFormatGeneratedByGitHub() throws Exception {
		KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
		generator.initialize(2048);
		RSAPrivateCrtKey key = (RSAPrivateCrtKey) generator.generateKeyPair().getPrivate();
		byte[] pkcs1 = sequence(
			integer(BigInteger.ZERO), integer(key.getModulus()), integer(key.getPublicExponent()),
			integer(key.getPrivateExponent()), integer(key.getPrimeP()), integer(key.getPrimeQ()),
			integer(key.getPrimeExponentP()), integer(key.getPrimeExponentQ()), integer(key.getCrtCoefficient())
		);
		String body = Base64.getMimeEncoder(64, "\n".getBytes(StandardCharsets.US_ASCII)).encodeToString(pkcs1);
		Path pem = tempDir.resolve("github-pkcs1.pem");
		Files.writeString(pem, "-----BEGIN RSA PRIVATE KEY-----\n" + body + "\n-----END RSA PRIVATE KEY-----\n");
		GitHubAppProperties properties = properties(false, false, true, "", "", "", pem.toString());

		RSAPrivateKey loaded = new GitHubAppPrivateKeyLoader(properties).load();

		assertThat(loaded.getModulus()).isEqualTo(key.getModulus());
	}

	@Test
	void malformedPemFailsClearlyOnlyWhenRepositoryAuthenticationIsEnabled() throws Exception {
		Path malformed = tempDir.resolve("malformed.pem");
		Files.writeString(malformed, "-----BEGIN PRIVATE KEY-----\nnot-base64\n-----END PRIVATE KEY-----\n");
		GitHubAppProperties properties = properties(false, false, true, "", "", "", malformed.toString());

		assertThatThrownBy(validator(properties)::validate)
			.isInstanceOf(GitHubAppConfigurationException.class)
			.hasMessageContaining("malformed");
	}

	@Test
	void repositoryEnabledWithoutAppCredentialsFailsBeforeServingTraffic() {
		GitHubAppProperties properties = new GitHubAppProperties(
			"", "study-ing", "", "", "", "",
			new GitHubAppProperties.Features(false, false, true),
			"https://github.com", "https://api.github.com", Duration.ofSeconds(10), Duration.ofMinutes(10)
		);

		assertThatThrownBy(validator(properties)::validate)
			.isInstanceOf(GitHubAppConfigurationException.class)
			.hasMessageContaining("GITHUB_APP_ID")
			.hasMessageContaining("GITHUB_PRIVATE_KEY_PATH");
	}

	private GitHubAppConfigurationValidator validator(GitHubAppProperties properties) {
		return new GitHubAppConfigurationValidator(properties, new GitHubAppPrivateKeyLoader(properties));
	}

	private GitHubAppProperties properties(
		boolean accountLinking,
		boolean login,
		boolean repository,
		String clientId,
		String clientSecret,
		String redirectUri,
		String privateKeyPath
	) {
		return new GitHubAppProperties(
			"123456", "study-ing", clientId, clientSecret, redirectUri, privateKeyPath,
			new GitHubAppProperties.Features(accountLinking, login, repository),
			"https://github.com", "https://api.github.com", Duration.ofSeconds(10), Duration.ofMinutes(10)
		);
	}

	private Path writeRsaPrivateKey(String name) throws Exception {
		KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
		generator.initialize(2048);
		byte[] encoded = generator.generateKeyPair().getPrivate().getEncoded();
		String body = Base64.getMimeEncoder(64, "\n".getBytes(StandardCharsets.US_ASCII)).encodeToString(encoded);
		Path path = tempDir.resolve(name);
		Files.writeString(path, "-----BEGIN PRIVATE KEY-----\n" + body + "\n-----END PRIVATE KEY-----\n");
		return path;
	}

	private static byte[] integer(BigInteger value) {
		return tagged((byte) 0x02, value.toByteArray());
	}

	private static byte[] sequence(byte[]... values) {
		ByteArrayOutputStream content = new ByteArrayOutputStream();
		for (byte[] value : values) content.writeBytes(value);
		return tagged((byte) 0x30, content.toByteArray());
	}

	private static byte[] tagged(byte tag, byte[] value) {
		ByteArrayOutputStream output = new ByteArrayOutputStream();
		output.write(tag);
		if (value.length < 128) {
			output.write(value.length);
		} else {
			int count = value.length > 255 ? 2 : 1;
			output.write(0x80 | count);
			if (count == 2) output.write((value.length >>> 8) & 0xff);
			output.write(value.length & 0xff);
		}
		output.writeBytes(value);
		return output.toByteArray();
	}

	@Configuration(proxyBeanMethods = false)
	@EnableConfigurationProperties(GitHubAppProperties.class)
	static class PropertiesConfiguration {}
}
