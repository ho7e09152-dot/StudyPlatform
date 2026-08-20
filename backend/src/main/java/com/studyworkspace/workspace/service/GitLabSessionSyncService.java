package com.studyworkspace.workspace.service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.studyworkspace.common.exception.RepositoryProviderException;
import com.studyworkspace.gitlab.service.GitLabOAuthProjectService;
import com.studyworkspace.gitlab.service.GitLabRepositoryDataAdapter;
import com.studyworkspace.workspace.port.RepositoryDataPort;
import com.studyworkspace.workspace.domain.WorkspaceException;
import com.studyworkspace.workspace.domain.WorkspaceModels.StudySession;
import com.studyworkspace.workspace.domain.WorkspaceModels.StudyMember;
import com.studyworkspace.workspace.domain.WorkspaceModels.SessionItem;
import com.studyworkspace.workspace.domain.WorkspaceModels.MemberSubmissionFile;
import com.studyworkspace.workspace.domain.WorkspaceModels.WorkspaceState;
import com.studyworkspace.workspace.dto.WorkspaceSyncResponse;
import com.studyworkspace.workspace.dto.WorkspaceSyncResponse.SyncFailure;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;

@Service
public class GitLabSessionSyncService {
	private final RepositoryDataService repositories;
	private final SessionYamlParser parser;
	private final WorkspaceService workspaces;
	private final SubmissionMarkdownCodec submissionCodec;
	private final RepositoryStorageLayoutPolicy storageLayouts;

	@Autowired
	public GitLabSessionSyncService(
		RepositoryDataService repositories,
		SessionYamlParser parser,
		WorkspaceService workspaces,
		SubmissionMarkdownCodec submissionCodec,
		RepositoryStorageLayoutPolicy storageLayouts
	) {
		this.repositories = repositories;
		this.parser = parser;
		this.workspaces = workspaces;
		this.submissionCodec = submissionCodec;
		this.storageLayouts = storageLayouts;
	}

	public GitLabSessionSyncService(RepositoryDataService repositories, SessionYamlParser parser,
		WorkspaceService workspaces, SubmissionMarkdownCodec submissionCodec) {
		this(repositories, parser, workspaces, submissionCodec, new RepositoryStorageLayoutPolicy());
	}

	public GitLabSessionSyncService(GitLabOAuthProjectService gitLab, SessionYamlParser parser,
		WorkspaceService workspaces, SubmissionMarkdownCodec submissionCodec) {
		this(new RepositoryDataService(List.of(new GitLabRepositoryDataAdapter(gitLab))), parser, workspaces, submissionCodec,
			new RepositoryStorageLayoutPolicy());
	}

