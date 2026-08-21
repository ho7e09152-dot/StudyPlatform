package com.studyworkspace.workspace.controller;

import static com.studyworkspace.policy.DataRetentionPolicy.WORKSPACE_SOFT_DELETE;

import static com.studyworkspace.workspace.domain.WorkspaceModels.*;

import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.studyworkspace.gitlab.dto.GitLabUser;
import com.studyworkspace.github.service.GitHubUserTokenProvider;
import com.studyworkspace.provider.ProviderCapabilities;
import com.studyworkspace.workspace.domain.RepositoryProvider;
import com.studyworkspace.workspace.dto.RepositorySummary;
import com.studyworkspace.workspace.service.RepositoryDataService;
import com.studyworkspace.workspace.service.RepositoryCredentialResolver;
import com.studyworkspace.auth.service.GitLabOAuthTokenProvider;
import com.studyworkspace.auth.service.OAuthAccountService;
import com.studyworkspace.auth.security.StudyIngPrincipal;
import com.studyworkspace.workspace.domain.WorkspaceException;
import com.studyworkspace.workspace.service.GitLabSessionFileService;
import com.studyworkspace.workspace.service.GitLabSessionSyncService;
import com.studyworkspace.workspace.service.GitLabSubmissionFileService;
import com.studyworkspace.workspace.service.WorkspaceService;
import com.studyworkspace.workspace.service.SessionYamlSerializer;
import com.studyworkspace.workspace.service.SubmissionMarkdownCodec;
import com.studyworkspace.workspace.service.GitLabWorkspaceMemberService;
import com.studyworkspace.workspace.service.WorkspaceDiscoveryService;
import com.studyworkspace.workspace.dto.DiscoverableWorkspace;
import com.studyworkspace.workspace.dto.WorkspaceJoinResponse;
import com.studyworkspace.workspace.security.WorkspaceAccessService;
import com.studyworkspace.workspace.security.WorkspaceRepositoryAccessVerifier;
import com.studyworkspace.workspace.service.SyncJobService;
import com.studyworkspace.workspace.service.AuditEventService;
import com.studyworkspace.workspace.service.InAppNotificationService;
import com.studyworkspace.common.exception.RepositoryProviderException;
import com.studyworkspace.workspace.dto.WorkspaceSyncResponse;
import com.studyworkspace.workspace.dto.RepositoryImportAnalysis;
import com.studyworkspace.workspace.dto.RepositorySchemaMigrationPreview;
import com.studyworkspace.workspace.dto.RepositorySchemaMigrationRequest;
import com.studyworkspace.workspace.dto.RepositorySchemaMigrationResult;
import com.studyworkspace.workspace.service.RepositoryImportAnalysisService;
import com.studyworkspace.workspace.service.RepositoryInitializationService;
import com.studyworkspace.workspace.service.RepositorySchemaMigrationService;
import com.studyworkspace.workspace.service.WorkspaceRepositoryLayout;
import com.studyworkspace.workspace.service.RepositoryStorageLayoutPolicy;
import com.studyworkspace.workspace.service.WorkspaceRepositoryPath;
import com.studyworkspace.workspace.service.SubmissionReviewService;
import com.studyworkspace.workspace.dto.SubmissionReviewThread;
import com.studyworkspace.workspace.dto.CreateSubmissionReviewRequest;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/workspaces")
public class WorkspaceController {

	private final WorkspaceService service;
	private final GitLabOAuthTokenProvider tokenProvider;
	private final GitHubUserTokenProvider githubTokens;
	private final ProviderCapabilities providerCapabilities;
	private final RepositoryDataService repositories;
	private final RepositoryCredentialResolver credentialResolver;
	private final GitLabSessionFileService sessionFileService;
	private final GitLabSessionSyncService sessionSyncService;
	private final GitLabSubmissionFileService submissionFileService;
	private final SessionYamlSerializer sessionYamlSerializer;
	private final SubmissionMarkdownCodec submissionMarkdownCodec;
	private final GitLabWorkspaceMemberService memberService;
	private final WorkspaceDiscoveryService discoveryService;
	private final WorkspaceAccessService accessService;
	private final WorkspaceRepositoryAccessVerifier repositoryAccessVerifier;
	private final SyncJobService syncJobService;
	private final AuditEventService auditEventService;
	private final InAppNotificationService notificationService;
	private final RepositoryImportAnalysisService importAnalysisService;
	private final OAuthAccountService accountService;
	private final RepositoryInitializationService repositoryInitializationService;
	private final RepositorySchemaMigrationService repositorySchemaMigrationService;
	private final SubmissionReviewService submissionReviewService;
	private final RepositoryStorageLayoutPolicy storageLayoutPolicy;

