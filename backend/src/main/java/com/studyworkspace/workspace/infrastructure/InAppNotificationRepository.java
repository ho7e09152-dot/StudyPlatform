package com.studyworkspace.workspace.infrastructure;

import java.time.Instant;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InAppNotificationRepository extends JpaRepository<InAppNotificationEntity, String> {
	List<InAppNotificationEntity> findTop50ByRecipientGitLabUserIdOrderByCreatedAtDesc(long recipientGitLabUserId);

	@Modifying
	@Query("delete from InAppNotificationEntity notification where notification.createdAt < :cutoff")
	int deleteExpired(@Param("cutoff") Instant cutoff);

	@Modifying
	@Query("delete from InAppNotificationEntity notification where notification.recipientGitLabUserId = :recipientGitLabUserId")
	int deleteForRecipient(@Param("recipientGitLabUserId") long recipientGitLabUserId);
}
