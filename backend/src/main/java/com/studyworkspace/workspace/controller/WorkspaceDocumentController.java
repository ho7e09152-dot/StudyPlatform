package com.studyworkspace.workspace.controller;

import java.util.Map;

import com.studyworkspace.gitlab.dto.GitLabUser;
import com.studyworkspace.workspace.domain.WorkspaceModels.WorkspaceState;
import com.studyworkspace.workspace.service.AuditEventService;
import com.studyworkspace.workspace.service.InAppNotificationService;
import com.studyworkspace.workspace.service.WorkspaceDocumentService;
import com.studyworkspace.workspace.service.WorkspaceService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/workspaces/{workspaceId}/documents")
public class WorkspaceDocumentController {
	private final WorkspaceDocumentService documentService;
	private final WorkspaceService workspaceService;
	private final AuditEventService auditEventService;
	private final InAppNotificationService notificationService;

	public WorkspaceDocumentController(WorkspaceDocumentService documentService, WorkspaceService workspaceService, AuditEventService auditEventService, InAppNotificationService notificationService) {
		this.documentService = documentService;
		this.workspaceService = workspaceService;
		this.auditEventService = auditEventService;
		this.notificationService = notificationService;
	}

	@GetMapping
	public WorkspaceDocumentService.DocumentPage list(@PathVariable String workspaceId, @RequestParam(required = false) String query, @RequestParam(required = false) String cursor, @AuthenticationPrincipal GitLabUser user) {
		return documentService.list(workspaceId, user.id(), query, cursor);
	}

	@GetMapping("/{documentId}")
	public WorkspaceDocumentService.DocumentView get(@PathVariable String workspaceId, @PathVariable String documentId, @AuthenticationPrincipal GitLabUser user) {
		return documentService.get(workspaceId, documentId, user.id());
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public WorkspaceDocumentService.DocumentView create(@PathVariable String workspaceId, @RequestBody WorkspaceDocumentService.DocumentMutation request, @AuthenticationPrincipal GitLabUser user) {
		WorkspaceDocumentService.DocumentView created = documentService.create(workspaceId, user.id(), request);
		auditEventService.record(workspaceId, user, "WORKSPACE_DOCUMENT_CREATED", "DOCUMENT", created.id(), Map.of("version", created.version()));
		notifyCreated(workspaceId, user, created);
		return created;
	}

	@PatchMapping("/{documentId}")
	public WorkspaceDocumentService.DocumentView update(@PathVariable String workspaceId, @PathVariable String documentId, @RequestBody WorkspaceDocumentService.DocumentMutation request, @AuthenticationPrincipal GitLabUser user) {
		WorkspaceDocumentService.DocumentView updated = documentService.update(workspaceId, documentId, user.id(), request);
		auditEventService.record(workspaceId, user, "WORKSPACE_DOCUMENT_UPDATED", "DOCUMENT", documentId, Map.of("version", updated.version()));
		return updated;
	}

	@DeleteMapping("/{documentId}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void delete(@PathVariable String workspaceId, @PathVariable String documentId, @RequestParam Integer expectedVersion, @AuthenticationPrincipal GitLabUser user) {
		documentService.delete(workspaceId, documentId, user.id(), expectedVersion);
		auditEventService.record(workspaceId, user, "WORKSPACE_DOCUMENT_DELETED", "DOCUMENT", documentId, Map.of("version", expectedVersion));
	}

	private void notifyCreated(String workspaceId, GitLabUser actor, WorkspaceDocumentService.DocumentView document) {
		WorkspaceState workspace = workspaceService.get(workspaceId);
		workspace.members().stream()
			.filter(member -> "ACTIVE".equals(member.status()) && member.gitlabUserId() != actor.id())
			.forEach(member -> notificationService.create(
				member.gitlabUserId(), workspaceId, "WORKSPACE_DOCUMENT_CREATED", "새 팀 문서가 등록되었습니다.",
				document.title() + " · " + document.authorName(), "/library/docs/" + document.id()
			));
	}
}
