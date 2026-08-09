package com.studyworkspace.workspace.infrastructure;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface SyncJobRepository extends JpaRepository<SyncJobEntity, String> {
	List<SyncJobEntity> findTop20ByWorkspaceIdOrderByStartedAtDesc(String workspaceId);
}