	public WorkspaceController(
		WorkspaceService service,
		GitLabOAuthTokenProvider tokenProvider,
		GitHubUserTokenProvider githubTokens,
		ProviderCapabilities providerCapabilities,
		RepositoryDataService repositories,
		RepositoryCredentialResolver credentialResolver,
		GitLabSessionFileService sessionFileService,
		GitLabSessionSyncService sessionSyncService,
		GitLabSubmissionFileService submissionFileService,
		SessionYamlSerializer sessionYamlSerializer,
		SubmissionMarkdownCodec submissionMarkdownCodec,
		GitLabWorkspaceMemberService memberService,
		WorkspaceDiscoveryService discoveryService,
		WorkspaceAccessService accessService,
		WorkspaceRepositoryAccessVerifier repositoryAccessVerifier,
		SyncJobService syncJobService,
		AuditEventService auditEventService,
		InAppNotificationService notificationService,
		RepositoryImportAnalysisService importAnalysisService,
		OAuthAccountService accountService,
		RepositoryInitializationService repositoryInitializationService,
		RepositorySchemaMigrationService repositorySchemaMigrationService,
		SubmissionReviewService submissionReviewService,
		RepositoryStorageLayoutPolicy storageLayoutPolicy
	) {
		this.service = service;
		this.tokenProvider = tokenProvider;
		this.githubTokens = githubTokens;
		this.providerCapabilities = providerCapabilities;
		this.repositories = repositories;
		this.credentialResolver = credentialResolver;
		this.sessionFileService = sessionFileService;
		this.sessionSyncService = sessionSyncService;
		this.submissionFileService = submissionFileService;
		this.sessionYamlSerializer = sessionYamlSerializer;
		this.submissionMarkdownCodec = submissionMarkdownCodec;
		this.memberService = memberService;
		this.discoveryService = discoveryService;
		this.accessService = accessService;
		this.repositoryAccessVerifier = repositoryAccessVerifier;
		this.syncJobService = syncJobService;
		this.auditEventService = auditEventService;
		this.notificationService = notificationService;
		this.importAnalysisService = importAnalysisService;
		this.accountService = accountService;
		this.repositoryInitializationService = repositoryInitializationService;
		this.repositorySchemaMigrationService = repositorySchemaMigrationService;
		this.submissionReviewService = submissionReviewService;
		this.storageLayoutPolicy = storageLayoutPolicy;
	}

	@GetMapping
	public List<WorkspaceState> listWorkspaces(
		@AuthenticationPrincipal GitLabUser user,
		HttpServletRequest servletRequest
	) {
		String studyIngUserId = user instanceof StudyIngPrincipal principal ? principal.userId() : null;
		List<WorkspaceState> joined = service.list(studyIngUserId, user.id());
		if (joined.isEmpty()) return joined;
		return user instanceof StudyIngPrincipal principal
			? repositoryAccessVerifier.verifyAtLogin(joined, principal, servletRequest)
			: repositoryAccessVerifier.verifyAtLogin(joined, tokenProvider.requireValidSession(servletRequest));
	}

	@GetMapping("/discoverable")
	public List<DiscoverableWorkspace> listDiscoverableWorkspaces(
		@AuthenticationPrincipal StudyIngPrincipal user,
		HttpServletRequest servletRequest
	) {
		return discoveryService.discover(user, servletRequest);
	}

	@PostMapping("/{workspaceId}/join")
	public WorkspaceJoinResponse joinWorkspace(
		@PathVariable String workspaceId,
		@AuthenticationPrincipal StudyIngPrincipal user,
		HttpServletRequest servletRequest
	) {
		WorkspaceJoinResponse result = discoveryService.join(workspaceId, user, servletRequest);
		if (result.joined()) {
			auditEventService.record(workspaceId, user, "WORKSPACE_MEMBER_JOINED", "MEMBER", Long.toString(user.id()), Map.of("role", "MEMBER"));
		}
		return result;
	}