	public WorkspaceSyncResponse sync(String accessToken, String workspaceId) {
		WorkspaceState current = workspaces.get(workspaceId);
		RepositoryDataPort repository = repositories.require(current.repository());
		List<RepositoryDataPort.TreeEntry> tree = repository.listTree(accessToken, current.repository());
		Map<String, StudySession> imported = new LinkedHashMap<>();
		Map<String, String> failedDates = new LinkedHashMap<>();
		List<SyncFailure> failures = new java.util.ArrayList<>();
		int validSessionCount = 0;
		int schemaVersion = WorkspaceRepositoryLayout.schemaVersion(current.repositorySchemaVersion());

		for (RepositoryDataPort.TreeEntry item : tree) {
			String relativePath = WorkspaceRepositoryPath.relative(current.repositoryBasePath(), item.path());
			if (!"blob".equals(item.type())) continue;
			String date;
			try {
				if (schemaVersion == WorkspaceRepositoryLayout.CUSTOM_SCHEMA_VERSION && current.storageLayout() != null) {
					var location = storageLayouts.matchSession(current.repositoryBasePath(), current.storageLayout(), item.path());
					if (location == null) continue;
					date = location.date();
				} else {
					var location = WorkspaceRepositoryLayout.matchSession(relativePath, schemaVersion).orElse(null);
					if (location == null) continue;
					date = location.date();
				}
			} catch (WorkspaceException exception) {
				failures.add(new SyncFailure(item.path(), exception.code(), exception.getMessage()));
				continue;
			}
			try {
				RepositoryDataPort.RepositoryFile file = repository.getFile(
					accessToken, current.repository(), item.path(), current.defaultBranch()
				);
				StudySession session = schemaVersion == WorkspaceRepositoryLayout.CUSTOM_SCHEMA_VERSION
					? parser.parseCustom(relativePath, file.content(), file.version(), date)
					: parser.parse(relativePath, file.content(), file.version());
				imported.put(session.date(), session);
				validSessionCount++;
			} catch (WorkspaceException exception) {
				failedDates.put(date, item.path());
				failures.add(new SyncFailure(item.path(), exception.code(), exception.getMessage()));
			} catch (RepositoryProviderException exception) {
				if (exception.upstreamStatus() != 404) throw exception;
				failedDates.put(date, item.path());
				failures.add(new SyncFailure(item.path(), "REPOSITORY_SESSION_FILE_NOT_FOUND", "목록에 있던 일정 파일을 다시 찾지 못했습니다."));
			}
		}

		for (String failedDate : failedDates.keySet()) {
			StudySession previous = current.sessions().get(failedDate);
			if (previous != null) imported.putIfAbsent(failedDate, previous);
		}
		if (schemaVersion == WorkspaceRepositoryLayout.CUSTOM_SCHEMA_VERSION
			&& current.storageLayout() != null && "DETECTED".equals(current.importMode())) {
			for (RepositoryDataPort.TreeEntry item : tree) {
				if (!"blob".equals(item.type())) continue;
				var location = storageLayouts.matchSubmission(current.repositoryBasePath(), current.storageLayout(), item.path());
				if (location != null) imported.putIfAbsent(location.date(), detectedSession(location.date()));
			}
		}
		int removedSessions = (int) current.sessions().keySet().stream()
			.filter(date -> !imported.containsKey(date) && !failedDates.containsKey(date))
			.count();

		Map<String, MemberSubmissionFile> importedSubmissions = new LinkedHashMap<>();
		Set<String> failedSubmissionKeys = new java.util.HashSet<>();
		int validSubmissionCount = 0;
		for (RepositoryDataPort.TreeEntry item : tree) {
			String relativePath = WorkspaceRepositoryPath.relative(current.repositoryBasePath(), item.path());
			if (!"blob".equals(item.type())) continue;
			String locationDate;
			String legacyFileName = null;
			RepositoryStorageLayoutPolicy.SubmissionLocation customLocation = null;
			try {
				if (schemaVersion == WorkspaceRepositoryLayout.CUSTOM_SCHEMA_VERSION && current.storageLayout() != null) {
					customLocation = storageLayouts.matchSubmission(current.repositoryBasePath(), current.storageLayout(), item.path());
					if (customLocation == null) continue;
					locationDate = customLocation.date();
				} else {
					var location = WorkspaceRepositoryLayout.matchSubmission(relativePath, schemaVersion).orElse(null);
					if (location == null) continue;
					locationDate = location.date();
					legacyFileName = location.fileName();
				}
			} catch (WorkspaceException exception) {
				failures.add(new SyncFailure(item.path(), exception.code(), exception.getMessage()));
				continue;
			}
			StudySession session = imported.get(locationDate);
			if (session == null) {
				failures.add(new SyncFailure(item.path(), "SUBMISSION_SESSION_MISSING", "제출 파일에 대응하는 session.yml이 없습니다."));
				continue;
			}
			String key = null;
			try {
				RepositoryDataPort.RepositoryFile file = repository.getFile(
					accessToken, current.repository(), item.path(), current.defaultBranch()
				);
				MemberSubmissionFile submission;
				StudyMember member;
				try {
					submission = submissionCodec.decode(file.content(), file.version());
					member = memberById(current, submission.memberId());
				} catch (WorkspaceException exception) {
					if (!"DETECTED".equals(current.importMode()) || customLocation == null) throw exception;
					member = memberByDetectedName(current, customLocation.blockValues().get("NAME"));
					if (member == null) continue;
					submission = detectedSubmission(file, session, member);
				}
				if (member == null && legacyFileName != null) member = memberByFileName(current, legacyFileName);
				if (member == null) continue;
				key = session.folder() + "/" + member.id();
				validateSubmissionFile(submission, session, member);
				importedSubmissions.put(key, submission);
				validSubmissionCount++;
			} catch (WorkspaceException exception) {
				if (key != null) failedSubmissionKeys.add(key);
				failures.add(new SyncFailure(item.path(), exception.code(), exception.getMessage()));
			} catch (RepositoryProviderException exception) {
				if (exception.upstreamStatus() != 404) throw exception;
				if (key != null) failedSubmissionKeys.add(key);
				failures.add(new SyncFailure(item.path(), "REPOSITORY_SUBMISSION_FILE_NOT_FOUND", "목록에 있던 제출 파일을 다시 찾지 못했습니다."));
			}
		}
		for (String failedKey : failedSubmissionKeys) {
			MemberSubmissionFile previous = current.submissions().get(failedKey);
			if (previous != null) importedSubmissions.putIfAbsent(failedKey, previous);
		}
		int removedSubmissions = (int) current.submissions().keySet().stream()
			.filter(key -> !importedSubmissions.containsKey(key) && !failedSubmissionKeys.contains(key))
			.count();
		WorkspaceState updated = workspaces.replaceRepositoryState(workspaceId, imported, importedSubmissions);
		return new WorkspaceSyncResponse(
			updated, validSessionCount, removedSessions, validSubmissionCount, removedSubmissions,
			List.copyOf(failures), updated.lastSyncedAt()
		);
	}

