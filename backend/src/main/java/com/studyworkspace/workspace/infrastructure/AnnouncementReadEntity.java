package com.studyworkspace.workspace.infrastructure;

import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "announcement_reads")
public class AnnouncementReadEntity {
	@EmbeddedId
	private AnnouncementReadId id;
	@Column(name = "read_at", nullable = false)
	private Instant readAt;

	protected AnnouncementReadEntity() { }

	public static AnnouncementReadEntity create(String announcementId, String userId) {
		AnnouncementReadEntity entity = new AnnouncementReadEntity();
		entity.id = new AnnouncementReadId(announcementId, userId);
		entity.readAt = Instant.now();
		return entity;
	}

	public Instant readAt() { return readAt; }

	@Embeddable
	public static class AnnouncementReadId implements Serializable {
		@Column(name = "announcement_id", length = 36)
		private String announcementId;
		@Column(name = "user_id", length = 36)
		private String userId;

		protected AnnouncementReadId() { }
		public AnnouncementReadId(String announcementId, String userId) { this.announcementId = announcementId; this.userId = userId; }
		@Override public boolean equals(Object other) { return other instanceof AnnouncementReadId that && Objects.equals(announcementId, that.announcementId) && Objects.equals(userId, that.userId); }
		@Override public int hashCode() { return Objects.hash(announcementId, userId); }
	}
}
