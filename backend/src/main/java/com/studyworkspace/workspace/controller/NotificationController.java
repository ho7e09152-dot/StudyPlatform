package com.studyworkspace.workspace.controller;

import java.util.List;

import com.studyworkspace.gitlab.dto.GitLabUser;
import com.studyworkspace.workspace.service.InAppNotificationService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationController {
	private final InAppNotificationService service;

	public NotificationController(InAppNotificationService service) {
		this.service = service;
	}

	@GetMapping
	public List<InAppNotificationService.NotificationView> list(@AuthenticationPrincipal GitLabUser user) {
		return service.list(user.id());
	}

	@PatchMapping("/{notificationId}/read")
	public InAppNotificationService.NotificationView markRead(@PathVariable String notificationId, @AuthenticationPrincipal GitLabUser user) {
		return service.markRead(notificationId, user.id());
	}
}
