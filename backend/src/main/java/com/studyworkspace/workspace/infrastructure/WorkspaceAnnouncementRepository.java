package com.studyworkspace.workspace.infrastructure;

import java.time.Instant;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WorkspaceAnnouncementRepository extends JpaRepository<WorkspaceAnnouncementEntity, String> {
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
