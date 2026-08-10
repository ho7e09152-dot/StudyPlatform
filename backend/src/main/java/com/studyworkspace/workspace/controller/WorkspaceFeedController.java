package com.studyworkspace.workspace.controller;

import java.util.List;
import java.util.Map;

import com.studyworkspace.gitlab.dto.GitLabUser;
import com.studyworkspace.workspace.domain.WorkspaceModels.WorkspaceState;
import com.studyworkspace.workspace.service.AuditEventService;
import com.studyworkspace.workspace.service.InAppNotificationService;
import com.studyworkspace.workspace.service.WorkspaceFeedService;
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
@RequestMapping("/api/v1/workspaces/{workspaceId}")
public class WorkspaceFeedController {
	private final WorkspaceFeedService feedService;
	private final WorkspaceService workspaceService;
	private final AuditEventService auditEventService;
	private final InAppNotificationService notificationService;

	public WorkspaceFeedController(WorkspaceFeedService feedService, WorkspaceService workspaceService, AuditEventService auditEventService, InAppNotificationService notificationService) {
		this.feedService = feedService;
		this.workspaceService = workspaceService;
		this.auditEventService = auditEventService;
		this.notificationService = notificationService;
	}

	@GetMapping("/announcements")
	public List<WorkspaceFeedService.AnnouncementView> listAnnouncements(@PathVariable String workspaceId, @AuthenticationPrincipal GitLabUser user) {
		return feedService.listAnnouncements(workspaceId, user.id());
	}

	@PostMapping("/announcements")
	@ResponseStatus(HttpStatus.CREATED)
	public WorkspaceFeedService.AnnouncementView createAnnouncement(@PathVariable String workspaceId, @RequestBody WorkspaceFeedService.AnnouncementRequest request, @AuthenticationPrincipal GitLabUser user) {
		WorkspaceFeedService.AnnouncementView created = feedService.createAnnouncement(workspaceId, user.id(), request);
		auditEventService.record(workspaceId, user, "ANNOUNCEMENT_CREATED", "ANNOUNCEMENT", created.id(), Map.of("pinned", created.pinned()));
		notifyAnnouncement(workspaceId, user, created);
		return created;
	}

	@PatchMapping("/announcements/{announcementId}")
	public WorkspaceFeedService.AnnouncementView updateAnnouncement(@PathVariable String workspaceId, @PathVariable String announcementId, @RequestBody WorkspaceFeedService.AnnouncementRequest request, @AuthenticationPrincipal GitLabUser user) {
		WorkspaceFeedService.AnnouncementView updated = feedService.updateAnnouncement(workspaceId, announcementId, user.id(), request);
		auditEventService.record(workspaceId, user, "ANNOUNCEMENT_UPDATED", "ANNOUNCEMENT", announcementId, Map.of("pinned", updated.pinned()));
		return updated;
	}

	@DeleteMapping("/announcements/{announcementId}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void deleteAnnouncement(@PathVariable String workspaceId, @PathVariable String announcementId, @AuthenticationPrincipal GitLabUser user) {
		feedService.deleteAnnouncement(workspaceId, announcementId, user.id());
		auditEventService.record(workspaceId, user, "ANNOUNCEMENT_ARCHIVED", "ANNOUNCEMENT", announcementId, Map.of());
	}

	@PatchMapping("/announcements/{announcementId}/read")
	public Map<String, Object> markAnnouncementRead(@PathVariable String workspaceId, @PathVariable String announcementId, @AuthenticationPrincipal GitLabUser user) {
		return Map.of("announcementId", announcementId, "readAt", feedService.markAnnouncementRead(workspaceId, announcementId, user.id()));
	}

	@GetMapping("/messages")
	public WorkspaceFeedService.MessagePage listMessages(@PathVariable String workspaceId, @RequestParam(required = false) String date, @RequestParam(required = false) String cursor, @AuthenticationPrincipal GitLabUser user) {
		return feedService.listMessages(workspaceId, user.id(), date, cursor);
	}

	@PostMapping("/messages")
	@ResponseStatus(HttpStatus.CREATED)
	public WorkspaceFeedService.MessageView createMessage(@PathVariable String workspaceId, @RequestBody WorkspaceFeedService.MessageRequest request, @AuthenticationPrincipal GitLabUser user) {
		WorkspaceFeedService.MessageView created = feedService.createMessage(workspaceId, user.id(), request);
		auditEventService.record(workspaceId, user, "WORKSPACE_MESSAGE_CREATED", "MESSAGE", created.id(), Map.of("contextDate", created.contextDate().toString()));
		return created;
	}

	@PatchMapping("/messages/{messageId}")
	public WorkspaceFeedService.MessageView updateMessage(@PathVariable String workspaceId, @PathVariable String messageId, @RequestBody WorkspaceFeedService.MessageRequest request, @AuthenticationPrincipal GitLabUser user) {
		WorkspaceFeedService.MessageView updated = feedService.updateMessage(workspaceId, messageId, user.id(), request);
		auditEventService.record(workspaceId, user, "WORKSPACE_MESSAGE_UPDATED", "MESSAGE", messageId, Map.of());
		return updated;
	}

	@DeleteMapping("/messages/{messageId}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void deleteMessage(@PathVariable String workspaceId, @PathVariable String messageId, @AuthenticationPrincipal GitLabUser user) {
		feedService.deleteMessage(workspaceId, messageId, user.id());
		auditEventService.record(workspaceId, user, "WORKSPACE_MESSAGE_DELETED", "MESSAGE", messageId, Map.of());
	}

	private void notifyAnnouncement(String workspaceId, GitLabUser actor, WorkspaceFeedService.AnnouncementView announcement) {
		WorkspaceState workspace = workspaceService.get(workspaceId);
		workspace.members().stream()
			.filter(member -> "ACTIVE".equals(member.status()))
			.filter(member -> member.gitlabUserId() != actor.id())
			.forEach(member -> notificationService.create(
				member.gitlabUserId(), workspaceId, "WORKSPACE_ANNOUNCEMENT", "새 공지가 등록되었습니다.",
				announcement.title() + " · " + announcement.authorName(), "/today#team-feed"
			));
	}
}
