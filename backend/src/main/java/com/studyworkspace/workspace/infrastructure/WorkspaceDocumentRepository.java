package com.studyworkspace.workspace.infrastructure;

import java.time.Instant;
import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WorkspaceDocumentRepository extends JpaRepository<WorkspaceDocumentEntity, String> {
	@Query("""
		select document from WorkspaceDocumentEntity document
		where document.workspaceId = :workspaceId
		  and document.deletedAt is null
		  and (:before is null or document.updatedAt < :before)
		  and (:query is null or lower(document.title) like lower(concat('%', :query, '%')) or lower(document.bodyMarkdown) like lower(concat('%', :query, '%')) or lower(document.authorDisplayName) like lower(concat('%', :query, '%')))
		order by document.updatedAt desc
		""")
	List<WorkspaceDocumentEntity> findPage(
		@Param("workspaceId") String workspaceId,
		@Param("query") String query,
		@Param("before") Instant before,
		Pageable pageable
	);
}
