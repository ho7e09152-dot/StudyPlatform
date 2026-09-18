package com.studyworkspace.workspace.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import com.studyworkspace.workspace.domain.WorkspaceException;
import com.studyworkspace.workspace.domain.WorkspaceModels.MemberSubmissionFile;
import com.studyworkspace.workspace.domain.WorkspaceModels.SessionItem;
import com.studyworkspace.workspace.domain.WorkspaceModels.StudyMember;
import com.studyworkspace.workspace.domain.WorkspaceModels.StudySession;
import com.studyworkspace.workspace.domain.WorkspaceModels.SubmissionEntry;
import com.studyworkspace.workspace.domain.WorkspaceModels.WorkspaceState;
import com.studyworkspace.workspace.infrastructure.WorkspaceStateEntity;
import com.studyworkspace.workspace.infrastructure.WorkspaceStateRepository;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import tools.jackson.databind.ObjectMapper;

/** Stages a verified, repeatable DB snapshot without changing the active source of truth. */
@Service
public class WorkspaceContentMigrationService {
	private static final Set<String> MEMBERSHIP_ROLES = Set.of("OWNER", "MANAGER", "MEMBER");
	private static final String REPOSITORY_PRIMARY = "REPOSITORY_PRIMARY";

	private final WorkspaceStateRepository stateRepository;
	private final NamedParameterJdbcTemplate jdbcTemplate;
	private final ObjectMapper objectMapper;

	public WorkspaceContentMigrationService(
		WorkspaceStateRepository stateRepository,
		NamedParameterJdbcTemplate jdbcTemplate,
		ObjectMapper objectMapper
	) {
		this.stateRepository = stateRepository;
		this.jdbcTemplate = jdbcTemplate;
		this.objectMapper = objectMapper;
	}

	@Transactional
	public BackfillReport stageLegacySnapshot(String workspaceId) {
		WorkspaceStateEntity entity = stateRepository.findForContentMigration(workspaceId)
			.orElseThrow(() -> error("WORKSPACE_NOT_FOUND", "Workspace를 찾을 수 없습니다.", 404));
		if (!REPOSITORY_PRIMARY.equals(entity.storageMode())) {
			throw error("CONTENT_MIGRATION_MODE_CONFLICT", "Repository 정본 Workspace만 다시 적재할 수 있습니다.", 409);
		}

		WorkspaceState source = entity.toState(objectMapper);
		MigrationPlan plan = buildPlan(source);
		List<PreservedReviewRow> preservedReviews = loadReviews(workspaceId);
		OffsetDateTime startedAt = OffsetDateTime.now(ZoneOffset.UTC);
		jdbcTemplate.update("""
			UPDATE workspace_metadata
			SET content_migration_started_at = COALESCE(content_migration_started_at, :startedAt)
			WHERE id = :workspaceId AND storage_mode = 'REPOSITORY_PRIMARY'
			""", new MapSqlParameterSource()
			.addValue("workspaceId", workspaceId)
			.addValue("startedAt", startedAt));

		upsertMemberships(plan.memberships());
		jdbcTemplate.update(
			"DELETE FROM workspace_sessions WHERE workspace_id = :workspaceId",
			Map.of("workspaceId", workspaceId)
		);
		plan.sessions().forEach(this::insertSession);
		plan.items().forEach(this::insertItem);
		plan.threads().forEach(this::insertThread);
		plan.submissions().forEach(this::insertSubmission);
		plan.reflections().forEach(this::insertReflection);
		restoreReviews(preservedReviews, plan.threads().stream().map(ThreadRow::id).collect(java.util.stream.Collectors.toSet()));

		Counts actualCounts = loadCounts(workspaceId);
		String databaseFingerprint = fingerprint(loadDatabaseHashes(workspaceId));
		if (!plan.counts().equals(actualCounts) || !plan.sourceFingerprint().equals(databaseFingerprint)) {
			throw error("CONTENT_MIGRATION_VERIFICATION_FAILED", "DB 적재 결과가 Repository snapshot과 일치하지 않습니다.", 409);
		}

		OffsetDateTime verifiedAt = OffsetDateTime.now(ZoneOffset.UTC);
		upsertReport(source, plan, databaseFingerprint, verifiedAt);
		return new BackfillReport(
			workspaceId,
			"BACKFILL_VERIFIED",
			actualCounts.sessions(),
			actualCounts.items(),
			actualCounts.threads(),
			actualCounts.submissions(),
			actualCounts.reflections(),
			plan.sourceFingerprint(),
			databaseFingerprint,
			true,
			verifiedAt
		);
	}

