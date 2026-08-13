package com.studyworkspace.auth.persistence;

import java.time.Instant;
import java.util.UUID;
import com.studyworkspace.gitlab.dto.GitLabUser;
import com.studyworkspace.workspace.domain.RepositoryProvider;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(
	name = "provider_accounts",
	uniqueConstraints = {
		@UniqueConstraint(name = "uk_provider_external_user", columnNames = {"provider", "external_user_id"}),
		@UniqueConstraint(name = "uk_provider_user", columnNames = {"user_id", "provider"})
	}
)
public class ProviderAccountEntity {
	@Id
	@Column(length = 36)
	private String id;

	@Column(name = "user_id", nullable = false, length = 36)
	private String userId;

	@Column(nullable = false, length = 32)
	private String provider;

	@Column(name = "external_user_id", nullable = false, length = 255)
	private String externalUserId;

	@Column(nullable = false)
	private String username;

	@Column(name = "display_name")
	private String displayName;

	@Column(name = "avatar_url", length = 2048)
	private String avatarUrl;

	@Column(name = "web_url", length = 2048)
	private String webUrl;

	@Column(nullable = false, length = 32)
	private String status;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	protected ProviderAccountEntity() { }

	public static ProviderAccountEntity createGitLab(String userId, GitLabUser identity, Instant now) {
		ProviderAccountEntity entity = create(
			userId,
			RepositoryProvider.GITLAB,
			Long.toString(identity.id()),
			identity.username(),
			identity.name(),
			identity.avatarUrl(),
			identity.webUrl(),
			now
		);
		// The initial GitLab account reuses the internal id so the staged credential migration
		// can keep its legacy user mirror without decrypting or copying token values.
		entity.id = userId;
		return entity;
	}

	public static ProviderAccountEntity create(
		String userId,
		RepositoryProvider provider,
		String externalUserId,
		String username,
		String displayName,
		String avatarUrl,
		String webUrl,
		Instant now
	) {
		ProviderAccountEntity entity = new ProviderAccountEntity();
		entity.id = UUID.randomUUID().toString();
		entity.userId = userId;
		entity.provider = provider.name();
		entity.externalUserId = externalUserId;
		entity.createdAt = now;
		entity.updateIdentity(provider, externalUserId, username, displayName, avatarUrl, webUrl, now);
		return entity;
	}

	public void updateGitLab(GitLabUser identity, Instant now) {
		updateIdentity(RepositoryProvider.GITLAB, Long.toString(identity.id()), identity.username(), identity.name(),
			identity.avatarUrl(), identity.webUrl(), now);
	}

	public void updateIdentity(
		RepositoryProvider expectedProvider,
		String expectedExternalUserId,
		String username,
		String displayName,
		String avatarUrl,
		String webUrl,
		Instant now
	) {
		if (!expectedProvider.name().equals(provider) || !externalUserId.equals(expectedExternalUserId)) {
			throw new IllegalArgumentException("Provider identity cannot be changed.");
		}
		this.username = username;
		this.displayName = displayName;
		this.avatarUrl = avatarUrl;
		this.webUrl = webUrl;
		this.status = "CONNECTED";
		this.updatedAt = now;
	}

	public String id() { return id; }
	public String userId() { return userId; }
	public RepositoryProvider provider() { return RepositoryProvider.valueOf(provider); }
	public String externalUserId() { return externalUserId; }
	public String username() { return username; }
	public String displayName() { return displayName; }
	public String avatarUrl() { return avatarUrl; }
	public String webUrl() { return webUrl; }
	public String status() { return status; }

	public GitLabUser toGitLabUser() {
		if (provider() != RepositoryProvider.GITLAB) {
			throw new IllegalStateException("Provider account is not a GitLab account.");
		}
		return new GitLabUser(Long.parseLong(externalUserId), username, displayName, avatarUrl, webUrl);
	}
}
