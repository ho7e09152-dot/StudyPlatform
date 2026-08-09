package com.studyworkspace.workspace.infrastructure;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AuditEventRepository extends JpaRepository<AuditEventEntity, String> {
	List<AuditEventEntity> findTop100ByWorkspaceIdOrderByCreatedAtDesc(String workspaceId);
}