	private MigrationPlan buildPlan(WorkspaceState workspace) {
		Map<String, MemberBinding> members = memberBindings(workspace);
		Map<String, StudySession> sessionsByFolder = new HashMap<>();
		List<SessionRow> sessions = new ArrayList<>();
		List<ItemRow> items = new ArrayList<>();
		List<ThreadRow> threads = new ArrayList<>();
		List<SubmissionRow> submissions = new ArrayList<>();
		List<ReflectionRow> reflections = new ArrayList<>();
		Map<String, String> hashes = new LinkedHashMap<>();

		workspace.sessions().values().stream().sorted(Comparator.comparing(StudySession::date)).forEach(session -> {
			if (sessionsByFolder.putIfAbsent(session.folder(), session) != null) {
				throw invalid("동일한 Repository 일정 폴더가 중복되었습니다: " + session.folder());
			}
			String sessionId = stableId("session", workspace.id(), session.date());
			MemberBinding createdBy = actor(members, session.createdBy());
			MemberBinding updatedBy = actor(members, session.updatedBy());
			String path = WorkspaceRepositoryLayout.sessionPath(workspace, session);
			String sessionHash = hash(
				session.date(), session.folder(), session.revision(), session.type(), session.title(), session.description(),
				session.status(), session.deadline(), session.secondaryDeadline(), session.createdAt(), session.createdBy(),
				session.updatedAt(), session.updatedBy(), session.change() == null ? null : session.change().message(),
				session.change() == null ? null : session.change().reason(), path, session.lastCommitId()
			);
			sessions.add(new SessionRow(
				sessionId, workspace.id(), requiredDate(session.date()), session.revision(), required(session.type(), "session.type"),
				required(session.title(), "session.title"), session.description(), required(session.status(), "session.status"),
				optionalTimestamp(session.deadline(), "session.deadline"),
				optionalTimestamp(session.secondaryDeadline(), "session.secondaryDeadline"),
				createdBy == null ? null : createdBy.userId(), session.createdBy(),
				updatedBy == null ? null : updatedBy.userId(), session.updatedBy(),
				session.change() == null ? null : session.change().message(),
				session.change() == null ? null : session.change().reason(),
				requiredTimestamp(session.createdAt(), "session.createdAt"),
				requiredTimestamp(session.updatedAt(), "session.updatedAt"), path, session.lastCommitId(), sessionHash
			));
			hashes.put("session:" + sessionId, sessionHash);
			appendItems(session.items(), "ACTIVE", sessionId, items, hashes);
			appendItems(session.archivedItems(), "ARCHIVED", sessionId, items, hashes);
		});

		workspace.submissions().values().stream()
			.sorted(Comparator.comparing(MemberSubmissionFile::date).thenComparing(MemberSubmissionFile::memberId))
			.forEach(file -> {
				StudySession session = sessionsByFolder.get(file.date());
				if (session == null) throw invalid("제출에 대응하는 일정을 찾을 수 없습니다: " + file.date());
				String sessionId = stableId("session", workspace.id(), session.date());
				MemberBinding member = members.get(file.memberId());
				String memberId = member == null
					? stableId("member", workspace.id(), "legacy:" + file.memberId())
					: member.contentMemberId();
				String userId = member == null ? null : member.userId();
				String displayName = member == null ? file.username() : member.displayName();
				String path = member == null ? null : WorkspaceRepositoryLayout.submissionPath(workspace, session, member.fileName());
				String threadId = stableId("thread", workspace.id(), session.date(), memberId);
				OffsetDateTime threadUpdatedAt = requiredTimestamp(file.updatedAt(), "submissionFile.updatedAt");
				String threadHash = hash(
					session.date(), memberId, displayName, file.sessionRevision(), path, file.lastCommitId(),
					file.lastCommitMessage(), file.updatedAt()
				);
				threads.add(new ThreadRow(
					threadId, workspace.id(), sessionId, memberId, userId, displayName, file.sessionRevision(), path,
					file.lastCommitId(), file.lastCommitMessage(), threadUpdatedAt, threadHash
				));
				hashes.put("thread:" + threadId, threadHash);
				Set<String> sessionItemIds = java.util.stream.Stream.concat(
					list(session.items()).stream(), list(session.archivedItems()).stream()
				).map(SessionItem::id).collect(java.util.stream.Collectors.toSet());
				for (SubmissionEntry entry : list(file.submissions())) {
					if (!sessionItemIds.contains(entry.itemId())) {
						throw invalid("제출 항목이 일정에 없습니다: " + entry.itemId());
					}
					String submissionId = stableId("submission", threadId, entry.itemId());
					String answerType = required(entry.type(), "submission.type").toUpperCase();
					String textAnswer = "LINK".equals(answerType) ? null : entry.value();
					String linkUrl = "LINK".equals(answerType) ? entry.value() : null;
					String rowHash = hash(
						session.date(), memberId, entry.itemId(), answerType, textAnswer, linkUrl, entry.language(),
						entry.submittedAt(), entry.updatedAt(), file.sessionRevision(), path, file.lastCommitId(),
						file.lastCommitMessage()
					);
					submissions.add(new SubmissionRow(
						submissionId, workspace.id(), sessionId, threadId, entry.itemId(), memberId, userId, displayName,
						answerType, textAnswer, linkUrl, entry.language(), "SUBMITTED", file.sessionRevision(), path,
						file.lastCommitId(), file.lastCommitMessage(),
						requiredTimestamp(entry.submittedAt(), "submission.submittedAt"),
						requiredTimestamp(entry.updatedAt(), "submission.updatedAt"), rowHash
					));
					hashes.put("submission:" + submissionId, rowHash);
				}
				if (StringUtils.hasText(file.reflection())) {
					String rowHash = hash(
						session.date(), memberId, file.reflection(), file.sessionRevision(), path,
						file.lastCommitId(), file.updatedAt()
					);
					reflections.add(new ReflectionRow(
						threadId, sessionId, workspace.id(), memberId, userId, displayName, file.reflection(), file.sessionRevision(),
						path, file.lastCommitId(), requiredTimestamp(file.updatedAt(), "reflection.updatedAt"), rowHash
					));
					hashes.put("reflection:" + threadId, rowHash);
				}
			});

		List<MembershipRow> memberships = members.values().stream()
			.filter(member -> member.userId() != null)
			.map(member -> new MembershipRow(workspace.id(), member.userId(), member.role(), member.status()))
			.toList();
		Counts counts = new Counts(sessions.size(), items.size(), threads.size(), submissions.size(), reflections.size());
		return new MigrationPlan(
			memberships, List.copyOf(sessions), List.copyOf(items), List.copyOf(threads),
			List.copyOf(submissions), List.copyOf(reflections),
			counts, fingerprint(hashes)
		);
	}

