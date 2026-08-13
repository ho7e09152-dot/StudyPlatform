package com.studyworkspace.workspace.infrastructure;

import java.time.Instant;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WorkspaceAnnouncementRepository extends JpaRepository<WorkspaceAnnouncementEntity, String> {
	@Modifying
	@Query("update WorkspaceAnnouncementEntity announcement set announcement.authorUserId = null, announcement.authorDisplayName = '탈퇴한 사용자' where announcement.authorUserId = :userId")
	int anonymizeAuthor(@Param("userId") String userId);

	@Query("""
		select announcement from WorkspaceAnnouncementEntity announcement
		where announcement.workspaceId = :workspaceId
		  and announcement.archivedAt is null
		  and announcement.publishedAt <= :now
		  and (announcement.expiresAt is null or announcement.expiresAt > :now)
		order by announcement.pinned desc, announcement.publishedAt desc
		""")
	List<WorkspaceAnnouncementEntity> findVisible(@Param("workspaceId") String workspaceId, @Param("now") Instant now);
}
