package com.studyworkspace.workspace.service;

import static com.studyworkspace.workspace.domain.WorkspaceModels.*;

import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.OffsetDateTime;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
import com.studyworkspace.workspace.domain.WorkspaceException;
import com.studyworkspace.gitlab.dto.GitLabUser;
import com.studyworkspace.workspace.infrastructure.WorkspaceStateEntity;
import com.studyworkspace.workspace.infrastructure.WorkspaceStateRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.util.StringUtils;
import org.springframework.orm.ObjectOptimisticLockingFailureException;

@Service
public class WorkspaceService {
	private static final Logger log = LoggerFactory.getLogger(WorkspaceService.class);

	private static final Set<String> SESSION_TYPES = Set.of("algorithm", "english", "cs", "free");
	private static final Set<String> SUBMISSION_TYPES = Set.of("link", "text", "code", "mixed");
	private final Map<String, WorkspaceState> workspaces = new ConcurrentHashMap<>();
	private final Set<String> dirtyWorkspaceIds = ConcurrentHashMap.newKeySet();
	private final ObjectMapper objectMapper;
	private final Path persistencePath;
	private final boolean seedEnabled;
	private final WorkspaceStateRepository stateRepository;

	@FunctionalInterface
	public interface SessionWriter {
		String write(WorkspaceState workspace, StudySession current, StudySession next);
	}

	@FunctionalInterface
	public interface SubmissionWriter {
		String write(
			WorkspaceState workspace,
			StudySession session,
			StudyMember member,
			MemberSubmissionFile current,
			MemberSubmissionFile next,
			String commitMessage
		);
	}

	@Autowired
	public WorkspaceService(
		ObjectMapper objectMapper,
		WorkspaceStateRepository stateRepository,
		@Value("${app.demo.persistence-path:.data/workspaces-production.json}") String legacyPersistencePath,
		@Value("${app.demo.seed-enabled:false}") boolean seedEnabled
	) {
		this.objectMapper = objectMapper;
		this.persistencePath = Path.of(legacyPersistencePath).toAbsolutePath().normalize();
		this.seedEnabled = seedEnabled;
		this.stateRepository = stateRepository;
		loadState().forEach(workspace -> workspaces.put(workspace.id(), workspace));
	}

	public WorkspaceService(
		ObjectMapper objectMapper,
		@Value("${app.demo.persistence-path:.data/workspaces-production.json}") String persistencePath,
		@Value("${app.demo.seed-enabled:false}") boolean seedEnabled
	) {
		this.objectMapper = objectMapper;
		this.persistencePath = Path.of(persistencePath).toAbsolutePath().normalize();
		this.seedEnabled = seedEnabled;
		this.stateRepository = null;
		loadState().forEach(workspace -> workspaces.put(workspace.id(), workspace));
	}

	public List<WorkspaceState> list(long gitLabUserId) {
		refreshAllFromDatabase();
		return workspaces.values().stream()
			.filter(workspace -> "ACTIVE".equals(workspace.status()))
			.filter(workspace -> workspace.members().stream().anyMatch(member ->
				member.gitlabUserId() == gitLabUserId && "ACTIVE".equals(member.status())
			))
			.sorted(Comparator.comparing(WorkspaceState::name))
			.toList();
	}

	public WorkspaceState get(String workspaceId) {
		WorkspaceState workspace = stateRepository == null
			? workspaces.get(workspaceId)
			: stateRepository.findById(workspaceId)
				.map(entity -> entity.toState(objectMapper))
				.map(WorkspaceService::normalizeMemberRoles)
				.orElse(null);
		if (workspace != null && stateRepository != null) workspaces.put(workspaceId, workspace);
		if (workspace == null) {
			throw error("WORKSPACE_NOT_FOUND", "Workspace를 찾을 수 없습니다.", 404);
		}
		return workspace;
	}

	public synchronized WorkspaceState create(CreateWorkspaceRequest request, GitLabUser user) {
		refreshAllFromDatabase();
		if (request == null || !StringUtils.hasText(request.name()) || request.gitlabProjectId() <= 0 || !StringUtils.hasText(request.gitlabProjectPath())) {
			throw error("INVALID_REQUEST", "Workspace 이름과 GitLab 프로젝트 정보가 필요합니다.", 400);
		}
		if (user == null || user.id() <= 0 || !StringUtils.hasText(user.username())) {
			throw error("AUTH_REQUIRED", "GitLab 로그인이 필요합니다.", 401);
		}
		if (workspaces.values().stream().anyMatch(workspace -> workspace.gitlabProjectId() == request.gitlabProjectId())) {
			throw error("WORKSPACE_PROJECT_ALREADY_CONNECTED", "이미 연결되었거나 복원 가능한 GitLab 프로젝트입니다. 삭제 목록을 확인해 주세요.", 409);
		}
		String id = "workspace-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
		String displayName = StringUtils.hasText(user.name()) ? user.name().trim() : user.username();
		String avatar = displayName.substring(0, 1).toUpperCase();
		StudyMember owner = new StudyMember(
			"member-" + user.id(), user.id(), user.username(), displayName, avatar,
			"#6d52b5", safeMemberFileName(request.ownerRepositoryFileName(), user.username()), "OWNER", "ACTIVE", 40
		);
		WorkspaceState workspace = new WorkspaceState(
			id, request.name().trim(), request.gitlabProjectId(), request.gitlabProjectPath().trim(),
			StringUtils.hasText(request.defaultBranch()) ? request.defaultBranch().trim() : "main",
			WorkspaceRepositoryPath.normalizeBasePath(request.repositoryBasePath()), 1,
			StringUtils.hasText(request.importMode()) ? request.importMode() : "EMPTY", "ACTIVE", now(),
			List.of(owner), Map.of(), Map.of(),
			new WorkspaceSettings(
				StringUtils.hasText(request.timezone()) ? request.timezone().trim() : "Asia/Seoul",
				true,
				new Notifications(true, true, true)
			)
		);
		store(workspace);
		persist();
		return workspace;
	}

