package com.studyworkspace.workspace.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import com.studyworkspace.workspace.domain.WorkspaceException;
import com.studyworkspace.workspace.domain.WorkspaceModels.WorkspaceState;
import com.studyworkspace.workspace.infrastructure.WorkspaceStateEntity;
import com.studyworkspace.workspace.infrastructure.WorkspaceStateRepository;
import com.studyworkspace.workspace.port.RepositoryDataPort;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.util.StringUtils;
import tools.jackson.databind.ObjectMapper;

/** Imports legacy commit-comment review threads after the content snapshot has been verified. */
@Service
public class WorkspaceReviewMigrationService {
	private final RepositoryDataService repositories;
	private final WorkspaceStateRepository stateRepository;
	private final NamedParameterJdbcTemplate jdbcTemplate;
	private final ObjectMapper objectMapper;
	private final TransactionTemplate transactions;

	public WorkspaceReviewMigrationService(
		RepositoryDataService repositories,
		WorkspaceStateRepository stateRepository,
		NamedParameterJdbcTemplate jdbcTemplate,
		ObjectMapper objectMapper,
		PlatformTransactionManager transactionManager
	) {
		this.repositories = repositories;
		this.stateRepository = stateRepository;
		this.jdbcTemplate = jdbcTemplate;
		this.objectMapper = objectMapper;
		this.transactions = new TransactionTemplate(transactionManager);
	}

	public ReviewImportReport importLegacyReviews(String accessToken, String workspaceId) {
		WorkspaceStateEntity snapshotEntity = stateRepository.findById(workspaceId)
			.orElseThrow(() -> error("WORKSPACE_NOT_FOUND", "Workspace를 찾을 수 없습니다.", 404));
		if (!"REPOSITORY_PRIMARY".equals(snapshotEntity.storageMode())) {
			throw error("CONTENT_MIGRATION_MODE_CONFLICT", "Repository 정본 Workspace의 리뷰만 가져올 수 있습니다.", 409);
		}
		WorkspaceState snapshot = snapshotEntity.toState(objectMapper);
		MigrationMarker marker = loadMarker(workspaceId);
		List<ThreadTarget> targets = loadTargets(workspaceId);
		RepositoryDataPort repository = repositories.require(snapshot.repository());
		Map<String, ReviewRow> rows = new LinkedHashMap<>();
		for (ThreadTarget target : targets) {
			if (!StringUtils.hasText(target.commitId())) {
				throw error("CONTENT_MIGRATION_SOURCE_INVALID", "리뷰 thread의 기존 commit SHA가 없습니다.", 422);
			}
			for (RepositoryDataPort.CommitComment comment : repository.listCommitComments(
				accessToken, snapshot.repository(), target.commitId()
			)) {
				ReviewRow row = reviewRow(snapshot, target, comment);
				ReviewRow previous = rows.putIfAbsent(row.id(), row);
				if (previous != null && !previous.legacyImportHash().equals(row.legacyImportHash())) {
					throw error("CONTENT_MIGRATION_SOURCE_INVALID", "동일한 Provider review ID의 내용이 서로 다릅니다.", 422);
				}
			}
		}
		String fingerprint = fingerprint(rows.values().stream().map(ReviewRow::legacyImportHash).sorted().toList());
		OffsetDateTime verifiedAt = OffsetDateTime.now(ZoneOffset.UTC);

		ReviewImportReport report = transactions.execute(status -> persistReviews(
			workspaceId, snapshot, marker, targets, List.copyOf(rows.values()), fingerprint, verifiedAt
		));
		if (report == null) throw new IllegalStateException("리뷰 전환 transaction 결과가 없습니다.");
		return report;
	}

