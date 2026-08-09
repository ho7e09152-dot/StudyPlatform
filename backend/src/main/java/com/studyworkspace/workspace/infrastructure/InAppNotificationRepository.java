package com.studyworkspace.workspace.infrastructure;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface InAppNotificationRepository extends JpaRepository<InAppNotificationEntity, String> {
	List<InAppNotificationEntity> findTop50ByRecipientGitLabUserIdOrderByCreatedAtDesc(long recipientGitLabUserId);
}