	public synchronized void rollbackCreate(String workspaceId) {
		workspaces.remove(workspaceId);
		dirtyWorkspaceIds.remove(workspaceId);
		if (stateRepository != null && stateRepository.existsById(workspaceId)) {
			stateRepository.deleteById(workspaceId);
			stateRepository.flush();
		}
	}

	public synchronized WorkspaceState update(String workspaceId, UpdateWorkspaceRequest request) {
		WorkspaceState current = get(workspaceId);
		if (request == null) throw error("INVALID_REQUEST", "수정할 값이 필요합니다.", 400);
		String name = StringUtils.hasText(request.name()) ? request.name().trim() : current.name();
		WorkspaceSettings settings = request.settings() == null ? current.settings() : request.settings();
		WorkspaceState updated = new WorkspaceState(
			current.id(), name, current.gitlabProjectId(), current.gitlabProjectPath(), current.defaultBranch(),
			current.repositoryBasePath(), current.repositorySchemaVersion(), current.importMode(), current.status(),
			current.lastSyncedAt(), current.members(), current.sessions(), current.submissions(), settings
		);
		store(updated);
		persist();
		return updated;
	}

	public synchronized void updateUserProfile(long gitLabUserId, String displayName, String repositoryFileName) {
		refreshAllFromDatabase();
		for (WorkspaceState workspace : List.copyOf(workspaces.values())) {
			boolean changed = false;
			List<StudyMember> members = new ArrayList<>();
			for (StudyMember member : workspace.members()) {
				if (member.gitlabUserId() != gitLabUserId) {
					members.add(member);
					continue;
				}
				boolean hasSubmissionFile = workspace.submissions().keySet().stream()
					.anyMatch(key -> key.endsWith("/" + member.id()));
				String nextFileName = hasSubmissionFile
					? member.fileName()
					: uniqueMemberFileName(workspace.members(), member.id(), safeMemberFileName(repositoryFileName, displayName));
				members.add(new StudyMember(
					member.id(), member.gitlabUserId(), member.username(), displayName,
					displayName.substring(0, 1).toUpperCase(), member.color(), nextFileName,
					member.role(), member.status(), member.accessLevel()
				));
				changed = true;
			}
			if (changed) store(copyMembers(workspace, List.copyOf(members)));
		}
		persist();
	}

	public synchronized WorkspaceState setStatus(String workspaceId, String status) {
		WorkspaceState current = get(workspaceId);
		if ("ACTIVE".equals(status) && stateRepository != null) {
			WorkspaceStateEntity entity = stateRepository.findById(workspaceId).orElse(null);
			if (entity != null && entity.deletionExpiresAt() != null && entity.deletionExpiresAt().isBefore(java.time.Instant.now())) {
				throw error("WORKSPACE_RESTORE_EXPIRED", "Workspace 복원 가능 기간 7일이 지났습니다.", 410);
			}
		}
		WorkspaceState updated = new WorkspaceState(
			current.id(), current.name(), current.gitlabProjectId(), current.gitlabProjectPath(), current.defaultBranch(),
			current.repositoryBasePath(), current.repositorySchemaVersion(), current.importMode(), status,
			current.lastSyncedAt(), current.members(), current.sessions(), current.submissions(), current.settings()
		);
		store(updated);
		persist();
		return updated;
	}

	public List<Map<String, Object>> listDeleted(long gitLabUserId) {
		if (stateRepository == null) return List.of();
		return stateRepository.findByStatus("SOFT_DELETED").stream()
			.filter(entity -> entity.toState(objectMapper).members().stream().anyMatch(member ->
				member.gitlabUserId() == gitLabUserId && "ACTIVE".equals(member.status())))
			.map(entity -> {
				Map<String, Object> value = new LinkedHashMap<>();
				value.put("workspace", entity.toState(objectMapper));
				value.put("deletedAt", entity.deletedAt());
				value.put("deletionExpiresAt", entity.deletionExpiresAt());
				return Map.copyOf(value);
			}).toList();
	}

	@Scheduled(cron = "0 17 3 * * *")
	public synchronized void purgeExpiredDeletedWorkspaces() {
		if (stateRepository == null) return;
		List<WorkspaceStateEntity> expired = stateRepository.findByStatusAndDeletionExpiresAtBefore("SOFT_DELETED", java.time.Instant.now());
		for (WorkspaceStateEntity entity : expired) workspaces.remove(entity.id());
		stateRepository.deleteAll(expired);
		if (!expired.isEmpty()) log.info("복원 기간이 지난 Workspace {}개를 DB에서 정리했습니다.", expired.size());
	}

	public synchronized WorkspaceState addMember(String workspaceId, StudyMember member) {
		WorkspaceState current = get(workspaceId);
		if (member == null || !StringUtils.hasText(member.id()) || member.gitlabUserId() <= 0 || !StringUtils.hasText(member.fileName())) {
			throw error("INVALID_REQUEST", "멤버 식별자와 GitLab 사용자 정보가 필요합니다.", 400);
		}
		List<StudyMember> members = new ArrayList<>(current.members());
		if (members.stream().anyMatch(candidate -> candidate.id().equals(member.id()) || candidate.gitlabUserId() == member.gitlabUserId())) {
			throw error("WORKSPACE_MEMBER_ALREADY_EXISTS", "이미 등록된 Workspace 멤버입니다.", 409);
		}
		if (members.stream().anyMatch(candidate -> candidate.fileName().equalsIgnoreCase(member.fileName()))) {
			throw error("WORKSPACE_MEMBER_FILE_CONFLICT", "다른 멤버가 같은 제출 파일명을 사용하고 있습니다.", 409);
		}
		members.add(member);
		WorkspaceState updated = copyMembers(current, List.copyOf(members));
		store(updated);
		persist();
		return updated;
	}

