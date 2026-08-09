package com.studyworkspace.workspace.service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.studyworkspace.common.exception.GitLabApiException;
import com.studyworkspace.gitlab.dto.GitLabFileContent;
import com.studyworkspace.gitlab.dto.GitLabTreeItem;
import com.studyworkspace.gitlab.service.GitLabOAuthProjectService;
import com.studyworkspace.workspace.domain.WorkspaceException;
import com.studyworkspace.workspace.domain.WorkspaceModels.StudySession;
import com.studyworkspace.workspace.domain.WorkspaceModels.StudyMember;
import com.studyworkspace.workspace.domain.WorkspaceModels.SessionItem;
import com.studyworkspace.workspace.domain.WorkspaceModels.MemberSubmissionFile;
import com.studyworkspace.workspace.domain.WorkspaceModels.WorkspaceState;
import com.studyworkspace.workspace.dto.WorkspaceSyncResponse;
import com.studyworkspace.workspace.dto.WorkspaceSyncResponse.SyncFailure;
import org.springframework.stereotype.Service;

@Service
public class GitLabSessionSyncService {
	private static final Pattern SESSION_PATH = Pattern.compile("^(\\d{6})/session\\.yml$");
	private static final Pattern SUBMISSION_PATH = Pattern.compile("^(\\d{6})/([A-Za-z0-9._-]+\\.md)$");

	private final GitLabOAuthProjectService gitLab;
	private final SessionYamlParser parser;
	private final WorkspaceService workspaces;
	private final SubmissionMarkdownCodec submissionCodec;

	public GitLabSessionSyncService(
		GitLabOAuthProjectService gitLab,
		SessionYamlParser parser,
		WorkspaceService workspaces,
		SubmissionMarkdownCodec submissionCodec
	) {
		this.gitLab = gitLab;
		this.parser = parser;
		this.workspaces = workspaces;
		this.submissionCodec = submissionCodec;
	}

	public WorkspaceSyncResponse sync(String accessToken, String workspaceId) {
		WorkspaceState current = workspaces.get(workspaceId);
		List<GitLabTreeItem> tree = gitLab.getAllRepositoryTree(
			accessToken, current.gitlabProjectId(), current.defaultBranch()
		);
		Map<String, StudySession> imported = new LinkedHashMap<>();
		Map<String, String> failedDates = new LinkedHashMap<>();
		List<SyncFailure> failures = new java.util.ArrayList<>();
		int validSessionCount = 0;

		for (GitLabTreeItem item : tree) {
			Matcher matcher = SESSION_PATH.matcher(item.path() == null ? "" : item.path());
			if (!"blob".equals(item.type()) || !matcher.matches()) continue;
			String date = folderDate(matcher.group(1));
			try {
				GitLabFileContent file = gitLab.getRepositoryFile(
					accessToken, current.gitlabProjectId(), item.path(), current.defaultBranch()
				);
				StudySession session = parser.parse(item.path(), file.content(), file.lastCommitId());
				imported.put(session.date(), session);
				validSessionCount++;
			} catch (WorkspaceException exception) {
				failedDates.put(date, item.path());
				failures.add(new SyncFailure(item.path(), exception.code(), exception.getMessage()));
			} catch (GitLabApiException exception) {
				if (exception.upstreamStatus() != 404) throw exception;
				failedDates.put(date, item.path());
				failures.add(new SyncFailure(item.path(), "GITLAB_SESSION_FILE_NOT_FOUND", "목록에 있던 일정 파일을 다시 찾지 못했습니다."));
			}
		}

		for (String failedDate : failedDates.keySet()) {
			StudySession previous = current.sessions().get(failedDate);
			if (previous != null) imported.putIfAbsent(failedDate, previous);
		}
		int removedSessions = (int) current.sessions().keySet().stream()
			.filter(date -> !imported.containsKey(date) && !failedDates.containsKey(date))
			.count();

		Map<String, MemberSubmissionFile> importedSubmissions = new LinkedHashMap<>();
		Set<String> failedSubmissionKeys = new java.util.HashSet<>();
		int validSubmissionCount = 0;
		for (GitLabTreeItem item : tree) {
			Matcher matcher = SUBMISSION_PATH.matcher(item.path() == null ? "" : item.path());
			if (!"blob".equals(item.type()) || !matcher.matches()) continue;
			StudyMember member = memberByFileName(current, matcher.group(2));
			if (member == null) continue;
			StudySession session = sessionByFolder(imported, matcher.group(1));
			if (session == null) {
				failures.add(new SyncFailure(item.path(), "SUBMISSION_SESSION_MISSING", "제출 파일에 대응하는 session.yml이 없습니다."));
				continue;
			}
			String key = session.folder() + "/" + member.id();
			try {
				GitLabFileContent file = gitLab.getRepositoryFile(
					accessToken, current.gitlabProjectId(), item.path(), current.defaultBranch()
				);
				MemberSubmissionFile submission = submissionCodec.decode(file.content(), file.lastCommitId());
				validateSubmissionFile(submission, session, member);
				importedSubmissions.put(key, submission);
				validSubmissionCount++;
			} catch (WorkspaceException exception) {
				failedSubmissionKeys.add(key);
				failures.add(new SyncFailure(item.path(), exception.code(), exception.getMessage()));
			} catch (GitLabApiException exception) {
				if (exception.upstreamStatus() != 404) throw exception;
				failedSubmissionKeys.add(key);
				failures.add(new SyncFailure(item.path(), "GITLAB_SUBMISSION_FILE_NOT_FOUND", "목록에 있던 제출 파일을 다시 찾지 못했습니다."));
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

	private static StudyMember memberByFileName(WorkspaceState workspace, String fileName) {
		return workspace.members().stream().filter(member -> fileName.equals(member.fileName())).findFirst().orElse(null);
	}

	private static StudySession sessionByFolder(Map<String, StudySession> sessions, String folder) {
		return sessions.values().stream().filter(session -> folder.equals(session.folder())).findFirst().orElse(null);
	}

	private static void validateSubmissionFile(MemberSubmissionFile file, StudySession session, StudyMember member) {
		if (!member.id().equals(file.memberId()) || member.gitlabUserId() != file.gitlabUserId() || !member.username().equals(file.username())) {
			throw invalidSubmission("제출 파일의 멤버 정보가 Workspace 매핑과 다릅니다.");
		}
		if (!session.folder().equals(file.date()) || !session.type().equals(file.sessionType())) {
			throw invalidSubmission("제출 파일의 일정 정보가 session.yml과 다릅니다.");
		}
		for (var entry : file.submissions()) {
			SessionItem item = java.util.stream.Stream.concat(session.items().stream(), session.archivedItems().stream())
				.filter(candidate -> candidate.id().equals(entry.itemId())).findFirst().orElse(null);
			if (item == null || !item.submitType().equals(entry.type())) {
				throw invalidSubmission("제출 항목이 session.yml 정의와 일치하지 않습니다: " + entry.itemId());
			}
		}
	}

	private static WorkspaceException invalidSubmission(String message) {
		return new WorkspaceException("SUBMISSION_FILE_INVALID", message, 422);
	}

	private static String folderDate(String folder) {
		return "20" + folder.substring(0, 2) + "-" + folder.substring(2, 4) + "-" + folder.substring(4, 6);
	}
}