	private static StudySession detectedSession(String date) {
		SessionItem item = new SessionItem(
			"imported-record", 1, "기존 학습 기록", "free", null, null, "text", true, "active", null, null
		);
		String timestamp = date + "T00:00:00Z";
		return new StudySession(
			date, WorkspaceRepositoryLayout.dateFolder(date), 1, "free", "기존 학습 기록", "", "active",
			date + "T23:59:59Z", null, timestamp, "repository", timestamp, "repository", null, List.of(item), List.of(), null
		);
	}

	private static MemberSubmissionFile detectedSubmission(RepositoryDataPort.RepositoryFile file, StudySession session, StudyMember member) {
		String timestamp = session.date() + "T00:00:00Z";
		var entry = new com.studyworkspace.workspace.domain.WorkspaceModels.SubmissionEntry(
			"imported-record", "text", file.content(), null, timestamp, timestamp
		);
		return new MemberSubmissionFile(
			1, member.id(), member.gitlabUserId(), member.displayName(), session.folder(), session.revision(), session.type(),
			timestamp, List.of(entry), null, file.version(), "imported existing record"
		);
	}

	private static StudyMember memberByFileName(WorkspaceState workspace, String fileName) {
		return workspace.members().stream().filter(member -> fileName.equals(member.fileName())).findFirst().orElse(null);
	}

	private static StudyMember memberById(WorkspaceState workspace, String memberId) {
		return workspace.members().stream().filter(member -> member.id().equals(memberId)).findFirst().orElse(null);
	}

	private static StudyMember memberByDetectedName(WorkspaceState workspace, String name) {
		if (name == null) return null;
		return workspace.members().stream().filter(member -> {
			String fileStem = member.fileName() != null && member.fileName().toLowerCase().endsWith(".md")
				? member.fileName().substring(0, member.fileName().length() - 3) : member.fileName();
			return name.equals(fileStem) || name.equals(member.displayName()) || name.equals(member.username());
		}).findFirst().orElse(null);
	}

	private static void validateSubmissionFile(MemberSubmissionFile file, StudySession session, StudyMember member) {
		if (!member.id().equals(file.memberId()) || member.gitlabUserId() != file.gitlabUserId()
			|| (!member.displayName().equals(file.username()) && !member.username().equals(file.username()))) {
			throw invalidSubmission("제출 파일의 멤버 정보가 Workspace 매핑과 다릅니다.");
		}
		if (!session.folder().equals(file.date()) || !session.type().equals(file.sessionType())) {
			throw invalidSubmission("제출 파일의 일정 정보가 session.yml과 다릅니다.");
		}
		for (var entry : file.submissions()) {
			SessionItem item = java.util.stream.Stream.concat(session.items().stream(), session.archivedItems().stream())
				.filter(candidate -> candidate.id().equals(entry.itemId())).findFirst().orElse(null);
			String expectedType = item == null || "event".equals(item.kind())
				? null : "check".equals(item.kind()) ? "check" : item.submitType();
			if (expectedType == null || !expectedType.equals(entry.type())) {
				throw invalidSubmission("제출 항목이 session.yml 정의와 일치하지 않습니다: " + entry.itemId());
			}
		}
	}

	private static WorkspaceException invalidSubmission(String message) {
		return new WorkspaceException("SUBMISSION_FILE_INVALID", message, 422);
	}

}