	public synchronized WorkspaceState replaceMembers(String workspaceId, List<StudyMember> members) {
		WorkspaceState current = get(workspaceId);
		WorkspaceState updated = copyMembers(current, List.copyOf(members));
		store(updated);
		persist();
		return updated;
	}

	public synchronized WorkspaceState updateMemberRole(String workspaceId, String memberId, String role) {
		if (!StringUtils.hasText(role) || !Set.of("OWNER", "MANAGER", "MEMBER").contains(role)) {
			throw error("INVALID_MEMBER_ROLE", "지원하지 않는 Workspace 역할입니다.", 400);
		}
		WorkspaceState current = get(workspaceId);
		StudyMember target = current.members().stream().filter(member -> member.id().equals(memberId)).findFirst()
			.orElseThrow(() -> error("WORKSPACE_MEMBER_NOT_FOUND", "Workspace 멤버를 찾을 수 없습니다.", 404));
		if ("OWNER".equals(target.role()) && !"OWNER".equals(role)) {
			long remainingOwners = current.members().stream()
				.filter(member -> !member.id().equals(memberId))
				.filter(member -> "OWNER".equals(member.role()) && "ACTIVE".equals(member.status()))
				.count();
			if (remainingOwners == 0) throw error("LAST_OWNER_REQUIRED", "활성 Owner는 최소 한 명이어야 합니다.", 409);
		}
		List<StudyMember> members = current.members().stream().map(member -> member.id().equals(memberId)
			? new StudyMember(member.id(), member.gitlabUserId(), member.username(), member.displayName(), member.avatar(), member.color(), member.fileName(), role, member.status(), member.accessLevel())
			: member).toList();
		WorkspaceState updated = copyMembers(current, members);
		store(updated);
		persist();
		return updated;
	}

	public synchronized void anonymizeUserForAccountDeletion(long gitLabUserId) {
		refreshAllFromDatabase();
		boolean ownsActiveWorkspace = workspaces.values().stream()
			.filter(workspace -> "ACTIVE".equals(workspace.status()))
			.flatMap(workspace -> workspace.members().stream())
			.anyMatch(member -> member.gitlabUserId() == gitLabUserId && "OWNER".equals(member.role()) && "ACTIVE".equals(member.status()));
		if (ownsActiveWorkspace) {
			throw error("ACCOUNT_OWNS_WORKSPACES", "Owner인 활성 Workspace를 모두 삭제한 뒤 탈퇴해 주세요.", 409);
		}

		boolean changed = false;
		for (WorkspaceState workspace : List.copyOf(workspaces.values())) {
			if (workspace.members().stream().noneMatch(member -> member.gitlabUserId() == gitLabUserId)) continue;
			List<StudyMember> anonymized = workspace.members().stream().map(member ->
				member.gitlabUserId() == gitLabUserId
					? new StudyMember(member.id(), -Math.abs(gitLabUserId), "deleted-user", "탈퇴한 사용자", "?", "#8b8493", member.fileName(), member.role(), "PROJECT_ACCESS_LOST", 0)
					: member
			).toList();
			store(copyMembers(workspace, anonymized));
			changed = true;
		}
		if (changed) persist();
	}

	public synchronized WorkspaceState deactivateMember(String workspaceId, String memberId, long currentGitLabUserId) {
		WorkspaceState current = get(workspaceId);
		if (current.members().stream().anyMatch(member -> member.id().equals(memberId) && member.gitlabUserId() == currentGitLabUserId)) {
			throw error("INVALID_REQUEST", "현재 로그인한 멤버는 자신을 비활성화할 수 없습니다.", 400);
		}
		boolean found = current.members().stream().anyMatch(member -> member.id().equals(memberId));
		if (!found) throw error("WORKSPACE_MEMBER_NOT_FOUND", "Workspace 멤버를 찾을 수 없습니다.", 404);
		List<StudyMember> members = current.members().stream().map(member -> member.id().equals(memberId)
			? new StudyMember(member.id(), member.gitlabUserId(), member.username(), member.displayName(), member.avatar(), member.color(), member.fileName(), member.role(), "PROJECT_ACCESS_LOST", member.accessLevel())
			: member).toList();
		WorkspaceState updated = copyMembers(current, members);
		store(updated);
		persist();
		return updated;
	}

	public synchronized WorkspaceState sync(String workspaceId) {
		WorkspaceState current = get(workspaceId);
		WorkspaceState updated = copy(current, current.sessions(), current.submissions(), current.settings(), now());
		store(updated);
		persist();
		return updated;
	}

	public synchronized WorkspaceState replaceSessions(String workspaceId, Map<String, StudySession> sessions) {
		WorkspaceState current = get(workspaceId);
		return replaceRepositoryState(workspaceId, sessions, current.submissions());
	}

	public synchronized WorkspaceState replaceRepositoryState(
		String workspaceId,
		Map<String, StudySession> sessions,
		Map<String, MemberSubmissionFile> submissions
	) {
		WorkspaceState current = get(workspaceId);
		WorkspaceState updated = copy(
			current, new LinkedHashMap<>(sessions), new LinkedHashMap<>(submissions), current.settings(), now()
		);
		store(updated);
		persist();
		return updated;
	}

	public synchronized WorkspaceState updateNotifications(String workspaceId, Notifications notifications) {
		WorkspaceState current = get(workspaceId);
		if (notifications == null) {
			throw error("INVALID_REQUEST", "알림 설정이 필요합니다.", 400);
		}
		WorkspaceSettings settings = new WorkspaceSettings(
			current.settings().timezone(), current.settings().requireChangeNoteWhenSubmitted(), notifications
		);
		WorkspaceState updated = copy(current, current.sessions(), current.submissions(), settings, current.lastSyncedAt());
		store(updated);
		persist();
		return updated;
	}

