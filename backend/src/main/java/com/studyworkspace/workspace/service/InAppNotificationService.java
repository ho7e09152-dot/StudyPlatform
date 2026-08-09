package com.studyworkspace.workspace.service;

import java.time.Instant;
import java.util.List;

import com.studyworkspace.workspace.domain.WorkspaceException;
import com.studyworkspace.workspace.infrastructure.InAppNotificationEntity;
import com.studyworkspace.workspace.infrastructure.InAppNotificationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class InAppNotificationService {
	private static final Logger log = LoggerFactory.getLogger(InAppNotificationService.class);
	private final InAppNotificationRepository repository;

	public InAppNotificationService(InAppNotificationRepository repository) {
		this.repository = repository;
	}

	public void create(long recipientGitLabUserId, String workspaceId, String type, String title, String message, String actionPath) {
		try {
			repository.saveAndFlush(InAppNotificationEntity.create(recipientGitLabUserId, workspaceId, type, title, message, actionPath));
		} catch (RuntimeException exception) {
			log.error("In-app notification persistence failed: workspaceId={}, type={}", workspaceId, type, exception);
		}
	}

	@Transactional(readOnly = true)
	public List<NotificationView> list(long recipientGitLabUserId) {
		return repository.findTop50ByRecipientGitLabUserIdOrderByCreatedAtDesc(recipientGitLabUserId).stream().map(NotificationView::from).toList();
	}

	@Transactional
	public NotificationView markRead(String id, long recipientGitLabUserId) {
		InAppNotificationEntity notification = repository.findById(id)
			.filter(item -> item.recipientGitLabUserId() == recipientGitLabUserId)
			.orElseThrow(() -> new WorkspaceException("NOTIFICATION_NOT_FOUND", "알림을 찾을 수 없습니다.", 404));
		notification.markRead();
		return NotificationView.from(notification);
	}

	public record NotificationView(String id, String workspaceId, String type, String title, String message, String actionPath, Instant readAt, Instant createdAt) {
		static NotificationView from(InAppNotificationEntity notification) {
			return new NotificationView(notification.id(), notification.workspaceId(), notification.type(), notification.title(), notification.message(), notification.actionPath(), notification.readAt(), notification.createdAt());
		}
	}
}