	private Map<String, MemberBinding> memberBindings(WorkspaceState workspace) {
		Map<String, MemberBinding> bindings = new HashMap<>();
		for (StudyMember member : list(workspace.members())) {
			String userId = existingUserId(member.userId());
			String stableMemberKey = userId == null ? "legacy:" + member.id() : "user:" + userId;
			bindings.put(member.id(), new MemberBinding(
				stableId("member", workspace.id(), stableMemberKey), userId, member.username(), member.displayName(),
				member.fileName(), membershipRole(member.role()), required(member.status(), "member.status")
			));
		}
		return bindings;
	}

	private String existingUserId(String userId) {
		if (!StringUtils.hasText(userId)) return null;
		Integer count = jdbcTemplate.queryForObject(
			"SELECT COUNT(*) FROM user_accounts WHERE id = :userId", Map.of("userId", userId), Integer.class
		);
		return count != null && count == 1 ? userId : null;
	}

	private static MemberBinding actor(Map<String, MemberBinding> members, String name) {
		if (!StringUtils.hasText(name)) return null;
		return members.values().stream()
			.filter(member -> member.userId() != null)
			.filter(member -> name.equals(member.username()) || name.equals(member.displayName()))
			.findFirst().orElse(null);
	}

	private void appendItems(
		List<SessionItem> source,
		String lifecycle,
		String sessionId,
		List<ItemRow> target,
		Map<String, String> hashes
	) {
		Set<String> itemIds = new java.util.HashSet<>();
		for (SessionItem item : list(source)) {
			if (!itemIds.add(item.id())) throw invalid("동일한 lifecycle의 항목 ID가 중복되었습니다: " + item.id());
			String rowHash = hash(
				item.id(), lifecycle, item.order(), item.title(), item.type(), item.source(), item.url(), item.submitType(),
				item.required(), item.status(), item.replaces(), item.replacedBy()
			);
			target.add(new ItemRow(
				sessionId, required(item.id(), "item.id"), lifecycle, item.order(), required(item.title(), "item.title"),
				required(item.type(), "item.type"), item.source(), item.url(), item.submitType(), item.required(),
				required(item.status(), "item.status"), item.replaces(), item.replacedBy(), rowHash
			));
			hashes.put("item:" + sessionId + ":" + item.id() + ":" + lifecycle, rowHash);
		}
	}

