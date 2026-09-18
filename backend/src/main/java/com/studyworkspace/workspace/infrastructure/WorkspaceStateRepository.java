package com.studyworkspace.workspace.infrastructure;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WorkspaceStateRepository extends JpaRepository<WorkspaceStateEntity, String> {
	boolean existsByGitLabProjectId(long gitLabProjectId);
	List<WorkspaceStateEntity> findByStatusAndDeletionExpiresAtBefore(String status, Instant cutoff);
	List<WorkspaceStateEntity> findByStatus(String status);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select workspace from WorkspaceStateEntity workspace where workspace.id = :workspaceId")
	Optional<WorkspaceStateEntity> findForContentMigration(@Param("workspaceId") String workspaceId);
}
