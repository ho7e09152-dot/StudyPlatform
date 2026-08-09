package com.studyworkspace.workspace.infrastructure;

import java.time.Instant;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkspaceStateRepository extends JpaRepository<WorkspaceStateEntity, String> {
	List<WorkspaceStateEntity> findByStatusAndDeletionExpiresAtBefore(String status, Instant cutoff);
	List<WorkspaceStateEntity> findByStatus(String status);
}
