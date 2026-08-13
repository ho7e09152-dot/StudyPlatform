package com.studyworkspace.workspace.infrastructure;

import java.time.Instant;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SyncJobRepository extends JpaRepository<SyncJobEntity, String> {
	List<SyncJobEntity> findTop20ByWorkspaceIdOrderByStartedAtDesc(String workspaceId);

	@Modifying
	@Query("delete from SyncJobEntity job where job.startedAt < :cutoff")
	int deleteExpired(@Param("cutoff") Instant cutoff);
}