	private void upsertMemberships(List<MembershipRow> memberships) {
		for (MembershipRow membership : memberships) {
			Map<String, Object> values = Map.of(
				"workspaceId", membership.workspaceId(),
				"userId", membership.userId(),
				"role", membership.role(),
				"status", membership.status()
			);
			int updated = jdbcTemplate.update("""
				UPDATE workspace_memberships
				SET role = :role, status = :status
				WHERE workspace_id = :workspaceId AND user_id = :userId
				""", values);
			if (updated == 0) {
				jdbcTemplate.update("""
					INSERT INTO workspace_memberships (workspace_id, user_id, role, status, joined_at)
					VALUES (:workspaceId, :userId, :role, :status, CURRENT_TIMESTAMP)
					""", values);
			}
		}
	}

	private void insertSession(SessionRow row) {
		jdbcTemplate.update("""
			INSERT INTO workspace_sessions (
				id, workspace_id, session_date, revision, session_type, title, description, status,
				deadline_at, secondary_deadline_at, created_by_user_id, created_by_name,
				updated_by_user_id, updated_by_name, change_message, change_reason, created_at, updated_at,
				legacy_repository_path, legacy_repository_commit_id, legacy_import_hash, entity_version
			) VALUES (
				:id, :workspaceId, :sessionDate, :revision, :sessionType, :title, :description, :status,
				:deadlineAt, :secondaryDeadlineAt, :createdByUserId, :createdByName,
				:updatedByUserId, :updatedByName, :changeMessage, :changeReason, :createdAt, :updatedAt,
				:legacyPath, :legacyCommitId, :legacyImportHash, 0
			)
			""", new MapSqlParameterSource()
			.addValue("id", row.id()).addValue("workspaceId", row.workspaceId())
			.addValue("sessionDate", row.sessionDate()).addValue("revision", row.revision())
			.addValue("sessionType", row.sessionType()).addValue("title", row.title())
			.addValue("description", row.description()).addValue("status", row.status())
			.addValue("deadlineAt", row.deadlineAt()).addValue("secondaryDeadlineAt", row.secondaryDeadlineAt())
			.addValue("createdByUserId", row.createdByUserId()).addValue("createdByName", row.createdByName())
			.addValue("updatedByUserId", row.updatedByUserId()).addValue("updatedByName", row.updatedByName())
			.addValue("changeMessage", row.changeMessage()).addValue("changeReason", row.changeReason())
			.addValue("createdAt", row.createdAt()).addValue("updatedAt", row.updatedAt())
			.addValue("legacyPath", row.legacyPath()).addValue("legacyCommitId", row.legacyCommitId())
			.addValue("legacyImportHash", row.legacyImportHash()));
	}

	private void insertItem(ItemRow row) {
		jdbcTemplate.update("""
			INSERT INTO workspace_session_items (
				session_id, item_id, lifecycle, item_order, title, item_type, source_name, source_url,
				submit_type, required, status, replaces_item_id, replaced_by_item_id, legacy_import_hash,
				created_at, updated_at
			) VALUES (
				:sessionId, :itemId, :lifecycle, :itemOrder, :title, :itemType, :sourceName, :sourceUrl,
				:submitType, :required, :status, :replacesItemId, :replacedByItemId, :legacyImportHash,
				CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
			)
			""", new MapSqlParameterSource()
			.addValue("sessionId", row.sessionId()).addValue("itemId", row.itemId())
			.addValue("lifecycle", row.lifecycle()).addValue("itemOrder", row.itemOrder())
			.addValue("title", row.title()).addValue("itemType", row.itemType())
			.addValue("sourceName", row.sourceName()).addValue("sourceUrl", row.sourceUrl())
			.addValue("submitType", row.submitType()).addValue("required", row.required())
			.addValue("status", row.status()).addValue("replacesItemId", row.replacesItemId())
			.addValue("replacedByItemId", row.replacedByItemId()).addValue("legacyImportHash", row.legacyImportHash()));
	}

