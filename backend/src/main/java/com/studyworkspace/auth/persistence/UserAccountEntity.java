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

	@Column(name = "gitlab_user_id", nullable = false, unique = true)
	private long gitLabUserId;

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

	@Column(name = "terms_accepted_at")
	private Instant termsAcceptedAt;

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
		String termsVersion,
		Instant now
	) {
		this.displayName = displayName;
		this.repositoryFileName = repositoryFileName;
		this.timezone = timezone;
		this.termsVersion = termsVersion;
		this.termsAcceptedAt = now;
		this.profileCompleted = true;
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
		return gitLabUserId;
	}

	public String username() { return username; }
	public String displayName() { return displayName; }
	public String avatarUrl() { return avatarUrl; }
	public String webUrl() { return webUrl; }
	public boolean profileCompleted() { return profileCompleted; }
	public String repositoryFileName() { return repositoryFileName; }
	public String timezone() { return timezone; }
	public String termsVersion() { return termsVersion; }
	public Instant termsAcceptedAt() { return termsAcceptedAt; }
	public String themeMode() { return themeMode == null ? "LIGHT" : themeMode; }
	public String accentColor() { return accentColor == null ? "PURPLE" : accentColor; }

	public GitLabUser toGitLabUser() {
		return new GitLabUser(gitLabUserId, username, displayName, avatarUrl, webUrl);
	}
}