	public WorkspaceState saveSession(String workspaceId, String pathDate, SessionDraft draft, String actorUsername) {
		return saveSession(workspaceId, pathDate, draft, actorUsername, (workspace, current, next) -> localCommitId());
	}

	public synchronized WorkspaceState saveSession(
		String workspaceId,
		String pathDate,
		SessionDraft draft,
		String actorUsername,
		SessionWriter writer
	) {
		WorkspaceState workspace = get(workspaceId);
		validateSessionDraft(draft);
		String date = pathDate == null ? draft.date() : pathDate;
		if (!date.equals(draft.date())) {
			throw error("INVALID_REQUEST", "경로와 본문의 일정 날짜가 다릅니다.", 400);
		}

		StudySession current = workspace.sessions().get(date);
		if (pathDate == null && current != null) {
			throw error("SESSION_ALREADY_EXISTS", "해당 날짜의 일정이 이미 존재합니다.", 409);
		}
		if (pathDate != null && current == null) {
			throw error("SESSION_NOT_FOUND", "해당 날짜의 일정을 찾을 수 없습니다.", 404);
		}
		if (current != null && (draft.expectedRevision() == null || draft.expectedRevision() != current.revision())) {
			throw error("SESSION_REVISION_CONFLICT", "다른 사용자가 일정을 변경했습니다. 최신 내용을 다시 확인해 주세요.", 409);
		}
		if (current != null && hasSubmissions(workspace, current) && !StringUtils.hasText(draft.changeReason())) {
			throw error("CHANGE_REASON_REQUIRED", "제출이 있는 일정을 변경하려면 변경 사유가 필요합니다.", 400);
		}

		String timestamp = now();
		List<SessionItem> activeItems = normalizeItems(draft.items());
		List<SessionItem> archived = current == null ? new ArrayList<>() : new ArrayList<>(current.archivedItems());
		if (current != null) {
			Set<String> nextIds = activeItems.stream().map(SessionItem::id).collect(Collectors.toSet());
			current.items().stream()
				.filter(item -> !nextIds.contains(item.id()))
				.map(item -> new SessionItem(item.id(), item.order(), item.title(), item.type(), item.source(), item.url(), item.submitType(), item.required(), "cancelled", item.replaces(), item.replacedBy()))
				.forEach(archived::add);
		}

		int revision = current == null ? 1 : current.revision() + 1;
		String folder = current == null ? date.substring(2).replace("-", "") : current.folder();
		StudySession candidate = new StudySession(
			date, folder, revision, activeItems.getFirst().type(), draft.title().trim(), nullableTrim(draft.description()), "active",
			draft.deadline(), blankToNull(draft.secondaryDeadline()),
			current == null ? timestamp : current.createdAt(), current == null ? actorUsername : current.createdBy(),
			timestamp, actorUsername,
			current == null ? null : new SessionChange(true, "학습 일정과 항목이 수정되었습니다.", draft.changeReason().trim()),
			activeItems, List.copyOf(archived), null
		);
		StudySession saved = withCommitId(candidate, requireCommitId(writer.write(workspace, current, candidate)));
		Map<String, StudySession> sessions = new LinkedHashMap<>(workspace.sessions());
		sessions.put(date, saved);
		WorkspaceState updated = copy(workspace, sessions, workspace.submissions(), workspace.settings(), workspace.lastSyncedAt());
		store(updated);
		persist();
		return updated;
	}

	public WorkspaceState cancelSession(String workspaceId, String date, Integer expectedRevision, String actorUsername) {
		return cancelSession(workspaceId, date, expectedRevision, actorUsername, (workspace, current, next) -> localCommitId());
	}

	public synchronized WorkspaceState cancelSession(
		String workspaceId,
		String date,
		Integer expectedRevision,
		String actorUsername,
		SessionWriter writer
	) {
		WorkspaceState workspace = get(workspaceId);
		StudySession current = requiredSession(workspace, date);
		if (expectedRevision != null && expectedRevision != current.revision()) {
			throw error("SESSION_REVISION_CONFLICT", "다른 사용자가 일정을 변경했습니다.", 409);
		}
		StudySession candidate = new StudySession(
			current.date(), current.folder(), current.revision() + 1, current.type(), current.title(), current.description(), "cancelled",
			current.deadline(), current.secondaryDeadline(), current.createdAt(), current.createdBy(), now(), actorUsername,
			new SessionChange(true, "일정이 취소되었습니다.", "일정 취소"), current.items(), current.archivedItems(), null
		);
		StudySession cancelled = withCommitId(candidate, requireCommitId(writer.write(workspace, current, candidate)));
		Map<String, StudySession> sessions = new LinkedHashMap<>(workspace.sessions());
		sessions.put(date, cancelled);
		WorkspaceState updated = copy(workspace, sessions, workspace.submissions(), workspace.settings(), workspace.lastSyncedAt());
		store(updated);
		persist();
		return updated;
	}

	public WorkspaceState upsertSubmission(String workspaceId, String date, String itemId, SubmissionRequest request, long gitLabUserId) {
		return upsertSubmission(
			workspaceId, date, itemId, request, gitLabUserId,
			(workspace, session, member, current, next, commitMessage) -> localCommitId()
		);
	}