	private void insertThread(ThreadRow row) {
		jdbcTemplate.update("""
			INSERT INTO workspace_submission_threads (
				id, workspace_id, session_id, member_id, member_user_id, member_display_name,
				source_session_revision, legacy_repository_path, legacy_repository_commit_id,
				legacy_repository_commit_message, legacy_import_hash, created_at, updated_at, entity_version
			) VALUES (
				:id, :workspaceId, :sessionId, :memberId, :memberUserId, :memberDisplayName,
				:sourceSessionRevision, :legacyPath, :legacyCommitId,
				:legacyCommitMessage, :legacyImportHash, :updatedAt, :updatedAt, 0
			)
			""", new MapSqlParameterSource()
			.addValue("id", row.id()).addValue("workspaceId", row.workspaceId())
			.addValue("sessionId", row.sessionId()).addValue("memberId", row.memberId())
			.addValue("memberUserId", row.memberUserId()).addValue("memberDisplayName", row.memberDisplayName())
			.addValue("sourceSessionRevision", row.sourceSessionRevision()).addValue("legacyPath", row.legacyPath())
			.addValue("legacyCommitId", row.legacyCommitId()).addValue("legacyCommitMessage", row.legacyCommitMessage())
			.addValue("legacyImportHash", row.legacyImportHash()).addValue("updatedAt", row.updatedAt()));
	}

	private void insertSubmission(SubmissionRow row) {
		jdbcTemplate.update("""
			INSERT INTO workspace_submissions (
				id, workspace_id, session_id, thread_id, item_id, member_id, member_user_id, member_display_name,
				answer_type, text_answer, link_url, language, status, source_session_revision,
				legacy_repository_path, legacy_repository_commit_id, legacy_repository_commit_message,
				legacy_import_hash, submitted_at, updated_at, entity_version
			) VALUES (
				:id, :workspaceId, :sessionId, :threadId, :itemId, :memberId, :memberUserId, :memberDisplayName,
				:answerType, :textAnswer, :linkUrl, :language, :status, :sourceSessionRevision,
				:legacyPath, :legacyCommitId, :legacyCommitMessage, :legacyImportHash,
				:submittedAt, :updatedAt, 0
			)
			""", new MapSqlParameterSource()
			.addValue("id", row.id()).addValue("workspaceId", row.workspaceId())
			.addValue("sessionId", row.sessionId()).addValue("threadId", row.threadId()).addValue("itemId", row.itemId())
			.addValue("memberId", row.memberId()).addValue("memberUserId", row.memberUserId())
			.addValue("memberDisplayName", row.memberDisplayName()).addValue("answerType", row.answerType())
			.addValue("textAnswer", row.textAnswer()).addValue("linkUrl", row.linkUrl())
			.addValue("language", row.language()).addValue("status", row.status())
			.addValue("sourceSessionRevision", row.sourceSessionRevision()).addValue("legacyPath", row.legacyPath())
			.addValue("legacyCommitId", row.legacyCommitId()).addValue("legacyCommitMessage", row.legacyCommitMessage())
			.addValue("legacyImportHash", row.legacyImportHash()).addValue("submittedAt", row.submittedAt())
			.addValue("updatedAt", row.updatedAt()));
	}

	private void insertReflection(ReflectionRow row) {
		jdbcTemplate.update("""
			INSERT INTO workspace_session_reflections (
				thread_id, session_id, workspace_id, member_id, member_user_id, member_display_name, body,
				source_session_revision, legacy_repository_path, legacy_repository_commit_id,
				legacy_import_hash, created_at, updated_at, entity_version
			) VALUES (
				:threadId, :sessionId, :workspaceId, :memberId, :memberUserId, :memberDisplayName, :body,
				:sourceSessionRevision, :legacyPath, :legacyCommitId, :legacyImportHash, :updatedAt, :updatedAt, 0
			)
			""", new MapSqlParameterSource()
			.addValue("threadId", row.threadId()).addValue("sessionId", row.sessionId()).addValue("workspaceId", row.workspaceId())
			.addValue("memberId", row.memberId()).addValue("memberUserId", row.memberUserId())
			.addValue("memberDisplayName", row.memberDisplayName()).addValue("body", row.body())
			.addValue("sourceSessionRevision", row.sourceSessionRevision()).addValue("legacyPath", row.legacyPath())
			.addValue("legacyCommitId", row.legacyCommitId()).addValue("legacyImportHash", row.legacyImportHash())
			.addValue("updatedAt", row.updatedAt()));
	}

