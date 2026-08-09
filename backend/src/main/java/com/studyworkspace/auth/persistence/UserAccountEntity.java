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
		entity.updateFrom(user, now);
		return entity;
	}

	public void updateFrom(GitLabUser user, Instant now) {
		this.gitLabUserId = user.id();
		this.username = user.username();
		this.displayName = user.name() == null || user.name().isBlank() ? user.username() : user.name();
		this.avatarUrl = user.avatarUrl();
		this.webUrl = user.webUrl();
		this.updatedAt = now;
	}

	public String id() {
		return id;
	}

	public long gitLabUserId() {
		return gitLabUserId;
	}

	public GitLabUser toGitLabUser() {
		return new GitLabUser(gitLabUserId, username, displayName, avatarUrl, webUrl);
	}
}
