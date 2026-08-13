package com.studyworkspace.auth.service;

import com.studyworkspace.auth.persistence.UserAccountEntity;
import com.studyworkspace.auth.persistence.UserAccountRepository;
import com.studyworkspace.workspace.domain.WorkspaceException;
import com.studyworkspace.workspace.infrastructure.AuditEventRepository;
import com.studyworkspace.workspace.infrastructure.InAppNotificationRepository;
import com.studyworkspace.workspace.infrastructure.WorkspaceAnnouncementRepository;
import com.studyworkspace.workspace.infrastructure.WorkspaceDocumentRepository;
import com.studyworkspace.workspace.infrastructure.WorkspaceMessageRepository;
import com.studyworkspace.workspace.service.WorkspaceService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Deletes Study-ing-managed personal data while preserving shared content anonymously. */
@Service
public class AccountDeletionService {
	private final WorkspaceService workspaceService;
	private final UserAccountRepository userRepository;
	private final InAppNotificationRepository notificationRepository;
	private final WorkspaceAnnouncementRepository announcementRepository;
	private final WorkspaceMessageRepository messageRepository;
	private final WorkspaceDocumentRepository documentRepository;
	private final AuditEventRepository auditEventRepository;

	public AccountDeletionService(
		WorkspaceService workspaceService,
		UserAccountRepository userRepository,
		InAppNotificationRepository notificationRepository,
		WorkspaceAnnouncementRepository announcementRepository,
		WorkspaceMessageRepository messageRepository,
		WorkspaceDocumentRepository documentRepository,
		AuditEventRepository auditEventRepository
	) {
		this.workspaceService = workspaceService;
		this.userRepository = userRepository;
		this.notificationRepository = notificationRepository;
		this.announcementRepository = announcementRepository;
		this.messageRepository = messageRepository;
		this.documentRepository = documentRepository;
		this.auditEventRepository = auditEventRepository;
	}

	@Transactional
	public void delete(String userId, long gitLabUserId) {
		UserAccountEntity user = userRepository.findById(userId)
			.orElseThrow(() -> new WorkspaceException("ACCOUNT_NOT_FOUND", "사용자 계정을 찾을 수 없습니다.", 404));

		workspaceService.anonymizeUserForAccountDeletion(gitLabUserId);
		notificationRepository.deleteForRecipient(gitLabUserId);
		announcementRepository.anonymizeAuthor(user.id());
		messageRepository.anonymizeAuthor(user.id());
		documentRepository.anonymizeAuthor(user.id());
		auditEventRepository.anonymizeUserReferences(user.id(), Long.toString(gitLabUserId));
		userRepository.delete(user);
		userRepository.flush();
	}

	/** Compatibility entry point for existing GitLab-only callers. */
	@Transactional
	public void delete(long gitLabUserId) {
		UserAccountEntity user = userRepository.findByGitLabUserId(gitLabUserId)
			.orElseThrow(() -> new WorkspaceException("ACCOUNT_NOT_FOUND", "사용자 계정을 찾을 수 없습니다.", 404));
		delete(user.id(), gitLabUserId);
	}
}