	private List<PreservedReviewRow> loadReviews(String workspaceId) {
		return jdbcTemplate.query("""
			SELECT id, workspace_id, thread_id, author_user_id, author_name, author_username,
				author_provider_external_id, author_avatar_url, body, status, provider,
				external_repository_id, provider_comment_id, legacy_repository_commit_id,
				legacy_import_hash, created_at, updated_at, entity_version
			FROM workspace_submission_reviews
			WHERE workspace_id = :workspaceId
			ORDER BY id
			""", Map.of("workspaceId", workspaceId), (result, rowNumber) -> new PreservedReviewRow(
			result.getString("id"), result.getString("workspace_id"), result.getString("thread_id"),
			result.getString("author_user_id"), result.getString("author_name"), result.getString("author_username"),
			result.getString("author_provider_external_id"), result.getString("author_avatar_url"),
			result.getString("body"), result.getString("status"), result.getString("provider"),
			result.getString("external_repository_id"), result.getString("provider_comment_id"),
			result.getString("legacy_repository_commit_id"), result.getString("legacy_import_hash"),
			result.getObject("created_at", OffsetDateTime.class), result.getObject("updated_at", OffsetDateTime.class),
			result.getLong("entity_version")
		));
	}

	private void restoreReviews(List<PreservedReviewRow> reviews, Set<String> currentThreadIds) {
		for (PreservedReviewRow row : reviews) {
			if (!currentThreadIds.contains(row.threadId())) continue;
			jdbcTemplate.update("""
				INSERT INTO workspace_submission_reviews (
					id, workspace_id, thread_id, author_user_id, author_name, author_username,
					author_provider_external_id, author_avatar_url, body, status, provider,
					external_repository_id, provider_comment_id, legacy_repository_commit_id,
					legacy_import_hash, created_at, updated_at, entity_version
				) VALUES (
					:id, :workspaceId, :threadId, :authorUserId, :authorName, :authorUsername,
					:authorExternalId, :authorAvatarUrl, :body, :status, :provider,
					:repositoryId, :commentId, :commitId, :legacyImportHash,
					:createdAt, :updatedAt, :entityVersion
				)
				""", new MapSqlParameterSource()
				.addValue("id", row.id()).addValue("workspaceId", row.workspaceId()).addValue("threadId", row.threadId())
				.addValue("authorUserId", row.authorUserId()).addValue("authorName", row.authorName())
				.addValue("authorUsername", row.authorUsername()).addValue("authorExternalId", row.authorExternalId())
				.addValue("authorAvatarUrl", row.authorAvatarUrl()).addValue("body", row.body())
				.addValue("status", row.status()).addValue("provider", row.provider())
				.addValue("repositoryId", row.repositoryId()).addValue("commentId", row.commentId())
				.addValue("commitId", row.commitId()).addValue("legacyImportHash", row.legacyImportHash())
				.addValue("createdAt", row.createdAt()).addValue("updatedAt", row.updatedAt())
				.addValue("entityVersion", row.entityVersion()));
		}
	}

	private Counts loadCounts(String workspaceId) {
		Map<String, Object> value = jdbcTemplate.queryForMap("""
			SELECT
				(SELECT COUNT(*) FROM workspace_sessions WHERE workspace_id = :workspaceId) AS sessions,
				(SELECT COUNT(*) FROM workspace_session_items item JOIN workspace_sessions session ON session.id = item.session_id WHERE session.workspace_id = :workspaceId) AS items,
				(SELECT COUNT(*) FROM workspace_submission_threads WHERE workspace_id = :workspaceId) AS threads,
				(SELECT COUNT(*) FROM workspace_submissions WHERE workspace_id = :workspaceId) AS submissions,
				(SELECT COUNT(*) FROM workspace_session_reflections WHERE workspace_id = :workspaceId) AS reflections
			""", Map.of("workspaceId", workspaceId));
		return new Counts(
			((Number) value.get("sessions")).intValue(),
			((Number) value.get("items")).intValue(),
			((Number) value.get("threads")).intValue(),
			((Number) value.get("submissions")).intValue(),
			((Number) value.get("reflections")).intValue()
		);
	}

