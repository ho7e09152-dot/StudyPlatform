package com.studyworkspace.workspace.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import com.studyworkspace.gitlab.dto.GitLabBatchCommitResponse;
import com.studyworkspace.gitlab.dto.GitLabCommitAction;
import com.studyworkspace.gitlab.dto.GitLabFileContent;
import com.studyworkspace.gitlab.dto.GitLabTreeItem;
import com.studyworkspace.gitlab.service.GitLabOAuthProjectService;
import com.studyworkspace.workspace.domain.WorkspaceException;
import com.studyworkspace.workspace.domain.WorkspaceModels.WorkspaceState;
import com.studyworkspace.workspace.dto.RepositorySchemaMigrationPreview;
import com.studyworkspace.workspace.dto.RepositorySchemaMigrationPreview.Blocker;
import com.studyworkspace.workspace.dto.RepositorySchemaMigrationPreview.FileMove;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class RepositorySchemaMigrationService {
	private static final int MAX_COMMIT_ACTIONS = 100;

	private final GitLabOAuthProjectService gitLab;

	public RepositorySchemaMigrationService(GitLabOAuthProjectService gitLab) {
		this.gitLab = gitLab;
	}

	public RepositorySchemaMigrationPreview preview(String accessToken, WorkspaceState workspace) {
		List<GitLabTreeItem> tree = gitLab.getAllRepositoryTree(
			accessToken, workspace.gitlabProjectId(), workspace.defaultBranch()
		);
		return preview(accessToken, workspace, tree);
	}

	public MigrationCommit migrate(
		String accessToken,
		WorkspaceState workspace,
		String expectedTreeFingerprint,
		String authorName
	) {
		List<GitLabTreeItem> tree = gitLab.getAllRepositoryTree(
			accessToken, workspace.gitlabProjectId(), workspace.defaultBranch()
		);
		RepositorySchemaMigrationPreview preview = preview(accessToken, workspace, tree);
		if (!StringUtils.hasText(expectedTreeFingerprint)
			|| !expectedTreeFingerprint.equals(preview.treeFingerprint())) {
			throw new WorkspaceException("REPOSITORY_CHANGED", "마이그레이션 확인 이후 저장소가 변경되었습니다. 다시 확인해 주세요.", 409);
		}
		if (!preview.ready()) {
			String message = preview.blockers().isEmpty()
				? "저장소 구조를 마이그레이션할 수 없습니다."
				: preview.blockers().getFirst().message();
			throw new WorkspaceException("REPOSITORY_MIGRATION_BLOCKED", message, 409);
		}

		List<GitLabCommitAction> actions = new ArrayList<>();
		preview.moves().forEach(move -> actions.add(GitLabCommitAction.move(move.sourcePath(), move.targetPath())));
		String configContent = RepositoryInitializationService.configContent(
			workspace.id(), WorkspaceRepositoryLayout.CURRENT_SCHEMA_VERSION
		);
		if (WorkspaceRepositoryLayout.MANAGED_BASE_PATH.equals(workspace.repositoryBasePath())) {
			actions.add(GitLabCommitAction.update(WorkspaceRepositoryLayout.CONFIG_PATH, configContent, null));
		} else {
			actions.add(GitLabCommitAction.create(WorkspaceRepositoryLayout.CONFIG_PATH, configContent));
		}

		GitLabBatchCommitResponse commit = gitLab.createCommit(
			accessToken,
			workspace.gitlabProjectId(),
			workspace.defaultBranch(),
			"study: migrate repository layout to schema v2",
			actions,
			authorName
		);
		if (commit == null || !StringUtils.hasText(commit.id())) {
			throw new WorkspaceException("REPOSITORY_MIGRATION_COMMIT_MISSING", "GitLab 마이그레이션 커밋 SHA를 확인하지 못했습니다.", 502);
		}
		return new MigrationCommit(commit.id(), preview.totalMoves());
	}

	private RepositorySchemaMigrationPreview preview(
		String accessToken,
		WorkspaceState workspace,
		List<GitLabTreeItem> tree
	) {
		int currentVersion = WorkspaceRepositoryLayout.schemaVersion(workspace.repositorySchemaVersion());
		List<GitLabTreeItem> files = tree.stream().filter(item -> "blob".equals(item.type())).toList();
		List<Blocker> blockers = new ArrayList<>();
		List<FileMove> moves = new ArrayList<>();
		Set<String> repositoryPaths = new HashSet<>();
		files.forEach(item -> repositoryPaths.add(item.path()));

		if (currentVersion != WorkspaceRepositoryLayout.LEGACY_SCHEMA_VERSION) {
			blockers.add(new Blocker(
				WorkspaceRepositoryLayout.CONFIG_PATH,
				"REPOSITORY_ALREADY_V2",
				"이미 저장소 스키마 V2를 사용하고 있습니다."
			));
		}

		if (!WorkspaceRepositoryLayout.MANAGED_BASE_PATH.equals(workspace.repositoryBasePath())) {
			files.stream()
				.filter(item -> item.path().startsWith(WorkspaceRepositoryLayout.MANAGED_BASE_PATH + "/"))
				.findFirst()
				.ifPresent(item -> blockers.add(new Blocker(
					item.path(), "TARGET_BASE_PATH_IN_USE", ".study-workspace 경로가 이미 사용 중이어서 자동 이동할 수 없습니다."
				)));
		} else {
			validateManagedConfig(accessToken, workspace, repositoryPaths, blockers);
		}

		int sessionFiles = 0;
		int submissionFiles = 0;
		for (GitLabTreeItem item : files) {
			String relative = WorkspaceRepositoryPath.relative(workspace.repositoryBasePath(), item.path());
			var session = WorkspaceRepositoryLayout.matchSession(relative, WorkspaceRepositoryLayout.LEGACY_SCHEMA_VERSION).orElse(null);
			if (session != null) {
				String target = WorkspaceRepositoryPath.join(
					WorkspaceRepositoryLayout.MANAGED_BASE_PATH,
					WorkspaceRepositoryLayout.relativeSessionPath(
						WorkspaceRepositoryLayout.CURRENT_SCHEMA_VERSION, session.date(), session.folder()
					)
				);
				moves.add(new FileMove(item.path(), target, "SESSION"));
				sessionFiles++;
				continue;
			}
			var submission = WorkspaceRepositoryLayout.matchSubmission(relative, WorkspaceRepositoryLayout.LEGACY_SCHEMA_VERSION).orElse(null);
			if (submission != null) {
				String target = WorkspaceRepositoryPath.join(
					WorkspaceRepositoryLayout.MANAGED_BASE_PATH,
					WorkspaceRepositoryLayout.relativeSubmissionPath(
						WorkspaceRepositoryLayout.CURRENT_SCHEMA_VERSION,
						submission.date(), submission.folder(), submission.fileName()
					)
				);
				moves.add(new FileMove(item.path(), target, "SUBMISSION"));
				submissionFiles++;
				continue;
			}
			if (relative != null && relative.matches("\\d{6}/.+")) {
				blockers.add(new Blocker(item.path(), "UNSUPPORTED_LEGACY_FILE", "날짜 폴더에 지원하지 않는 파일이 있어 자동 이동할 수 없습니다."));
			}
		}

		moves.sort(Comparator.comparing(FileMove::sourcePath));
		for (FileMove move : moves) {
			if (repositoryPaths.contains(move.targetPath())) {
				blockers.add(new Blocker(move.targetPath(), "MIGRATION_TARGET_EXISTS", "이동할 V2 파일 경로가 이미 존재합니다."));
			}
		}
		if (moves.isEmpty() && currentVersion == WorkspaceRepositoryLayout.LEGACY_SCHEMA_VERSION) {
			blockers.add(new Blocker("", "NO_LEGACY_FILES", "이동할 V1 일정 파일이 없습니다."));
		}
		if (moves.size() + 1 > MAX_COMMIT_ACTIONS) {
			blockers.add(new Blocker("", "MIGRATION_TOO_LARGE", "한 번에 이동할 수 있는 파일 수 99개를 초과했습니다."));
		}

		String fingerprint = RepositoryImportAnalysisService.fingerprint(files);
		return new RepositorySchemaMigrationPreview(
			currentVersion,
			WorkspaceRepositoryLayout.CURRENT_SCHEMA_VERSION,
			workspace.repositoryBasePath(),
			WorkspaceRepositoryLayout.MANAGED_BASE_PATH,
			fingerprint,
			sessionFiles,
			submissionFiles,
			moves.size(),
			blockers.isEmpty() && !moves.isEmpty(),
			List.copyOf(moves),
			List.copyOf(blockers)
		);
	}

	private void validateManagedConfig(
		String accessToken,
		WorkspaceState workspace,
		Set<String> repositoryPaths,
		List<Blocker> blockers
	) {
		if (!repositoryPaths.contains(WorkspaceRepositoryLayout.CONFIG_PATH)) {
			blockers.add(new Blocker(
				WorkspaceRepositoryLayout.CONFIG_PATH, "WORKSPACE_CONFIG_MISSING", "기존 Workspace 설정 파일을 찾지 못했습니다."
			));
			return;
		}
		try {
			GitLabFileContent config = gitLab.getRepositoryFile(
				accessToken, workspace.gitlabProjectId(), WorkspaceRepositoryLayout.CONFIG_PATH, workspace.defaultBranch()
			);
			String expected = RepositoryInitializationService.configContent(
				workspace.id(), WorkspaceRepositoryLayout.LEGACY_SCHEMA_VERSION
			);
			if (!expected.equals(config.content())) {
				blockers.add(new Blocker(
					WorkspaceRepositoryLayout.CONFIG_PATH, "WORKSPACE_CONFIG_MISMATCH", "Workspace 설정 파일이 현재 연결 정보와 일치하지 않습니다."
				));
			}
		} catch (RuntimeException exception) {
			blockers.add(new Blocker(
				WorkspaceRepositoryLayout.CONFIG_PATH, "WORKSPACE_CONFIG_UNREADABLE", "Workspace 설정 파일을 확인하지 못했습니다."
			));
		}
	}

	public record MigrationCommit(String commitId, int movedFiles) { }
}
