package com.studyworkspace.github.config;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/** Validates only the credential groups required by enabled Study-ing GitHub features. */
@Component
public class GitHubAppConfigurationValidator {
	private static final Logger log = LoggerFactory.getLogger(GitHubAppConfigurationValidator.class);

	private final GitHubAppProperties properties;
	private final GitHubAppPrivateKeyLoader privateKeyLoader;
	private boolean repositoryAuthenticationReady;

	public GitHubAppConfigurationValidator(
		GitHubAppProperties properties,
		GitHubAppPrivateKeyLoader privateKeyLoader
	) {
		this.properties = properties;
		this.privateKeyLoader = privateKeyLoader;
	}

	@PostConstruct
	public void validate() {
		if (properties.features().accountLinking() && !properties.userAuthorizationConfigured()) {
			log.warn("GitHub account linking is enabled but its user-authorization configuration is incomplete; capability remains disabled.");
		}
		if (properties.features().login()) {
			log.warn("GitHub login is enabled in configuration but the login flow is not implemented; auth capability remains disabled.");
		}
		if (properties.features().repository()) {
			if (!properties.appAuthenticationConfigured()) {
				throw new GitHubAppConfigurationException(
					"GitHub repository support requires GITHUB_APP_ID and GITHUB_PRIVATE_KEY_PATH."
				);
			}
			privateKeyLoader.load();
			repositoryAuthenticationReady = true;
		}

		log.info("GitHub account linking: {}", properties.accountLinkingReady() ? "enabled" : "disabled");
		log.info("GitHub login: disabled");
		log.info("GitHub repository provider: {}", repositoryAuthenticationReady ? "enabled" : "disabled");
	}

	public boolean repositoryAuthenticationReady() {
		return repositoryAuthenticationReady;
	}

	public void requireRepositoryAuthenticationReady() {
		if (!repositoryAuthenticationReady) {
			throw new GitHubAppConfigurationException("GitHub App installation authentication is not enabled or configured.");
		}
	}
}
