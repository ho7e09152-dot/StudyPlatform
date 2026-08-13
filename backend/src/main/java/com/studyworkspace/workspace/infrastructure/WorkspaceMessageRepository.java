package com.studyworkspace.workspace.infrastructure;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WorkspaceMessageRepository extends JpaRepository<WorkspaceMessageEntity, String> {
	@Modifying
	@Query("update WorkspaceMessageEntity message set message.authorUserId = null, message.authorDisplayName = '탈퇴한 사용자' where message.authorUserId = :userId")
	int anonymizeAuthor(@Param("userId") String userId);

	@Query("""
		select message from WorkspaceMessageEntity message
		where message.workspaceId = :workspaceId
		  and message.deletedAt is null
		  and (:contextDate is null or message.contextDate = :contextDate)
		  and (:before is null or message.createdAt < :before)
		order by message.createdAt desc
		""")
	List<WorkspaceMessageEntity> findPage(
		@Param("workspaceId") String workspaceId,
		@Param("contextDate") LocalDate contextDate,
		@Param("before") Instant before,
		Pageable pageable
	);
}