	private Map<String, String> loadDatabaseHashes(String workspaceId) {
		Map<String, String> hashes = new LinkedHashMap<>();
		jdbcTemplate.query("""
			SELECT id, legacy_import_hash FROM workspace_sessions WHERE workspace_id = :workspaceId
			""", Map.of("workspaceId", workspaceId), (result, rowNumber) -> Map.entry(
				"session:" + result.getString("id"), result.getString("legacy_import_hash")
			)).forEach(entry -> hashes.put(entry.getKey(), entry.getValue()));
		jdbcTemplate.query("""
			SELECT item.session_id, item.item_id, item.lifecycle, item.legacy_import_hash
			FROM workspace_session_items item
			JOIN workspace_sessions session ON session.id = item.session_id
			WHERE session.workspace_id = :workspaceId
			""", Map.of("workspaceId", workspaceId), (result, rowNumber) -> Map.entry(
				"item:" + result.getString("session_id") + ":" + result.getString("item_id") + ":" + result.getString("lifecycle"),
				result.getString("legacy_import_hash")
			)).forEach(entry -> hashes.put(entry.getKey(), entry.getValue()));
		jdbcTemplate.query("""
			SELECT id, legacy_import_hash FROM workspace_submission_threads WHERE workspace_id = :workspaceId
			""", Map.of("workspaceId", workspaceId), (result, rowNumber) -> Map.entry(
				"thread:" + result.getString("id"), result.getString("legacy_import_hash")
			)).forEach(entry -> hashes.put(entry.getKey(), entry.getValue()));
		jdbcTemplate.query("""
			SELECT id, legacy_import_hash FROM workspace_submissions WHERE workspace_id = :workspaceId
			""", Map.of("workspaceId", workspaceId), (result, rowNumber) -> Map.entry(
				"submission:" + result.getString("id"), result.getString("legacy_import_hash")
			)).forEach(entry -> hashes.put(entry.getKey(), entry.getValue()));
		jdbcTemplate.query("""
			SELECT thread_id, legacy_import_hash
			FROM workspace_session_reflections WHERE workspace_id = :workspaceId
			""", Map.of("workspaceId", workspaceId), (result, rowNumber) -> Map.entry(
				"reflection:" + result.getString("thread_id"),
				result.getString("legacy_import_hash")
			)).forEach(entry -> hashes.put(entry.getKey(), entry.getValue()));
		return hashes;
	}

	private void upsertReport(
		WorkspaceState source,
		MigrationPlan plan,
		String databaseFingerprint,
		OffsetDateTime verifiedAt
	) {
		MapSqlParameterSource values = new MapSqlParameterSource()
			.addValue("workspaceId", source.id())
			.addValue("sourceLastSyncedAt", optionalTimestamp(source.lastSyncedAt(), "workspace.lastSyncedAt"))
			.addValue("sessionCount", plan.counts().sessions()).addValue("itemCount", plan.counts().items())
			.addValue("threadCount", plan.counts().threads())
			.addValue("submissionCount", plan.counts().submissions()).addValue("reflectionCount", plan.counts().reflections())
			.addValue("sourceFingerprint", plan.sourceFingerprint()).addValue("databaseFingerprint", databaseFingerprint)
			.addValue("verifiedAt", verifiedAt);
		int updated = jdbcTemplate.update("""
			UPDATE workspace_content_migration_reports
			SET status = 'BACKFILL_VERIFIED', source_last_synced_at = :sourceLastSyncedAt,
				session_count = :sessionCount, item_count = :itemCount, thread_count = :threadCount,
				submission_count = :submissionCount, reflection_count = :reflectionCount,
				source_fingerprint = :sourceFingerprint, database_fingerprint = :databaseFingerprint,
				review_count = NULL, review_fingerprint = NULL,
				reviews_pending = TRUE, verified_at = :verifiedAt
			WHERE workspace_id = :workspaceId
			""", values);
		if (updated == 0) {
			jdbcTemplate.update("""
				INSERT INTO workspace_content_migration_reports (
					workspace_id, status, source_last_synced_at, session_count, item_count, thread_count,
					submission_count, reflection_count, source_fingerprint, database_fingerprint,
					reviews_pending, verified_at
				) VALUES (
					:workspaceId, 'BACKFILL_VERIFIED', :sourceLastSyncedAt, :sessionCount, :itemCount, :threadCount,
					:submissionCount, :reflectionCount, :sourceFingerprint, :databaseFingerprint,
					TRUE, :verifiedAt
				)
				""", values);
		}
	}

	private String fingerprint(Map<String, String> hashes) {
		List<String> entries = hashes.entrySet().stream()
			.map(entry -> entry.getKey() + "=" + entry.getValue())
			.sorted()
			.toList();
		return hash(entries);
	}

