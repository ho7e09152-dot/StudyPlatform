package com.studyworkspace.workspace.service;

import java.util.List;

import com.studyworkspace.workspace.domain.WorkspaceException;
import com.studyworkspace.workspace.dto.WorkspaceSyncResponse;
import org.springframework.stereotype.Service;

/** Repeats Repository reads until both content and review snapshots are stable. */
@Service
public class WorkspaceContentMigrationCoordinator {
	private static final int MAX_ATTEMPTS = 3;

	private final GitLabSessionSyncService sessionSyncService;
	private final WorkspaceContentMigrationService contentMigrationService;
	private final WorkspaceReviewMigrationService reviewMigrationService;

	public WorkspaceContentMigrationCoordinator(
		GitLabSessionSyncService sessionSyncService,
		WorkspaceContentMigrationService contentMigrationService,
		WorkspaceReviewMigrationService reviewMigrationService
	) {
		this.sessionSyncService = sessionSyncService;
		this.contentMigrationService = contentMigrationService;
		this.reviewMigrationService = reviewMigrationService;
	}

	public PreparationReport prepareStableSnapshot(String accessToken, String workspaceId) {
		String previousContentFingerprint = null;
		String previousReviewFingerprint = null;
		WorkspaceContentMigrationService.BackfillReport content = null;
		WorkspaceReviewMigrationService.ReviewImportReport reviews = null;
		for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
			WorkspaceSyncResponse sync = sessionSyncService.sync(accessToken, workspaceId);
			if (!sync.failures().isEmpty()) {
				throw new WorkspaceException(
					"CONTENT_MIGRATION_SYNC_INCOMPLETE",
					"Repository 파일 일부를 읽지 못해 전환 준비를 중단했습니다.",
					409
				);
			}
			content = contentMigrationService.stageLegacySnapshot(workspaceId);
			reviews = reviewMigrationService.importLegacyReviews(accessToken, workspaceId);
			if (content.sourceFingerprint().equals(previousContentFingerprint)
				&& reviews.sourceFingerprint().equals(previousReviewFingerprint)) {
				return new PreparationReport(
					workspaceId, "LEGACY_SNAPSHOT_VERIFIED", attempt, content, reviews, List.of()
				);
			}
			previousContentFingerprint = content.sourceFingerprint();
			previousReviewFingerprint = reviews.sourceFingerprint();
		}
		throw new WorkspaceException(
			"CONTENT_MIGRATION_SOURCE_UNSTABLE",
			"검증 중 Repository 데이터가 계속 변경되었습니다. 변경이 멈춘 뒤 다시 시도해 주세요.",
			409
		);
	}

	public record PreparationReport(
		String workspaceId,
		String status,
		int attempts,
		WorkspaceContentMigrationService.BackfillReport content,
		WorkspaceReviewMigrationService.ReviewImportReport reviews,
		List<String> blockers
	) { }
}