	public synchronized WorkspaceState upsertSubmission(
		String workspaceId,
		String date,
		String itemId,
		SubmissionRequest request,
		long gitLabUserId,
		SubmissionWriter writer
	) {
		WorkspaceState workspace = get(workspaceId);
		StudySession session = requiredSession(workspace, date);
		SessionItem item = session.items().stream()
			.filter(candidate -> candidate.id().equals(itemId) && "active".equals(candidate.status()))
			.findFirst()
			.orElseThrow(() -> error("ITEM_NOT_FOUND", "제출할 학습 항목을 찾을 수 없습니다.", 404));
		validateSubmission(item, request);
		StudyMember member = currentMember(workspace, gitLabUserId);
		String key = session.folder() + "/" + member.id();
		MemberSubmissionFile current = workspace.submissions().get(key);
		validateExpectedSubmissionCommit(current, request.expectedFileCommitId());
		String timestamp = now();
		SubmissionEntry previous = current == null ? null : current.submissions().stream()
			.filter(entry -> entry.itemId().equals(itemId)).findFirst().orElse(null);
		List<SubmissionEntry> entries = current == null ? new ArrayList<>() : new ArrayList<>(current.submissions());
		entries.removeIf(entry -> entry.itemId().equals(itemId));
		entries.add(new SubmissionEntry(
			itemId, request.type(), submissionValue(request), blankToNull(request.language()),
			previous == null ? timestamp : previous.submittedAt(), timestamp
		));
		entries.sort(Comparator.comparing(SubmissionEntry::itemId));
		MemberSubmissionFile candidate = new MemberSubmissionFile(
			1, member.id(), member.gitlabUserId(), member.displayName(), session.folder(), session.revision(), session.type(), timestamp,
			List.copyOf(entries), current == null ? null : current.reflection(),
			null, request.commitMessage().trim()
		);
		String commitId = requireCommitId(writer.write(workspace, session, member, current, candidate, request.commitMessage().trim()));
		MemberSubmissionFile saved = withSubmissionCommitId(candidate, commitId);
		Map<String, MemberSubmissionFile> submissions = new LinkedHashMap<>(workspace.submissions());
		submissions.put(key, saved);
		WorkspaceState updated = copy(workspace, workspace.sessions(), submissions, workspace.settings(), workspace.lastSyncedAt());
		store(updated);
		persist();
		return updated;
	}

	public WorkspaceState deleteSubmission(String workspaceId, String date, String itemId, long gitLabUserId) {
		return deleteSubmission(
			workspaceId, date, itemId, gitLabUserId,
			(workspace, session, member, current, next, commitMessage) -> localCommitId()
		);
	}

	public synchronized WorkspaceState deleteSubmission(
		String workspaceId,
		String date,
		String itemId,
		long gitLabUserId,
		SubmissionWriter writer
	) {
		WorkspaceState workspace = get(workspaceId);
		StudySession session = requiredSession(workspace, date);
		StudyMember member = currentMember(workspace, gitLabUserId);
		String key = session.folder() + "/" + member.id();
		MemberSubmissionFile current = workspace.submissions().get(key);
		if (current == null) {
			return workspace;
		}
		List<SubmissionEntry> entries = current.submissions().stream().filter(entry -> !entry.itemId().equals(itemId)).toList();
		String commitMessage = "study: remove submission " + itemId;
		MemberSubmissionFile candidate = new MemberSubmissionFile(
			current.version(), current.memberId(), current.gitlabUserId(), current.username(), current.date(), session.revision(), current.sessionType(),
			now(), entries, current.reflection(), null, commitMessage
		);
		MemberSubmissionFile saved = withSubmissionCommitId(
			candidate,
			requireCommitId(writer.write(workspace, session, member, current, candidate, commitMessage))
		);
		Map<String, MemberSubmissionFile> submissions = new LinkedHashMap<>(workspace.submissions());
		submissions.put(key, saved);
		WorkspaceState updated = copy(workspace, workspace.sessions(), submissions, workspace.settings(), workspace.lastSyncedAt());
		store(updated);
		persist();
		return updated;
	}

	public Map<String, Object> dashboard(String workspaceId, String date) {
		WorkspaceState workspace = get(workspaceId);
		StudySession session = requiredSession(workspace, date);
		List<SessionItem> required = activeRequired(session);
		List<Map<String, Object>> members = new ArrayList<>();
		int completedMembers = 0;
		int submittedItems = 0;
		for (StudyMember member : activeMembers(workspace)) {
			MemberSubmissionFile file = workspace.submissions().get(session.folder() + "/" + member.id());
			long completed = required.stream().filter(item -> contains(file, item.id())).count();
			submittedItems += (int) completed;
			if (completed == required.size()) completedMembers++;
			members.add(Map.of(
				"member", member,
				"completedItems", completed,
				"requiredItems", required.size(),
				"completionRate", required.isEmpty() ? 100 : Math.round(completed * 100f / required.size()),
				"status", completed == 0 ? "NOT_STARTED" : completed == required.size() ? "COMPLETE" : "PARTIAL"
			));
		}
		int totalRequired = activeMembers(workspace).size() * required.size();
		return Map.of(
			"date", date, "session", session, "members", members,
			"metrics", Map.of(
				"completedMembers", completedMembers, "totalMembers", activeMembers(workspace).size(),
				"memberCompletionRate", activeMembers(workspace).isEmpty() ? 0 : Math.round(completedMembers * 100f / activeMembers(workspace).size()),
				"submittedItems", submittedItems, "totalRequiredSubmissions", totalRequired,
				"submissionRate", totalRequired == 0 ? 0 : Math.round(submittedItems * 100f / totalRequired)
			)
		);
	}