	private String hash(Object... values) {
		try {
			byte[] canonical = objectMapper.writeValueAsBytes(Arrays.asList(values));
			return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(canonical));
		} catch (Exception exception) {
			throw new IllegalStateException("전환 검증 hash를 계산하지 못했습니다.", exception);
		}
	}

	private static String stableId(String namespace, String... values) {
		String material = namespace + "\0" + String.join("\0", values);
		return UUID.nameUUIDFromBytes(material.getBytes(StandardCharsets.UTF_8)).toString();
	}

	private static LocalDate requiredDate(String value) {
		try {
			return LocalDate.parse(value);
		} catch (DateTimeParseException | NullPointerException exception) {
			throw invalid("일정 날짜가 올바르지 않습니다: " + value);
		}
	}

	private static OffsetDateTime requiredTimestamp(String value, String field) {
		OffsetDateTime parsed = optionalTimestamp(value, field);
		if (parsed == null) throw invalid(field + " 값이 필요합니다.");
		return parsed;
	}

	private static OffsetDateTime optionalTimestamp(String value, String field) {
		if (!StringUtils.hasText(value)) return null;
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

	private static String membershipRole(String value) {
		return MEMBERSHIP_ROLES.contains(value) ? value : "MEMBER";
	}

	private static <T> List<T> list(List<T> value) {
		return value == null ? List.of() : value;
	}

	private static WorkspaceException invalid(String message) {
		return error("CONTENT_MIGRATION_SOURCE_INVALID", message, 422);
	}

	private static WorkspaceException error(String code, String message, int status) {
		return new WorkspaceException(code, message, status);
	}

	public record BackfillReport(
		String workspaceId,
		String status,
		int sessionCount,
		int itemCount,
		int threadCount,
		int submissionCount,
		int reflectionCount,
		String sourceFingerprint,
		String databaseFingerprint,
		boolean reviewsPending,
		OffsetDateTime verifiedAt
	) { }

	private record MigrationPlan(
		List<MembershipRow> memberships,
		List<SessionRow> sessions,
		List<ItemRow> items,
		List<ThreadRow> threads,
		List<SubmissionRow> submissions,
		List<ReflectionRow> reflections,
		Counts counts,
		String sourceFingerprint
	) { }

	private record Counts(int sessions, int items, int threads, int submissions, int reflections) { }
	private record MembershipRow(String workspaceId, String userId, String role, String status) { }
	private record MemberBinding(
		String contentMemberId,
		String userId,
		String username,
		String displayName,
		String fileName,
		String role,
		String status
	) { }
	private record SessionRow(
		String id, String workspaceId, LocalDate sessionDate, int revision, String sessionType, String title,
		String description, String status, OffsetDateTime deadlineAt, OffsetDateTime secondaryDeadlineAt,
		String createdByUserId, String createdByName, String updatedByUserId, String updatedByName,
		String changeMessage, String changeReason, OffsetDateTime createdAt, OffsetDateTime updatedAt,
		String legacyPath, String legacyCommitId, String legacyImportHash
	) { }
	private record ItemRow(
		String sessionId, String itemId, String lifecycle, int itemOrder, String title, String itemType,
		String sourceName, String sourceUrl, String submitType, boolean required, String status,
		String replacesItemId, String replacedByItemId, String legacyImportHash
	) { }
	private record ThreadRow(
		String id, String workspaceId, String sessionId, String memberId, String memberUserId,
		String memberDisplayName, int sourceSessionRevision, String legacyPath, String legacyCommitId,
		String legacyCommitMessage, OffsetDateTime updatedAt, String legacyImportHash
	) { }
	private record SubmissionRow(
		String id, String workspaceId, String sessionId, String threadId, String itemId, String memberId, String memberUserId,
		String memberDisplayName, String answerType, String textAnswer, String linkUrl, String language, String status,
		int sourceSessionRevision, String legacyPath, String legacyCommitId, String legacyCommitMessage,
		OffsetDateTime submittedAt, OffsetDateTime updatedAt, String legacyImportHash
	) { }
	private record ReflectionRow(
		String threadId, String sessionId, String workspaceId, String memberId, String memberUserId, String memberDisplayName,
		String body, int sourceSessionRevision, String legacyPath, String legacyCommitId,
		OffsetDateTime updatedAt, String legacyImportHash
	) { }
	private record PreservedReviewRow(
		String id, String workspaceId, String threadId, String authorUserId, String authorName,
		String authorUsername, String authorExternalId, String authorAvatarUrl, String body, String status,
		String provider, String repositoryId, String commentId, String commitId, String legacyImportHash,
		OffsetDateTime createdAt, OffsetDateTime updatedAt, long entityVersion
	) { }
}
