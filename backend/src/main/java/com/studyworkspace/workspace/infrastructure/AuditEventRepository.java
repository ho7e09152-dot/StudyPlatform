package com.studyworkspace.workspace.infrastructure;

import java.time.Instant;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AuditEventRepository extends JpaRepository<AuditEventEntity, String> {
	List<AuditEventEntity> findTop100ByWorkspaceIdOrderByCreatedAtDesc(String workspaceId);

	@Modifying
	@Query("delete from AuditEventEntity event where event.createdAt < :cutoff")
	int deleteExpired(@Param("cutoff") Instant cutoff);

	@Modifying
	@Query("""
		update AuditEventEntity event
		set event.actorUserId = case when event.actorUserId = :userId then null else event.actorUserId end,
			event.targetId = case when event.targetId in (:userId, :providerUserId) then 'deleted-user' else event.targetId end
		where event.actorUserId = :userId or event.targetId in (:userId, :providerUserId)
		""")
	int anonymizeUserReferences(@Param("userId") String userId, @Param("providerUserId") String providerUserId);
}
