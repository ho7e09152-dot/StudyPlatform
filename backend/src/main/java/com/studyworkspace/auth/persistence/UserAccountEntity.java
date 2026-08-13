package com.studyworkspace.auth.persistence;

import java.time.Instant;
import java.util.UUID;

import com.studyworkspace.gitlab.dto.GitLabUser;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "user_accounts")
public class UserAccountEntity {

	@Id
	@Column(length = 36)
	private String id;

	/** Compatibility mirror. ProviderAccount is the source of truth for external identities. */
	@Deprecated
	@Column(name = "gitlab_user_id", unique = true)
	private Long gitLabUserId;

	@Column(nullable = false)
	private String username;

	@Column(name = "display_name", nullable = false)
	private String displayName;

	@Column(name = "avatar_url", length = 2048)
	private String avatarUrl;

	@Column(name = "web_url", length = 2048)
	private String webUrl;

	@Column(name = "profile_completed", nullable = false)
	private boolean profileCompleted;

	@Column(name = "repository_file_name", length = 120)
	private String repositoryFileName;

	@Column(nullable = false, length = 100)
	private String timezone;

	@Column(name = "terms_version", length = 32)
	private String termsVersion;

	@Column(name = "terms_agreed_at")
	private Instant termsAgreedAt;

	@Column(name = "privacy_version", length = 32)
	private String privacyVersion;

	@Column(name = "privacy_agreed_at")
	private Instant privacyAgreedAt;

	@Column(name = "minimum_age_confirmed_at")
	private Instant minimumAgeConfirmedAt;

	@Column(name = "theme_mode", nullable = false, length = 16)
	private String themeMode;

	@Column(name = "accent_color", nullable = false, length = 16)
	private String accentColor;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	protected UserAccountEntity() {
	}

	public static UserAccountEntity create(GitLabUser user, Instant now) {
		UserAccountEntity entity = new UserAccountEntity();
		entity.id = UUID.randomUUID().toString();
		entity.createdAt = now;
		entity.profileCompleted = false;
		entity.timezone = "Asia/Seoul";
		entity.themeMode = "LIGHT";
		entity.accentColor = "PURPLE";
		entity.updateFrom(user, now);
		return entity;
	}

	public static UserAccountEntity createFromProvider(String username, String providerDisplayName, Instant now) {
		UserAccountEntity entity = new UserAccountEntity();
		entity.id = UUID.randomUUID().toString();
		entity.createdAt = now;
		entity.profileCompleted = false;
		entity.timezone = "Asia/Seoul";
		entity.themeMode = "LIGHT";
		entity.accentColor = "PURPLE";
		entity.username = username;
		entity.displayName = providerDisplayName == null || providerDisplayName.isBlank() ? username : providerDisplayName;
		entity.updatedAt = now;
		return entity;
	}

	public void updateFrom(GitLabUser user, Instant now) {
		this.gitLabUserId = user.id();
		this.username = user.username();
		if (!profileCompleted) {
			this.displayName = user.name() == null || user.name().isBlank() ? user.username() : user.name();
		}
		this.avatarUrl = user.avatarUrl();
		this.webUrl = user.webUrl();
		this.updatedAt = now;
	}

	public void completeProfile(
		String displayName,
		String repositoryFileName,
		String timezone,
		Instant now
	) {
		this.displayName = displayName;
		this.repositoryFileName = repositoryFileName;
		this.timezone = timezone;
		this.profileCompleted = true;
		this.updatedAt = now;
	}

	public void agreeToPolicies(String requiredTermsVersion, String requiredPrivacyVersion, Instant now) {
		if (!requiredTermsVersion.equals(this.termsVersion)) {
			this.termsVersion = requiredTermsVersion;
			this.termsAgreedAt = now;
		}
		if (!requiredPrivacyVersion.equals(this.privacyVersion)) {
			this.privacyVersion = requiredPrivacyVersion;
			this.privacyAgreedAt = now;
		}
		if (this.minimumAgeConfirmedAt == null) this.minimumAgeConfirmedAt = now;
		this.updatedAt = now;
	}

	public void updatePreferences(String themeMode, String accentColor, Instant now) {
		this.themeMode = themeMode;
		this.accentColor = accentColor;
		this.updatedAt = now;
	}

	public String id() {
		return id;
	}

	public long gitLabUserId() {
		return gitLabUserId == null ? 0 : gitLabUserId;
	}

	public String username() { return username; }
	public String displayName() { return displayName; }
	public String avatarUrl() { return avatarUrl; }
	public String webUrl() { return webUrl; }
	public boolean profileCompleted() { return profileCompleted; }
	public String repositoryFileName() { return repositoryFileName; }
	public String timezone() { return timezone; }
	public String termsVersion() { return termsVersion; }
	public Instant termsAgreedAt() { return termsAgreedAt; }
	public String privacyVersion() { return privacyVersion; }
	public Instant privacyAgreedAt() { return privacyAgreedAt; }
	public Instant minimumAgeConfirmedAt() { return minimumAgeConfirmedAt; }
	public String themeMode() { return themeMode == null ? "LIGHT" : themeMode; }
	public String accentColor() { return accentColor == null ? "PURPLE" : accentColor; }

	public GitLabUser toGitLabUser() {
		return new GitLabUser(gitLabUserId, username, displayName, avatarUrl, webUrl);
	}
}