	@GetMapping("/deleted")
	public List<Map<String, Object>> listDeletedWorkspaces(@AuthenticationPrincipal GitLabUser user) {
		return service.listDeleted(user.id());
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public WorkspaceState createWorkspace(
		@RequestBody CreateWorkspaceRequest request,
		@AuthenticationPrincipal StudyIngPrincipal user,
		HttpServletRequest servletRequest
	) {
		RepositoryProvider provider = request == null || !StringUtils.hasText(request.provider())
			? RepositoryProvider.GITLAB : parseProvider(request.provider());
		String externalRepositoryId = request == null ? null : StringUtils.hasText(request.externalRepositoryId())
			? request.externalRepositoryId().trim()
			: request.gitlabProjectId() != null && request.gitlabProjectId() > 0
				? Long.toString(request.gitlabProjectId()) : null;
		if (request == null || !StringUtils.hasText(externalRepositoryId) || !StringUtils.hasText(request.name())) {
			throw new WorkspaceException("INVALID_REQUEST", "Workspace 이름과 저장소가 필요합니다.", 400);
		}
		if (!providerCapabilities.supportsRepositoryProvider(provider)) {
			throw new WorkspaceException("REPOSITORY_PROVIDER_UNAVAILABLE", "현재 선택한 저장소 Provider를 사용할 수 없습니다.", 503);
		}
		String accessToken = provider == RepositoryProvider.GITLAB
			? tokenProvider.requireValidSession(servletRequest).accessToken()
			: githubTokens.requireValidCredential(user.userId()).accessToken();
		RepositorySummary project = repositories.require(provider).getRepository(accessToken, externalRepositoryId);
		if (!project.capabilities().canWrite()) {
			throw new WorkspaceException("REPOSITORY_WRITE_PERMISSION_REQUIRED", "Workspace 연결과 학습 제출을 위해 저장소 쓰기 권한이 필요합니다.", 403);
		}
		OAuthAccountService.AccountProfile profile = accountService.requireProfileByUserId(user.userId());
		if (!profile.profileCompleted()) {
			throw new WorkspaceException("PROFILE_REQUIRED", "Workspace를 만들기 전에 프로필을 설정해 주세요.", 409);
		}
		RepositoryImportAnalysis analysis = importAnalysisService.analyze(accessToken, provider, project.externalId());
		if (!StringUtils.hasText(request.expectedTreeFingerprint())
			|| !request.expectedTreeFingerprint().equals(analysis.treeFingerprint())) {
			throw new WorkspaceException("REPOSITORY_CHANGED", "저장소가 분석 이후 변경되었습니다. 다시 분석해 주세요.", 409);
		}
		if ("CONFLICTED".equals(analysis.classification())) {
			throw new WorkspaceException("REPOSITORY_PATH_CONFLICT", "서비스 전용 저장 경로가 기존 파일과 충돌합니다.", 409);
		}
		var storageLayout = request.storageLayout() == null ? null : storageLayoutPolicy.validate(request.storageLayout());
		RepositoryIdentity identity = new RepositoryIdentity(
			provider.name(), project.externalId(), project.fullName(), project.webUrl(), project.visibility(),
			StringUtils.hasText(project.defaultBranch()) ? project.defaultBranch() : "main",
			project.capabilities().canRead(), project.capabilities().canWrite(), project.capabilities().canManage(),
			project.providerPermission()
		);
		String repositoryBasePath = storageLayout == null
			? analysis.repositoryBasePath()
			: request.repositoryBasePath();
		if (storageLayout != null) {
			var currentTree = StringUtils.hasText(project.defaultBranch())
				? repositories.require(provider).listTree(accessToken, identity) : List.<com.studyworkspace.workspace.port.RepositoryDataPort.TreeEntry>of();
			var currentFiles = currentTree.stream().filter(entry -> "blob".equals(entry.type())).toList();
			if (!analysis.treeFingerprint().equals(RepositoryImportAnalysisService.fingerprint(currentFiles))) {
				throw new WorkspaceException("REPOSITORY_CHANGED", "저장소가 분석 이후 변경되었습니다. 다시 분석해 주세요.", 409);
			}
			repositoryBasePath = storageLayoutPolicy.validateBasePath(repositoryBasePath, currentTree);
		}
		CreateWorkspaceRequest verified = new CreateWorkspaceRequest(
			request.name(),
			provider == RepositoryProvider.GITLAB ? Long.parseLong(project.externalId()) : 0,
			project.fullName(),
			StringUtils.hasText(project.defaultBranch()) ? project.defaultBranch() : "main",
			profile.timezone(),
			repositoryBasePath,
			storageLayout == null ? analysis.repositorySchemaVersion() : WorkspaceRepositoryLayout.CUSTOM_SCHEMA_VERSION,
			analysis.classification(),
			analysis.treeFingerprint(),
			profile.repositoryFileName(),
			project.webUrl(),
			project.visibility(),
			provider.name(),
			project.externalId(),
			storageLayout
		);
		int accessLevel = project.capabilities().canManage() ? 40 : 30;
		WorkspaceState created = service.create(verified, user, accessLevel, identity);
		try {
			repositoryInitializationService.initialize(accessToken, created, profile.name());
		} catch (RuntimeException exception) {
			service.rollbackCreate(created.id());
			throw exception;
		}
		auditEventService.record(created.id(), user, "WORKSPACE_CREATED", "WORKSPACE", created.id(),
			Map.of("provider", provider.name(), "repository", project.fullName()));
		return created;
	}

	@GetMapping("/{workspaceId}")
	public WorkspaceState getWorkspace(@PathVariable String workspaceId) {
		return service.get(workspaceId);
	}

	@PatchMapping("/{workspaceId}")
	public WorkspaceState updateWorkspace(
		@PathVariable String workspaceId,
		@RequestBody UpdateWorkspaceRequest request,
		@AuthenticationPrincipal GitLabUser user
	) {
		accessService.requireManager(workspaceId, user.id(), false);
		WorkspaceState updated = service.update(workspaceId, request);
		auditEventService.record(workspaceId, user, "WORKSPACE_UPDATED", "WORKSPACE", workspaceId, Map.of());
		return updated;
	}

	@DeleteMapping("/{workspaceId}")
	public WorkspaceState softDeleteWorkspace(@PathVariable String workspaceId, @AuthenticationPrincipal GitLabUser user) {
		accessService.requireOwner(workspaceId, user.id(), false);
		WorkspaceState deleted = service.setStatus(workspaceId, "SOFT_DELETED");
		auditEventService.record(workspaceId, user, "WORKSPACE_SOFT_DELETED", "WORKSPACE", workspaceId, Map.of("retentionDays", WORKSPACE_SOFT_DELETE.toDays()));
		return deleted;
	}

	@PostMapping("/{workspaceId}/restore")
	public WorkspaceState restoreWorkspace(@PathVariable String workspaceId, @AuthenticationPrincipal GitLabUser user) {
		accessService.requireOwner(workspaceId, user.id(), true);
		WorkspaceState restored = service.setStatus(workspaceId, "ACTIVE");
		auditEventService.record(workspaceId, user, "WORKSPACE_RESTORED", "WORKSPACE", workspaceId, Map.of());
		return restored;
	}

	@GetMapping("/{workspaceId}/members")
	public List<StudyMember> listMembers(@PathVariable String workspaceId) {
		return service.get(workspaceId).members();
	}

	@GetMapping("/{workspaceId}/member-candidates")
	public List<StudyMember> listMemberCandidates(@PathVariable String workspaceId,
		@AuthenticationPrincipal StudyIngPrincipal user, HttpServletRequest servletRequest) {
		requireGitLabWorkspace(workspaceId);
		String accessToken = credentialResolver.resolve(user, service.get(workspaceId), servletRequest).accessToken();
		return memberService.candidates(accessToken, workspaceId);
	}

	@PostMapping("/{workspaceId}/members")
	public WorkspaceState addMember(
		@PathVariable String workspaceId,
		@RequestBody StudyMember member,
		@AuthenticationPrincipal StudyIngPrincipal user,
		HttpServletRequest servletRequest
	) {
		accessService.requireManager(workspaceId, user.id(), false);
		requireGitLabWorkspace(workspaceId);
		String accessToken = credentialResolver.resolve(user, service.get(workspaceId), servletRequest).accessToken();
		WorkspaceState updated = memberService.addVerified(accessToken, workspaceId, member.gitlabUserId());
		auditEventService.record(workspaceId, user, "MEMBER_ADDED", "MEMBER", Long.toString(member.gitlabUserId()), Map.of());
		return updated;
	}

	@DeleteMapping("/{workspaceId}/members/{memberId}")
	public WorkspaceState deactivateMember(
		@PathVariable String workspaceId,
		@PathVariable String memberId,
		@AuthenticationPrincipal GitLabUser user
	) {
		accessService.requireOwner(workspaceId, user.id(), false);
		WorkspaceState updated = service.deactivateMember(workspaceId, memberId, user.id());
		auditEventService.record(workspaceId, user, "MEMBER_DEACTIVATED", "MEMBER", memberId, Map.of());
		return updated;
	}

	@PatchMapping("/{workspaceId}/members/{memberId}/role")
	public WorkspaceState updateMemberRole(
		@PathVariable String workspaceId,
		@PathVariable String memberId,
		@RequestBody Map<String, String> request,
		@AuthenticationPrincipal GitLabUser user
	) {
		accessService.requireOwner(workspaceId, user.id(), false);
		String role = request == null ? null : request.get("role");
		WorkspaceState updated = service.updateMemberRole(workspaceId, memberId, role);
		auditEventService.record(workspaceId, user, "MEMBER_ROLE_UPDATED", "MEMBER", memberId, Map.of("role", role));
		return updated;
	}

	@PostMapping("/{workspaceId}/members/sync")
	public WorkspaceState syncMembers(
		@PathVariable String workspaceId,
		@AuthenticationPrincipal StudyIngPrincipal user,
		HttpServletRequest servletRequest
	) {
		accessService.requireManager(workspaceId, user.id(), false);
		requireGitLabWorkspace(workspaceId);
		String accessToken = credentialResolver.resolve(user, service.get(workspaceId), servletRequest).accessToken();
		WorkspaceState updated = memberService.sync(accessToken, workspaceId);
		auditEventService.record(workspaceId, user, "MEMBERS_SYNCED", "WORKSPACE", workspaceId, Map.of("memberCount", updated.members().size()));
		return updated;
	}

	@PostMapping("/{workspaceId}/sync")
	public WorkspaceSyncResponse syncWorkspace(
		@PathVariable String workspaceId,
		@AuthenticationPrincipal StudyIngPrincipal user,
		HttpServletRequest servletRequest
	) {
		accessService.requireManager(workspaceId, user.id(), false);
		String accessToken = credentialResolver.resolve(user, service.get(workspaceId), servletRequest).accessToken();
		String jobId = syncJobService.start(workspaceId, "REPOSITORY_SYNC");
		try {
			WorkspaceSyncResponse result = sessionSyncService.sync(accessToken, workspaceId);
			syncJobService.complete(jobId, !result.failures().isEmpty());
			auditEventService.record(workspaceId, user, result.failures().isEmpty() ? "REPOSITORY_SYNCED" : "REPOSITORY_SYNC_PARTIAL", "SYNC_JOB", jobId, Map.of("failures", result.failures().size()));
			if (!result.failures().isEmpty()) {
				notificationService.create(user.id(), workspaceId, "SYNC_PARTIAL", "일부 GitLab 파일을 동기화하지 못했습니다.", result.failures().size() + "개 파일을 확인해 주세요.", "/settings/data");
			}
			return result;
		} catch (WorkspaceException exception) {
			syncJobService.fail(jobId, exception.code(), exception.getMessage());
			recordSyncFailure(workspaceId, user, jobId, exception.code(), exception.getMessage());
			throw exception;
		} catch (RepositoryProviderException exception) {
			syncJobService.fail(jobId, exception.code(), exception.getMessage());
			recordSyncFailure(workspaceId, user, jobId, exception.code(), exception.getMessage());
			throw exception;
		} catch (RuntimeException exception) {
			syncJobService.fail(jobId, "SYNC_FAILED", exception.getMessage());
			recordSyncFailure(workspaceId, user, jobId, "SYNC_FAILED", exception.getMessage());
			throw exception;
		}
	}

	@GetMapping("/{workspaceId}/repository-schema/migration")
	public RepositorySchemaMigrationPreview previewRepositorySchemaMigration(
		@PathVariable String workspaceId,
		@AuthenticationPrincipal StudyIngPrincipal user,
		HttpServletRequest servletRequest
	) {
		accessService.requireOwner(workspaceId, user.id(), false);
		WorkspaceState workspace = service.get(workspaceId);
		String accessToken = credentialResolver.resolve(user, workspace, servletRequest).accessToken();
		return repositorySchemaMigrationService.preview(accessToken, workspace);
	}

	@PostMapping("/{workspaceId}/repository-schema/migrate")
	public RepositorySchemaMigrationResult migrateRepositorySchema(
		@PathVariable String workspaceId,
		@RequestBody RepositorySchemaMigrationRequest request,
		@AuthenticationPrincipal StudyIngPrincipal user,
		HttpServletRequest servletRequest
	) {
		accessService.requireOwner(workspaceId, user.id(), false);
		WorkspaceState current = service.get(workspaceId);
		String accessToken = credentialResolver.resolve(user, current, servletRequest).accessToken();
		OAuthAccountService.AccountProfile profile = accountService.requireProfileByUserId(user.userId());
		RepositorySchemaMigrationService.MigrationCommit commit = repositorySchemaMigrationService.migrate(
			accessToken,
			current,
			request == null ? null : request.expectedTreeFingerprint(),
			profile.name()
		);
		service.updateRepositoryLayout(
			workspaceId,
			WorkspaceRepositoryLayout.MANAGED_BASE_PATH,
			WorkspaceRepositoryLayout.CURRENT_SCHEMA_VERSION
		);
		WorkspaceSyncResponse sync = sessionSyncService.sync(accessToken, workspaceId);
		auditEventService.record(
			workspaceId,
			user,
			"REPOSITORY_SCHEMA_MIGRATED",
			"WORKSPACE",
			workspaceId,
			Map.of("commitId", commit.commitId(), "movedFiles", commit.movedFiles())
		);
		return new RepositorySchemaMigrationResult(
			sync.workspace(), commit.commitId(), commit.movedFiles(), sync.failures(), sync.syncedAt()
		);
	}

	@GetMapping("/{workspaceId}/sync-jobs")
	public List<SyncJobService.SyncJobView> listSyncJobs(@PathVariable String workspaceId, @AuthenticationPrincipal GitLabUser user) {
		accessService.requireManager(workspaceId, user.id(), false);
		return syncJobService.list(workspaceId);
	}

	@GetMapping("/{workspaceId}/audit-events")
	public List<AuditEventService.AuditEventView> listAuditEvents(
		@PathVariable String workspaceId,
		@AuthenticationPrincipal GitLabUser user
	) {
		accessService.requireManager(workspaceId, user.id(), false);
		return auditEventService.list(workspaceId);
	}

	@PatchMapping("/{workspaceId}/notifications")
	public WorkspaceState updateNotifications(
		@PathVariable String workspaceId,
		@RequestBody Notifications notifications,
		@AuthenticationPrincipal GitLabUser user
	) {
		accessService.requireManager(workspaceId, user.id(), false);
		WorkspaceState updated = service.updateNotifications(workspaceId, notifications);
		auditEventService.record(workspaceId, user, "NOTIFICATION_SETTINGS_UPDATED", "WORKSPACE", workspaceId, Map.of());
		return updated;
	}

	@GetMapping("/{workspaceId}/sessions")
	public List<StudySession> listSessions(
		@PathVariable String workspaceId,
		@RequestParam(required = false) String from,
		@RequestParam(required = false) String to,
		@RequestParam(required = false) String type,
		@RequestParam(required = false) String status
	) {
		return service.get(workspaceId).sessions().values().stream()
			.filter(session -> from == null || session.date().compareTo(from) >= 0)
			.filter(session -> to == null || session.date().compareTo(to) <= 0)
			.filter(session -> type == null || type.equals(session.type()))
			.filter(session -> status == null || status.equals(session.status()))
			.sorted(Comparator.comparing(StudySession::date))
			.toList();
	}

	@PostMapping("/{workspaceId}/sessions")
	@ResponseStatus(HttpStatus.CREATED)
	public WorkspaceState createSession(
		@PathVariable String workspaceId,
		@RequestBody SessionDraft draft,
		@AuthenticationPrincipal StudyIngPrincipal user,
		HttpServletRequest servletRequest
	) {
		accessService.requireManager(workspaceId, user.id(), false);
		String accessToken = credentialResolver.resolve(user, service.get(workspaceId), servletRequest).accessToken();
		WorkspaceState updated = service.saveSession(
			workspaceId,
			null,
			draft,
			user.displayName(),
			(workspace, current, next) -> sessionFileService.write(accessToken, workspace, current, next)
		);
		auditEventService.record(workspaceId, user, "SESSION_CREATED", "SESSION", draft.date(), Map.of("revision", updated.sessions().get(draft.date()).revision()));
		return updated;
	}

	@GetMapping("/{workspaceId}/sessions/{date}")
	public StudySession getSession(@PathVariable String workspaceId, @PathVariable String date) {
		StudySession session = service.get(workspaceId).sessions().get(date);
		if (session == null) throw new WorkspaceException("SESSION_NOT_FOUND", "해당 날짜의 일정을 찾을 수 없습니다.", 404);
		return session;
	}

	@PutMapping("/{workspaceId}/sessions/{date}")
	public WorkspaceState updateSession(
		@PathVariable String workspaceId,
		@PathVariable String date,
		@RequestBody SessionDraft draft,
		@AuthenticationPrincipal StudyIngPrincipal user,
		HttpServletRequest servletRequest
	) {
		accessService.requireManager(workspaceId, user.id(), false);
		String accessToken = credentialResolver.resolve(user, service.get(workspaceId), servletRequest).accessToken();
		WorkspaceState updated = service.saveSession(
			workspaceId,
			date,
			draft,
			user.displayName(),
			(workspace, current, next) -> sessionFileService.write(accessToken, workspace, current, next)
		);
		auditEventService.record(workspaceId, user, "SESSION_UPDATED", "SESSION", date, Map.of("revision", updated.sessions().get(date).revision()));
		return updated;
	}

	@DeleteMapping("/{workspaceId}/sessions/{date}")
	public WorkspaceState cancelSession(
		@PathVariable String workspaceId,
		@PathVariable String date,
		@RequestParam(required = false) Integer expectedRevision,
		@AuthenticationPrincipal StudyIngPrincipal user,
		HttpServletRequest servletRequest
	) {
		accessService.requireManager(workspaceId, user.id(), false);
		String accessToken = credentialResolver.resolve(user, service.get(workspaceId), servletRequest).accessToken();
		WorkspaceState updated = service.cancelSession(
			workspaceId,
			date,
			expectedRevision,
			user.displayName(),
			(workspace, current, next) -> sessionFileService.write(accessToken, workspace, current, next)
		);
		auditEventService.record(workspaceId, user, "SESSION_CANCELLED", "SESSION", date, Map.of("revision", updated.sessions().get(date).revision()));
		return updated;
	}

	@GetMapping("/{workspaceId}/sessions/{date}/submissions/me")
	public MemberSubmissionFile getMySubmissions(
		@PathVariable String workspaceId,
		@PathVariable String date,
		@AuthenticationPrincipal GitLabUser user
	) {
		WorkspaceState workspace = service.get(workspaceId);
		StudySession session = workspace.sessions().get(date);
		if (session == null) throw new WorkspaceException("SESSION_NOT_FOUND", "해당 날짜의 일정을 찾을 수 없습니다.", 404);
		StudyMember member = WorkspaceService.currentMember(workspace, user.id());
		return workspace.submissions().get(session.folder() + "/" + member.id());
	}

	@GetMapping("/{workspaceId}/sessions/{date}/items/{itemId}/submission")
	public SubmissionEntry getMyItemSubmission(
		@PathVariable String workspaceId,
		@PathVariable String date,
		@PathVariable String itemId,
		@AuthenticationPrincipal GitLabUser user
	) {
		MemberSubmissionFile file = getMySubmissions(workspaceId, date, user);
		if (file == null) return null;
		return file.submissions().stream().filter(entry -> entry.itemId().equals(itemId)).findFirst().orElse(null);
	}

	@GetMapping("/{workspaceId}/sessions/{date}/members/{memberId}/submission")
	public MemberSubmissionFile getMemberSubmission(
		@PathVariable String workspaceId,
		@PathVariable String date,
		@PathVariable String memberId
	) {
		WorkspaceState workspace = service.get(workspaceId);
		StudySession session = workspace.sessions().get(date);
		if (session == null) throw new WorkspaceException("SESSION_NOT_FOUND", "해당 날짜의 일정을 찾을 수 없습니다.", 404);
		return workspace.submissions().get(session.folder() + "/" + memberId);
	}

	@GetMapping("/{workspaceId}/sessions/{date}/members/{memberId}/reviews")
	public SubmissionReviewThread listSubmissionReviews(
		@PathVariable String workspaceId,
		@PathVariable String date,
		@PathVariable String memberId,
		@AuthenticationPrincipal StudyIngPrincipal user,
		HttpServletRequest servletRequest
	) {
		WorkspaceState workspace = service.get(workspaceId);
		String accessToken = credentialResolver.resolve(user, workspace, servletRequest).accessToken();
		return submissionReviewService.list(accessToken, workspace, date, memberId);
	}

	@PostMapping("/{workspaceId}/sessions/{date}/members/{memberId}/reviews")
	@ResponseStatus(HttpStatus.CREATED)
	public SubmissionReviewThread createSubmissionReview(
		@PathVariable String workspaceId,
		@PathVariable String date,
		@PathVariable String memberId,
		@RequestBody CreateSubmissionReviewRequest request,
		@AuthenticationPrincipal StudyIngPrincipal user,
		HttpServletRequest servletRequest
	) {
		WorkspaceState workspace = service.get(workspaceId);
		String accessToken = credentialResolver.resolve(user, workspace, servletRequest).accessToken();
		StudyMember target = workspace.members().stream()
			.filter(member -> member.id().equals(memberId))
			.findFirst()
			.orElseThrow(() -> new WorkspaceException("MEMBER_NOT_FOUND", "Workspace 멤버를 찾을 수 없습니다.", 404));
		SubmissionReviewThread thread = submissionReviewService.add(
			accessToken, workspace, date, memberId, request == null ? null : request.body()
		);
		auditEventService.record(
			workspaceId, user, "SUBMISSION_REVIEW_CREATED", "REPOSITORY_COMMIT", thread.commitId(),
			Map.of("date", date, "memberId", memberId, "filePath", thread.filePath())
		);
		if (target.gitlabUserId() != user.id()) {
			notificationService.create(
				target.gitlabUserId(), workspaceId, "SUBMISSION_REVIEW",
				"새 제출 리뷰가 등록되었습니다.", user.name() + "님이 " + date + " 제출에 댓글을 남겼습니다.",
				"/library/sessions/" + date
			);
		}
		return thread;
	}

	@PutMapping("/{workspaceId}/sessions/{date}/items/{itemId}/submission")
	public WorkspaceState upsertSubmission(
		@PathVariable String workspaceId,
		@PathVariable String date,
		@PathVariable String itemId,
		@RequestBody SubmissionRequest request,
		@AuthenticationPrincipal StudyIngPrincipal user,
		HttpServletRequest servletRequest
	) {
		String accessToken = credentialResolver.resolve(user, service.get(workspaceId), servletRequest).accessToken();
		WorkspaceState updated = service.upsertSubmission(
			workspaceId, date, itemId, request, user.id(),
			(workspace, targetSession, targetItem, member, current, next, commitMessage) -> submissionFileService.write(
				accessToken, workspace, targetSession, targetItem, member, current, next, commitMessage
			)
		);
		auditEventService.record(workspaceId, user, "SUBMISSION_UPSERTED", "SUBMISSION", date + ":" + itemId, Map.of());
		return updated;
	}

	@DeleteMapping("/{workspaceId}/sessions/{date}/items/{itemId}/submission")
	public WorkspaceState deleteSubmission(
		@PathVariable String workspaceId,
		@PathVariable String date,
		@PathVariable String itemId,
		@AuthenticationPrincipal StudyIngPrincipal user,
		HttpServletRequest servletRequest
	) {
		String accessToken = credentialResolver.resolve(user, service.get(workspaceId), servletRequest).accessToken();
		WorkspaceState updated = service.deleteSubmission(
			workspaceId, date, itemId, user.id(),
			(workspace, targetSession, targetItem, member, current, next, commitMessage) -> submissionFileService.write(
				accessToken, workspace, targetSession, targetItem, member, current, next, commitMessage
			)
		);
		auditEventService.record(workspaceId, user, "SUBMISSION_DELETED", "SUBMISSION", date + ":" + itemId, Map.of());
		return updated;
	}

	@PutMapping("/{workspaceId}/sessions/{date}/items/{itemId}/completion")
	public WorkspaceState completeItem(
		@PathVariable String workspaceId,
		@PathVariable String date,
		@PathVariable String itemId,
		@RequestBody(required = false) CompletionRequest request,
		@AuthenticationPrincipal StudyIngPrincipal user,
		HttpServletRequest servletRequest
	) {
		WorkspaceState workspaceState = service.get(workspaceId);
		requireChecklistItem(workspaceState, date, itemId);
		String accessToken = credentialResolver.resolve(user, workspaceState, servletRequest).accessToken();
		WorkspaceState updated = service.upsertSubmission(
			workspaceId, date, itemId,
			new SubmissionRequest("check", "completed", null,
				request == null ? null : request.expectedFileCommitId(), "study: complete checklist item"),
			user.id(),
			(workspace, session, item, member, current, next, commitMessage) -> submissionFileService.write(
				accessToken, workspace, session, item, member, current, next, commitMessage
			)
		);
		auditEventService.record(workspaceId, user, "CHECKLIST_ITEM_COMPLETED", "SESSION_ITEM", date + ":" + itemId, Map.of());
		return updated;
	}

	@DeleteMapping("/{workspaceId}/sessions/{date}/items/{itemId}/completion")
	public WorkspaceState uncompleteItem(
		@PathVariable String workspaceId,
		@PathVariable String date,
		@PathVariable String itemId,
		@RequestBody(required = false) CompletionRequest request,
		@AuthenticationPrincipal StudyIngPrincipal user,
		HttpServletRequest servletRequest
	) {
		WorkspaceState workspaceState = service.get(workspaceId);
		requireChecklistItem(workspaceState, date, itemId);
		String accessToken = credentialResolver.resolve(user, workspaceState, servletRequest).accessToken();
		WorkspaceState updated = service.deleteSubmission(
			workspaceId, date, itemId, user.id(), request == null ? null : request.expectedFileCommitId(),
			(workspace, targetSession, targetItem, member, current, next, commitMessage) -> submissionFileService.write(
				accessToken, workspace, targetSession, targetItem, member, current, next, commitMessage
			)
		);
		auditEventService.record(workspaceId, user, "CHECKLIST_ITEM_REOPENED", "SESSION_ITEM", date + ":" + itemId, Map.of());
		return updated;
	}

	private static SessionItem requireChecklistItem(WorkspaceState workspace, String date, String itemId) {
		StudySession session = workspace.sessions().get(date);
		SessionItem item = session == null ? null : session.items().stream()
			.filter(candidate -> candidate.id().equals(itemId) && "active".equals(candidate.status()))
			.findFirst().orElse(null);
		if (item == null || !"check".equals(item.kind())) {
			throw new WorkspaceException("ITEM_NOT_COMPLETABLE", "체크 항목만 완료 상태를 변경할 수 있습니다.", 400);
		}
		return item;
	}

	@GetMapping("/{workspaceId}/dashboard")
	public Map<String, Object> dashboard(@PathVariable String workspaceId, @RequestParam String date) {
		return service.dashboard(workspaceId, date);
	}

	@GetMapping("/{workspaceId}/records")
	public Map<String, Object> records(
		@PathVariable String workspaceId,
		@RequestParam(required = false) String from,
		@RequestParam(required = false) String to
	) {
		WorkspaceState workspace = service.get(workspaceId);
		List<Map<String, Object>> days = new ArrayList<>();
		workspace.sessions().values().stream()
			.filter(session -> from == null || session.date().compareTo(from) >= 0)
			.filter(session -> to == null || session.date().compareTo(to) <= 0)
			.sorted(Comparator.comparing(StudySession::date))
			.forEach(session -> days.add(service.dashboard(workspaceId, session.date())));
		return Map.of("from", from == null ? "" : from, "to", to == null ? "" : to, "days", days);
	}

	@GetMapping("/{workspaceId}/scores")
	public Map<String, Object> scores(
		@PathVariable String workspaceId,
		@RequestParam(required = false) String from,
		@RequestParam(required = false) String to
	) {
		return Map.of("from", from == null ? "" : from, "to", to == null ? "" : to, "scores", service.scores(workspaceId, from, to));
	}

	@GetMapping("/{workspaceId}/repository/tree")
	public List<Map<String, Object>> repositoryTree(@PathVariable String workspaceId) {
		WorkspaceState workspace = service.get(workspaceId);
		List<String> files = new ArrayList<>();
		workspace.sessions().values().stream().sorted(Comparator.comparing(StudySession::date)).forEach(session -> {
			files.add(WorkspaceRepositoryLayout.sessionPath(workspace, session));
			workspace.members().forEach(member -> {
				MemberSubmissionFile submission = workspace.submissions().get(session.folder() + "/" + member.id());
				if (submission != null) files.add(WorkspaceRepositoryLayout.submissionPath(workspace, session, member));
			});
		});
		files.sort(String::compareTo);

		Set<String> directories = new LinkedHashSet<>();
		for (String file : files) {
			String[] parts = file.split("/");
			String current = "";
			for (int index = 0; index < parts.length - 1; index++) {
				current = current.isEmpty() ? parts[index] : current + "/" + parts[index];
				directories.add(current);
			}
		}
		List<Map<String, Object>> tree = new ArrayList<>();
		directories.forEach(directory -> tree.add(treeItem(directory, fileName(directory), "tree")));
		files.forEach(file -> tree.add(treeItem(file, fileName(file), "blob")));
		return tree;
	}

	@GetMapping("/{workspaceId}/repository/file")
	public Map<String, Object> repositoryFile(@PathVariable String workspaceId, @RequestParam String path) {
		WorkspaceState workspace = service.get(workspaceId);
		String relativePath = com.studyworkspace.workspace.service.WorkspaceRepositoryPath.relative(workspace.repositoryBasePath(), path);
		if (relativePath == null || relativePath.contains("..")) {
			throw new WorkspaceException("FILE_PATH_NOT_ALLOWED", "허용되지 않은 저장소 경로입니다.", 400);
		}
		int schemaVersion = WorkspaceRepositoryLayout.schemaVersion(workspace.repositorySchemaVersion());
		RepositoryStorageLayoutPolicy.SessionLocation customSession = null;
		RepositoryStorageLayoutPolicy.SubmissionLocation customSubmission = null;
		WorkspaceRepositoryLayout.SessionLocation sessionLocation = null;
		WorkspaceRepositoryLayout.SubmissionLocation submissionLocation = null;
		if (schemaVersion == WorkspaceRepositoryLayout.CUSTOM_SCHEMA_VERSION && workspace.storageLayout() != null) {
			try {
				customSession = storageLayoutPolicy.matchSession(workspace.repositoryBasePath(), workspace.storageLayout(), path);
				customSubmission = storageLayoutPolicy.matchSubmission(workspace.repositoryBasePath(), workspace.storageLayout(), path);
			} catch (WorkspaceException exception) {
				throw new WorkspaceException("FILE_PATH_NOT_ALLOWED", "허용되지 않은 저장소 경로입니다.", 400);
			}
		} else {
			sessionLocation = WorkspaceRepositoryLayout.matchSession(relativePath, schemaVersion).orElse(null);
			submissionLocation = WorkspaceRepositoryLayout.matchSubmission(relativePath, schemaVersion).orElse(null);
		}
		if (sessionLocation == null && submissionLocation == null && customSession == null && customSubmission == null) {
			throw new WorkspaceException("FILE_PATH_NOT_ALLOWED", "허용되지 않은 저장소 경로입니다.", 400);
		}
		String date = customSession != null ? customSession.date()
			: customSubmission != null ? customSubmission.date()
			: sessionLocation != null ? sessionLocation.date() : submissionLocation.date();
		StudySession session = workspace.sessions().values().stream().filter(candidate -> candidate.date().equals(date)).findFirst()
			.orElseThrow(() -> new WorkspaceException("FILE_NOT_FOUND", "파일을 찾을 수 없습니다.", 404));
		String content;
		String commitId;
		if (sessionLocation != null || customSession != null) {
			content = sessionYamlSerializer.serialize(session);
			commitId = session.lastCommitId();
		} else {
			String memberName = customSubmission == null ? submissionLocation.fileName() : customSubmission.blockValues().get("NAME");
			StudyMember member = workspace.members().stream().filter(candidate -> candidate.fileName().equals(memberName)
				|| candidate.fileName().equals(memberName + ".md")).findFirst()
				.orElseThrow(() -> new WorkspaceException("FILE_NOT_FOUND", "파일을 찾을 수 없습니다.", 404));
			MemberSubmissionFile submission = workspace.submissions().get(session.folder() + "/" + member.id());
			if (submission == null) throw new WorkspaceException("FILE_NOT_FOUND", "파일을 찾을 수 없습니다.", 404);
			content = submissionMarkdownCodec.encode(submission, session);
			commitId = submission.lastCommitId();
		}
		return Map.of(
			"fileName", fileName(path), "filePath", path, "size", content.getBytes(StandardCharsets.UTF_8).length,
			"content", content, "ref", workspace.defaultBranch(), "blobId", commitId, "commitId", commitId, "lastCommitId", commitId
		);
	}

	private static String fileName(String path) {
		int slash = path.lastIndexOf('/');
		return slash < 0 ? path : path.substring(slash + 1);
	}

	private static Map<String, Object> treeItem(String path, String name, String type) {
		return Map.of("id", "local-" + path, "name", name, "type", type, "path", path, "mode", "blob".equals(type) ? "100644" : "040000");
	}

	private static RepositoryProvider parseProvider(String value) {
		try { return RepositoryProvider.valueOf(value.trim().toUpperCase(java.util.Locale.ROOT)); }
		catch (IllegalArgumentException exception) {
			throw new WorkspaceException("INVALID_REPOSITORY_PROVIDER", "지원하지 않는 저장소 Provider입니다.", 400);
		}
	}

	private void requireGitLabWorkspace(String workspaceId) {
		WorkspaceState workspace = service.get(workspaceId);
		if (workspace.repository() != null && !RepositoryProvider.GITLAB.name().equals(workspace.repository().provider())) {
			throw new WorkspaceException(
				"MEMBER_SYNC_PROVIDER_UNSUPPORTED",
				"GitHub Workspace 멤버는 저장소 권한을 통해 직접 참여할 수 있습니다.",
				409
			);
		}
	}

	private void recordSyncFailure(String workspaceId, GitLabUser user, String jobId, String code, String message) {
		String safeMessage = message == null || message.isBlank() ? "GitLab 동기화 중 알 수 없는 오류가 발생했습니다." : message;
		auditEventService.record(workspaceId, user, "REPOSITORY_SYNC_FAILED", "SYNC_JOB", jobId, Map.of("code", code, "message", safeMessage));
		notificationService.create(user.id(), workspaceId, "SYNC_FAILED", "GitLab 동기화에 실패했습니다.", safeMessage, "/settings/data");
	}

}