	private ReviewImportReport persistReviews(
		String workspaceId,
		WorkspaceState snapshot,
		MigrationMarker marker,
		List<ThreadTarget> targets,
		List<ReviewRow> rows,
		String fingerprint,
		OffsetDateTime verifiedAt
	) {
		WorkspaceStateEntity locked = stateRepository.findForContentMigration(workspaceId)
			.orElseThrow(() -> error("WORKSPACE_NOT_FOUND", "Workspace를 찾을 수 없습니다.", 404));
		WorkspaceState current = locked.toState(objectMapper);
		if (!"REPOSITORY_PRIMARY".equals(locked.storageMode())
			|| !Objects.equals(snapshot.lastSyncedAt(), current.lastSyncedAt())) {
			throw error("CONTENT_MIGRATION_SOURCE_CHANGED", "리뷰를 가져오는 동안 Repository snapshot이 변경되었습니다.", 409);
		}
		MigrationMarker currentMarker = loadMarker(workspaceId);
		if (!marker.sourceFingerprint().equals(currentMarker.sourceFingerprint())
			|| !marker.databaseFingerprint().equals(currentMarker.databaseFingerprint())) {
			throw error("CONTENT_MIGRATION_SOURCE_CHANGED", "리뷰를 가져오는 동안 DB snapshot이 변경되었습니다.", 409);
		}
		List<ThreadTarget> currentTargets = loadTargets(workspaceId);
		if (!targets.equals(currentTargets)) {
			throw error("CONTENT_MIGRATION_SOURCE_CHANGED", "리뷰 thread가 변경되어 다시 검증해야 합니다.", 409);
		}

		jdbcTemplate.update(
			"DELETE FROM workspace_submission_reviews WHERE workspace_id = :workspaceId",
			Map.of("workspaceId", workspaceId)
		);
		rows.forEach(this::insertReview);
		Integer actualCount = jdbcTemplate.queryForObject(
			"SELECT COUNT(*) FROM workspace_submission_reviews WHERE workspace_id = :workspaceId",
			Map.of("workspaceId", workspaceId), Integer.class
		);
		String databaseFingerprint = fingerprint(jdbcTemplate.query("""
			SELECT legacy_import_hash
			FROM workspace_submission_reviews
			WHERE workspace_id = :workspaceId
			ORDER BY legacy_import_hash
			""", Map.of("workspaceId", workspaceId), (result, rowNumber) -> result.getString(1)));
		if (actualCount == null || actualCount != rows.size() || !fingerprint.equals(databaseFingerprint)) {
			throw error("CONTENT_MIGRATION_VERIFICATION_FAILED", "리뷰 DB 적재 결과가 Provider snapshot과 일치하지 않습니다.", 409);
		}
		int updatedReports = jdbcTemplate.update("""
			UPDATE workspace_content_migration_reports
			SET review_count = :reviewCount, review_fingerprint = :reviewFingerprint,
				reviews_pending = FALSE, verified_at = :verifiedAt
			WHERE workspace_id = :workspaceId AND status = 'BACKFILL_VERIFIED'
			""", new MapSqlParameterSource()
			.addValue("workspaceId", workspaceId)
			.addValue("reviewCount", actualCount)
			.addValue("reviewFingerprint", databaseFingerprint)
			.addValue("verifiedAt", verifiedAt));
		if (updatedReports != 1) {
			throw error("CONTENT_MIGRATION_SOURCE_CHANGED", "리뷰 검증 중 전환 보고서가 변경되었습니다.", 409);
		}
		return new ReviewImportReport(workspaceId, actualCount, fingerprint, databaseFingerprint, false, verifiedAt);
	}

	private ReviewRow reviewRow(
		WorkspaceState workspace,
		ThreadTarget target,
		RepositoryDataPort.CommitComment comment
	) {
		String provider = workspace.repository().provider();
		String repositoryId = workspace.repository().externalRepositoryId();
		String commentId = required(comment.id(), "review.id");
		String authorUserId = linkedWorkspaceUser(
			workspace.id(), provider, comment.authorExternalId()
		);
		boolean linkedAuthor = StringUtils.hasText(authorUserId);
		String authorName = linkedAuthor
			? StringUtils.hasText(comment.authorName())
				? comment.authorName()
				: StringUtils.hasText(comment.authorUsername()) ? comment.authorUsername() : "알 수 없는 사용자"
			: "외부 사용자";
		String authorUsername = linkedAuthor ? comment.authorUsername() : null;
		String authorExternalId = linkedAuthor ? comment.authorExternalId() : null;
		String authorAvatarUrl = linkedAuthor ? comment.authorAvatarUrl() : null;
		OffsetDateTime createdAt = requiredTimestamp(comment.createdAt(), "review.createdAt");
		String id = stableId("review", provider, repositoryId, target.commitId(), commentId);
		String rowHash = hash(
			target.threadId(), provider, repositoryId, commentId, target.commitId(),
			Objects.toString(comment.body(), ""), authorName, authorUsername, authorExternalId,
			authorAvatarUrl, comment.createdAt()
		);
		return new ReviewRow(
			id, workspace.id(), target.threadId(), authorUserId, authorName, authorUsername,
			authorExternalId, authorAvatarUrl, Objects.toString(comment.body(), ""),
			"ACTIVE", provider, repositoryId, commentId, target.commitId(), rowHash, createdAt
		);
	}

	private String linkedWorkspaceUser(String workspaceId, String provider, String externalUserId) {
		if (!StringUtils.hasText(externalUserId)) return null;
		List<String> users = jdbcTemplate.query("""
			SELECT account.user_id
			FROM provider_accounts account
			JOIN workspace_memberships membership ON membership.user_id = account.user_id
			WHERE membership.workspace_id = :workspaceId
				AND account.provider = :provider
				AND account.external_user_id = :externalUserId
			""", Map.of(
				"workspaceId", workspaceId,
				"provider", provider,
				"externalUserId", externalUserId
			), (result, rowNumber) -> result.getString(1));
		return users.isEmpty() ? null : users.getFirst();
	}