	public List<Map<String, Object>> scores(String workspaceId, String from, String to) {
		WorkspaceState workspace = get(workspaceId);
		List<StudySession> sessions = workspace.sessions().values().stream()
			.filter(session -> inRange(session.date(), from, to) && "active".equals(session.status())).toList();
		List<Map<String, Object>> scores = new ArrayList<>();
		for (StudyMember member : activeMembers(workspace)) {
			int points = 0;
			int maxPoints = 0;
			int primary = 0;
			int secondary = 0;
			int missed = 0;
			for (StudySession session : sessions) {
				MemberSubmissionFile file = workspace.submissions().get(session.folder() + "/" + member.id());
				for (SessionItem item : activeRequired(session)) {
					maxPoints += 10;
					SubmissionEntry entry = find(file, item.id());
					int itemPoints = entry == null ? 0 : points(entry.submittedAt(), session.deadline(), session.secondaryDeadline());
					points += itemPoints;
					if (itemPoints == 10) primary++; else if (itemPoints == 6) secondary++; else missed++;
				}
			}
			Map<String, Object> score = new LinkedHashMap<>();
			score.put("member", member);
			score.put("points", points);
			score.put("maxPoints", maxPoints);
			score.put("primaryCount", primary);
			score.put("secondaryCount", secondary);
			score.put("missedCount", missed);
			scores.add(score);
		}
		scores.sort((left, right) -> Integer.compare((int) right.get("points"), (int) left.get("points")));
		for (int index = 0; index < scores.size(); index++) {
			int points = (int) scores.get(index).get("points");
			int rank = 1;
			for (int previous = 0; previous < index; previous++) {
				if ((int) scores.get(previous).get("points") > points) rank++;
			}
			scores.get(index).put("rank", rank);
		}
		return scores;
	}

	private static void validateSessionDraft(SessionDraft draft) {
		if (draft == null || !StringUtils.hasText(draft.date()) || !StringUtils.hasText(draft.title()) || !StringUtils.hasText(draft.deadline())) {
			throw error("INVALID_REQUEST", "날짜, 제목, 1차 마감은 필수입니다.", 400);
		}
		if (draft.items() == null || draft.items().isEmpty()) {
			throw error("INVALID_REQUEST", "하나 이상의 학습 항목을 확인해 주세요.", 400);
		}
		try {
			LocalDate.parse(draft.date());
			OffsetDateTime primary = OffsetDateTime.parse(draft.deadline());
			if (StringUtils.hasText(draft.secondaryDeadline()) && !OffsetDateTime.parse(draft.secondaryDeadline()).isAfter(primary)) {
				throw error("INVALID_REQUEST", "2차 마감은 1차 마감보다 늦어야 합니다.", 400);
			}
		} catch (java.time.format.DateTimeParseException exception) {
			throw error("INVALID_REQUEST", "마감은 시간대가 포함된 ISO 8601 형식이어야 합니다.", 400);
		}
		Set<String> ids = new java.util.HashSet<>();
		for (SessionItem item : draft.items()) {
			if (!StringUtils.hasText(item.title()) || !SESSION_TYPES.contains(item.type()) || !SUBMISSION_TYPES.contains(item.submitType())) {
				throw error("INVALID_REQUEST", "학습 항목 제목, 학습 유형과 제출 방식을 확인해 주세요.", 400);
			}
			if (StringUtils.hasText(item.id()) && !ids.add(item.id())) {
				throw error("INVALID_REQUEST", "학습 항목 ID가 중복되었습니다.", 400);
			}
		}
	}

	private static List<SessionItem> normalizeItems(List<SessionItem> items) {
		List<SessionItem> normalized = new ArrayList<>();
		for (int index = 0; index < items.size(); index++) {
			SessionItem item = items.get(index);
			String id = StringUtils.hasText(item.id()) ? item.id() : "item-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
			normalized.add(new SessionItem(id, index + 1, item.title().trim(), item.type(), blankToNull(item.source()), blankToNull(item.url()), item.submitType(), item.required(), "active", item.replaces(), item.replacedBy()));
		}
		return List.copyOf(normalized);
	}

