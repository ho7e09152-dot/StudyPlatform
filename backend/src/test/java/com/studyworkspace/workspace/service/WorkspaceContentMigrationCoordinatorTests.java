package com.studyworkspace.workspace.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.OffsetDateTime;
import java.util.List;

import com.studyworkspace.workspace.domain.WorkspaceException;
import com.studyworkspace.workspace.dto.WorkspaceSyncResponse;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class WorkspaceContentMigrationCoordinatorTests {
	private final GitLabSessionSyncService syncService = mock(GitLabSessionSyncService.class);
	private final WorkspaceContentMigrationService contentService = mock(WorkspaceContentMigrationService.class);
	private final WorkspaceReviewMigrationService reviewService = mock(WorkspaceReviewMigrationService.class);
	private final WorkspaceContentMigrationCoordinator coordinator = new WorkspaceContentMigrationCoordinator(
		syncService, contentService, reviewService
	);

	@Test
	void requiresTwoMatchingSnapshotsBeforeReportingVerified() {
		WorkspaceSyncResponse sync = mock(WorkspaceSyncResponse.class);
		when(sync.failures()).thenReturn(List.of());
		when(syncService.sync("token", "workspace-1")).thenReturn(sync);
		var content = new WorkspaceContentMigrationService.BackfillReport(
			"workspace-1", "BACKFILL_VERIFIED", 1, 2, 1, 2, 1,
			"content-hash", "content-hash", true, OffsetDateTime.parse("2026-09-13T00:00:00Z")
		);
		var reviews = new WorkspaceReviewMigrationService.ReviewImportReport(
			"workspace-1", 2, "review-hash", "review-hash", false,
			OffsetDateTime.parse("2026-09-13T00:00:00Z")
		);
		when(contentService.stageLegacySnapshot("workspace-1")).thenReturn(content);
		when(reviewService.importLegacyReviews("token", "workspace-1")).thenReturn(reviews);

		var result = coordinator.prepareStableSnapshot("token", "workspace-1");

		assertThat(result.status()).isEqualTo("LEGACY_SNAPSHOT_VERIFIED");
		assertThat(result.attempts()).isEqualTo(2);
		assertThat(result.blockers()).isEmpty();
		verify(syncService, Mockito.times(2)).sync("token", "workspace-1");
	}

	@Test
	void stopsBeforeBackfillWhenRepositorySyncIsPartial() {
		WorkspaceSyncResponse sync = mock(WorkspaceSyncResponse.class);
		when(sync.failures()).thenReturn(List.of(
			new WorkspaceSyncResponse.SyncFailure("session.yml", "INVALID_SESSION_FILE", "invalid")
		));
		when(syncService.sync("token", "workspace-1")).thenReturn(sync);

		assertThatThrownBy(() -> coordinator.prepareStableSnapshot("token", "workspace-1"))
			.isInstanceOfSatisfying(WorkspaceException.class, exception ->
				assertThat(exception.code()).isEqualTo("CONTENT_MIGRATION_SYNC_INCOMPLETE"));
		verify(contentService, Mockito.never()).stageLegacySnapshot("workspace-1");
	}
}