	private MigrationMarker loadMarker(String workspaceId) {
		List<MigrationMarker> markers = jdbcTemplate.query("""
			SELECT source_fingerprint, database_fingerprint
			FROM workspace_content_migration_reports
			WHERE workspace_id = :workspaceId AND status = 'BACKFILL_VERIFIED'
			""", Map.of("workspaceId", workspaceId), (result, rowNumber) -> new MigrationMarker(
				result.getString("source_fingerprint"), result.getString("database_fingerprint")
			));
		if (markers.isEmpty()) {
			throw error("CONTENT_MIGRATION_BACKFILL_REQUIRED", "리뷰보다 일정·제출 snapshot을 먼저 검증해야 합니다.", 409);
		}
		MigrationMarker marker = markers.getFirst();
		if (!StringUtils.hasText(marker.sourceFingerprint())
			|| !marker.sourceFingerprint().equals(marker.databaseFingerprint())) {
			throw error("CONTENT_MIGRATION_VERIFICATION_FAILED", "일정·제출 snapshot의 원본과 DB 지문이 일치하지 않습니다.", 409);
		}
		return marker;
	}

	private List<ThreadTarget> loadTargets(String workspaceId) {
		return jdbcTemplate.query("""
			SELECT id, legacy_repository_commit_id
			FROM workspace_submission_threads
			WHERE workspace_id = :workspaceId
			ORDER BY id
			""", Map.of("workspaceId", workspaceId), (result, rowNumber) -> new ThreadTarget(
				result.getString("id"), result.getString("legacy_repository_commit_id")
			));
	}

	private void insertReview(ReviewRow row) {
		jdbcTemplate.update("""
			INSERT INTO workspace_submission_reviews (
				id, workspace_id, thread_id, author_user_id, author_name, author_username,
				author_provider_external_id, author_avatar_url, body, status,
				provider, external_repository_id, provider_comment_id, legacy_repository_commit_id,
				legacy_import_hash, created_at, updated_at, entity_version
			) VALUES (
				:id, :workspaceId, :threadId, :authorUserId, :authorName, :authorUsername,
				:authorExternalId, :authorAvatarUrl, :body, :status,
				:provider, :repositoryId, :commentId, :commitId, :legacyImportHash,
				:createdAt, :createdAt, 0
			)
			""", new MapSqlParameterSource()
			.addValue("id", row.id()).addValue("workspaceId", row.workspaceId()).addValue("threadId", row.threadId())
			.addValue("authorUserId", row.authorUserId()).addValue("authorName", row.authorName())
			.addValue("authorUsername", row.authorUsername()).addValue("authorExternalId", row.authorExternalId())
			.addValue("authorAvatarUrl", row.authorAvatarUrl()).addValue("body", row.body())
			.addValue("status", row.status()).addValue("provider", row.provider())
			.addValue("repositoryId", row.repositoryId()).addValue("commentId", row.commentId())
			.addValue("commitId", row.commitId()).addValue("legacyImportHash", row.legacyImportHash())
			.addValue("createdAt", row.createdAt()));
	}

	private String fingerprint(List<String> hashes) {
		return hash(hashes.stream().sorted().toList());
	}

	private String hash(Object... values) {
		try {
			byte[] canonical = objectMapper.writeValueAsBytes(Arrays.asList(values));
			return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(canonical));
		} catch (Exception exception) {
			throw new IllegalStateException("리뷰 전환 hash를 계산하지 못했습니다.", exception);
		}
	}

	private static String stableId(String namespace, String... values) {
		String material = namespace + "\0" + String.join("\0", values);
		return UUID.nameUUIDFromBytes(material.getBytes(StandardCharsets.UTF_8)).toString();
	}

	private static OffsetDateTime requiredTimestamp(String value, String field) {
		if (!StringUtils.hasText(value)) throw invalid(field + " 값이 필요합니다.");
		try {
			return OffsetDateTime.parse(value);
		} catch (DateTimeParseException exception) {
			throw invalid(field + " 값이 올바른 ISO-8601 시간이 아닙니다.");
		}
	}

	private static String required(String value, String field) {
		if (!StringUtils.hasText(value)) throw invalid(field + " 값이 필요합니다.");
		return value;
	}

	private static WorkspaceException invalid(String message) {
		return error("CONTENT_MIGRATION_SOURCE_INVALID", message, 422);
	}

	private static WorkspaceException error(String code, String message, int status) {
		return new WorkspaceException(code, message, status);
	}

	public record ReviewImportReport(
		String workspaceId,
		int reviewCount,
		String sourceFingerprint,
		String databaseFingerprint,
		boolean reviewsPending,
		OffsetDateTime verifiedAt
	) { }

	private record MigrationMarker(String sourceFingerprint, String databaseFingerprint) { }
	private record ThreadTarget(String threadId, String commitId) { }
	private record ReviewRow(
		String id, String workspaceId, String threadId, String authorUserId, String authorName, String authorUsername,
		String authorExternalId, String authorAvatarUrl, String body, String status, String provider,
		String repositoryId, String commentId, String commitId,
		String legacyImportHash, OffsetDateTime createdAt
	) { }
}