	private static void validateSubmission(SessionItem item, SubmissionRequest request) {
		if (request == null || !item.submitType().equals(request.type())) {
			throw error("SUBMISSION_TYPE_MISMATCH", "일정에 정의된 제출 방식과 일치하지 않습니다.", 400);
		}
		if (!StringUtils.hasText(request.value()) || request.value().length() > 100_000) {
			throw error("INVALID_SUBMISSION", "제출 내용은 1자 이상 100,000자 이하여야 합니다.", 400);
		}
		if (!StringUtils.hasText(request.commitMessage()) || request.commitMessage().length() > 200 || request.commitMessage().chars().anyMatch(Character::isISOControl)) {
			throw error("COMMIT_MESSAGE_REQUIRED", "커밋 메시지는 제어 문자 없이 200자 이내로 입력해 주세요.", 400);
		}
		if ("link".equals(request.type())) {
			try {
				URI uri = URI.create(request.value().trim());
				String scheme = uri.getScheme();
				if ((!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme)) || !StringUtils.hasText(uri.getHost())) {
					throw new IllegalArgumentException();
				}
			} catch (IllegalArgumentException exception) {
				throw error("INVALID_SUBMISSION_URL", "링크 제출은 http 또는 https URL이어야 합니다.", 400);
			}
		}
	}

	private static String submissionValue(SubmissionRequest request) {
		return "code".equals(request.type()) ? request.value() : request.value().trim();
	}

	private static void validateExpectedSubmissionCommit(MemberSubmissionFile current, String expectedCommitId) {
		if (current == null) {
			if (StringUtils.hasText(expectedCommitId)) {
				throw error("SUBMISSION_CONFLICT", "제출 파일 상태가 변경되었습니다. 최신 내용을 다시 확인해 주세요.", 409);
			}
			return;
		}
		if (!StringUtils.hasText(expectedCommitId) || !expectedCommitId.equals(current.lastCommitId())) {
			throw error("SUBMISSION_CONFLICT", "제출 파일이 다른 변경과 충돌했습니다. 최신 내용을 다시 확인해 주세요.", 409);
		}
	}

	private static StudySession requiredSession(WorkspaceState workspace, String date) {
		StudySession session = workspace.sessions().get(date);
		if (session == null) throw error("SESSION_NOT_FOUND", "해당 날짜의 일정을 찾을 수 없습니다.", 404);
		return session;
	}

	public static StudyMember currentMember(WorkspaceState workspace, long gitLabUserId) {
		return workspace.members().stream().filter(member -> member.gitlabUserId() == gitLabUserId && "ACTIVE".equals(member.status())).findFirst()
			.orElseThrow(() -> error("WORKSPACE_ACCESS_DENIED", "Workspace 활성 멤버가 아닙니다.", 403));
	}

	private static String safeMemberFileName(String requested, String fallback) {
		String source = StringUtils.hasText(requested) ? requested.trim() : fallback;
		if (source.toLowerCase().endsWith(".md")) source = source.substring(0, source.length() - 3);
		String normalized = java.text.Normalizer.normalize(source, java.text.Normalizer.Form.NFKC)
			.replaceAll("[\\s/\\\\]+", "-")
			.replaceAll("[^\\p{L}\\p{N}._-]", "-")
			.replaceAll("-+", "-")
			.replaceAll("^[.-]+|[.-]+$", "");
		if (!StringUtils.hasText(normalized)) normalized = "member";
		return normalized.substring(0, Math.min(normalized.length(), 80)) + ".md";
	}

	private static String uniqueMemberFileName(List<StudyMember> members, String currentMemberId, String requested) {
		if (members.stream().noneMatch(member -> !member.id().equals(currentMemberId) && member.fileName().equalsIgnoreCase(requested))) {
			return requested;
		}
		String base = requested.substring(0, requested.length() - 3);
		for (int suffix = 2; suffix <= 999; suffix++) {
			String candidate = base + "-" + suffix + ".md";
			if (members.stream().noneMatch(member -> !member.id().equals(currentMemberId) && member.fileName().equalsIgnoreCase(candidate))) {
				return candidate;
			}
		}
		throw error("MEMBER_FILE_NAME_CONFLICT", "같은 GitLab 기록 이름을 사용하는 멤버가 너무 많습니다.", 409);
	}

	private static boolean hasSubmissions(WorkspaceState workspace, StudySession session) {
		return workspace.submissions().keySet().stream().anyMatch(key -> key.startsWith(session.folder() + "/"));
	}

	private static List<StudyMember> activeMembers(WorkspaceState workspace) {
		return workspace.members().stream().filter(member -> "ACTIVE".equals(member.status())).toList();
	}

	private static List<SessionItem> activeRequired(StudySession session) {
		return session.items().stream().filter(item -> item.required() && "active".equals(item.status())).toList();
	}

	private static boolean contains(MemberSubmissionFile file, String itemId) {
		return find(file, itemId) != null;
	}

	private static SubmissionEntry find(MemberSubmissionFile file, String itemId) {
		return file == null ? null : file.submissions().stream().filter(entry -> entry.itemId().equals(itemId)).findFirst().orElse(null);
	}

	private static int points(String submittedAt, String deadline, String secondaryDeadline) {
		OffsetDateTime submitted = OffsetDateTime.parse(submittedAt);
		if (!submitted.isAfter(OffsetDateTime.parse(deadline))) return 10;
		if (StringUtils.hasText(secondaryDeadline) && !submitted.isAfter(OffsetDateTime.parse(secondaryDeadline))) return 6;
		return 0;
	}

	private static boolean inRange(String date, String from, String to) {
		return (from == null || date.compareTo(from) >= 0) && (to == null || date.compareTo(to) <= 0);
	}

	private static WorkspaceState copy(WorkspaceState current, Map<String, StudySession> sessions, Map<String, MemberSubmissionFile> submissions, WorkspaceSettings settings, String syncedAt) {
		return new WorkspaceState(
			current.id(), current.name(), current.gitlabProjectId(), current.gitlabProjectPath(), current.defaultBranch(),
			current.repositoryBasePath(), current.repositorySchemaVersion(), current.importMode(), current.status(), syncedAt,
			current.members(), Map.copyOf(sessions), Map.copyOf(submissions), settings
		);
	}

	private static WorkspaceState copyMembers(WorkspaceState current, List<StudyMember> members) {
		return new WorkspaceState(
			current.id(), current.name(), current.gitlabProjectId(), current.gitlabProjectPath(), current.defaultBranch(),
			current.repositoryBasePath(), current.repositorySchemaVersion(), current.importMode(), current.status(),
			current.lastSyncedAt(), members, current.sessions(), current.submissions(), current.settings()
		);
	}

	private static StudySession withCommitId(StudySession session, String commitId) {
		return new StudySession(
			session.date(), session.folder(), session.revision(), session.type(), session.title(), session.description(), session.status(),
			session.deadline(), session.secondaryDeadline(), session.createdAt(), session.createdBy(), session.updatedAt(), session.updatedBy(),
			session.change(), session.items(), session.archivedItems(), commitId
		);
	}

	private static MemberSubmissionFile withSubmissionCommitId(MemberSubmissionFile file, String commitId) {
		return new MemberSubmissionFile(
			file.version(), file.memberId(), file.gitlabUserId(), file.username(), file.date(), file.sessionRevision(), file.sessionType(),
			file.updatedAt(), file.submissions(), file.reflection(), commitId, file.lastCommitMessage()
		);
	}

	private static String requireCommitId(String commitId) {
		if (!StringUtils.hasText(commitId)) {
			throw error("GITLAB_COMMIT_ID_MISSING", "커밋 결과에 commit SHA가 없습니다.", 502);
		}
		return commitId;
	}

	private static String localCommitId() {
		return "local-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
	}

	private List<WorkspaceState> loadState() {
		if (stateRepository != null) {
			List<WorkspaceState> loaded = stateRepository.findAll().stream()
				.map(entity -> entity.toState(objectMapper))
				.map(WorkspaceService::normalizeMemberRoles)
				.toList();
			if (!loaded.isEmpty()) return loaded;
			List<WorkspaceState> legacy = loadFileState();
			legacy = legacy.stream().map(WorkspaceService::normalizeMemberRoles).toList();
			if (!legacy.isEmpty()) {
				stateRepository.saveAll(legacy.stream()
					.map(state -> WorkspaceStateEntity.create(state, objectMapper, null))
					.toList());
				log.info("기존 Workspace JSON {}개를 DB로 마이그레이션했습니다.", legacy.size());
				return legacy;
			}
			List<WorkspaceState> initial = initialState();
			if (!initial.isEmpty()) {
				stateRepository.saveAllAndFlush(initial.stream()
					.map(state -> WorkspaceStateEntity.create(state, objectMapper, null))
					.toList());
			}
			return initial;
		}
		List<WorkspaceState> loaded = loadFileState();
		return loaded.isEmpty() ? initialState() : loaded;
	}

	private List<WorkspaceState> loadFileState() {
		if (!Files.isRegularFile(persistencePath)) return List.of();
		try {
			List<WorkspaceState> loaded = objectMapper.readValue(persistencePath.toFile(), new TypeReference<>() { });
			return loaded;
		} catch (Exception exception) {
			log.warn("저장된 Workspace 상태를 읽지 못해 빈 상태로 시작합니다: {}", persistencePath);
			return List.of();
		}
	}

	private static WorkspaceState normalizeMemberRoles(WorkspaceState workspace) {
		List<StudyMember> members = new ArrayList<>();
		for (int index = 0; index < workspace.members().size(); index++) {
			StudyMember member = workspace.members().get(index);
			String role = member.role() != null && Set.of("OWNER", "MANAGER", "MEMBER").contains(member.role())
				? member.role()
				: index == 0 ? "OWNER" : member.accessLevel() >= 40 ? "MANAGER" : "MEMBER";
			members.add(new StudyMember(
				member.id(), member.gitlabUserId(), member.username(), member.displayName(), member.avatar(), member.color(),
				member.fileName(), role, member.status(), member.accessLevel()
			));
		}
		return new WorkspaceState(
			workspace.id(), workspace.name(), workspace.gitlabProjectId(), workspace.gitlabProjectPath(), workspace.defaultBranch(),
			workspace.repositoryBasePath() == null ? "" : workspace.repositoryBasePath(),
			workspace.repositorySchemaVersion() == null || workspace.repositorySchemaVersion() < 1 ? 1 : workspace.repositorySchemaVersion(),
			workspace.importMode() == null ? "COMPATIBLE" : workspace.importMode(),
			workspace.status(), workspace.lastSyncedAt(), List.copyOf(members), workspace.sessions(), workspace.submissions(), workspace.settings()
		);
	}

	private List<WorkspaceState> initialState() {
		return seedEnabled ? DemoDataFactory.create() : List.of();
	}

	private void persist() {
		if (stateRepository != null) {
			try {
				List<String> dirtyIds = List.copyOf(dirtyWorkspaceIds);
				List<WorkspaceStateEntity> entities = dirtyIds.stream()
					.map(workspaces::get)
					.filter(java.util.Objects::nonNull)
					.map(state -> WorkspaceStateEntity.create(
						state, objectMapper, stateRepository.findById(state.id()).orElse(null)
					))
					.toList();
				stateRepository.saveAllAndFlush(entities);
				dirtyWorkspaceIds.removeAll(dirtyIds);
				return;
			} catch (ObjectOptimisticLockingFailureException exception) {
				throw error("WORKSPACE_CONFLICT", "다른 서버에서 Workspace가 변경되었습니다. 최신 내용을 다시 불러와 주세요.", 409);
			} catch (RuntimeException exception) {
				throw error("WORKSPACE_PERSISTENCE_FAILED", "Workspace 상태를 DB에 안전하게 저장하지 못했습니다.", 500);
			}
		}
		try {
			Path parent = persistencePath.getParent();
			if (parent != null) Files.createDirectories(parent);
			Path temporary = persistencePath.resolveSibling(persistencePath.getFileName() + ".tmp");
			List<WorkspaceState> snapshot = workspaces.values().stream().sorted(Comparator.comparing(WorkspaceState::id)).toList();
			objectMapper.writerWithDefaultPrettyPrinter().writeValue(temporary.toFile(), snapshot);
			try {
				Files.move(temporary, persistencePath, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
			} catch (java.nio.file.AtomicMoveNotSupportedException exception) {
				Files.move(temporary, persistencePath, StandardCopyOption.REPLACE_EXISTING);
			}
		} catch (Exception exception) {
			throw error("WORKSPACE_PERSISTENCE_FAILED", "Workspace 상태를 안전하게 저장하지 못했습니다.", 500);
		}
	}

	private void store(WorkspaceState workspace) {
		workspaces.put(workspace.id(), workspace);
		dirtyWorkspaceIds.add(workspace.id());
	}

	private void refreshAllFromDatabase() {
		if (stateRepository == null) return;
		List<WorkspaceState> loaded = stateRepository.findAll().stream()
			.map(entity -> entity.toState(objectMapper))
			.map(WorkspaceService::normalizeMemberRoles)
			.toList();
		Set<String> loadedIds = loaded.stream().map(WorkspaceState::id).collect(Collectors.toSet());
		workspaces.keySet().removeIf(id -> !dirtyWorkspaceIds.contains(id) && !loadedIds.contains(id));
		loaded.forEach(workspace -> {
			if (!dirtyWorkspaceIds.contains(workspace.id())) workspaces.put(workspace.id(), workspace);
		});
	}

	private static String now() {
		return OffsetDateTime.now(ZoneOffset.UTC).toString();
	}

	private static String nullableTrim(String value) {
		return value == null ? "" : value.trim();
	}

	private static String blankToNull(String value) {
		return StringUtils.hasText(value) ? value.trim() : null;
	}

	private static WorkspaceException error(String code, String message, int status) {
		return new WorkspaceException(code, message, status);
	}
}
