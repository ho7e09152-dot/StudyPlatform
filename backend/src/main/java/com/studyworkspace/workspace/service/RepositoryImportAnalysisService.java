package com.studyworkspace.workspace.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.regex.Pattern;

import com.studyworkspace.gitlab.dto.GitLabFileContent;
import com.studyworkspace.gitlab.dto.GitLabProject;
import com.studyworkspace.gitlab.dto.GitLabTreeItem;
import com.studyworkspace.gitlab.service.GitLabOAuthProjectService;
import com.studyworkspace.workspace.domain.WorkspaceException;
import com.studyworkspace.workspace.dto.RepositoryImportAnalysis;
import com.studyworkspace.workspace.dto.RepositoryImportAnalysis.ImportIssue;
import org.springframework.stereotype.Service;

@Service
public class RepositoryImportAnalysisService {
	private static final Pattern CONFIG_SCHEMA = Pattern.compile("(?m)^repositorySchemaVersion:\\s*(\\d+)\\s*$");
	private static final int MAX_ANALYZED_SESSION_FILES = 500;

	private final GitLabOAuthProjectService gitLab;
	private final SessionYamlParser parser;

	public RepositoryImportAnalysisService(GitLabOAuthProjectService gitLab, SessionYamlParser parser) {
		this.gitLab = gitLab;
		this.parser = parser;
	}

	public RepositoryImportAnalysis analyze(String accessToken, long projectId) {
		GitLabProject project = gitLab.getProject(accessToken, projectId);
		String branch = project.defaultBranch() == null || project.defaultBranch().isBlank() ? "main" : project.defaultBranch();
		List<GitLabTreeItem> tree = project.defaultBranch() == null || project.defaultBranch().isBlank()
			? List.of()
			: gitLab.getAllRepositoryTree(accessToken, project.id(), branch);
		return analyze(accessToken, project, branch, tree);
	}

	private RepositoryImportAnalysis analyze(String accessToken, GitLabProject project, String branch, List<GitLabTreeItem> tree) {
		List<GitLabTreeItem> files = tree.stream().filter(item -> "blob".equals(item.type())).toList();
		boolean rootV1 = files.stream().anyMatch(item ->
			WorkspaceRepositoryLayout.isSessionPath(item.path(), WorkspaceRepositoryLayout.LEGACY_SCHEMA_VERSION)
		);
		boolean nestedV1 = files.stream().anyMatch(item ->
			WorkspaceRepositoryLayout.isSessionPath(
				WorkspaceRepositoryPath.relative(WorkspaceRepositoryLayout.MANAGED_BASE_PATH, item.path()),
				WorkspaceRepositoryLayout.LEGACY_SCHEMA_VERSION
			)
		);
		boolean nestedV2 = files.stream().anyMatch(item ->
			WorkspaceRepositoryLayout.isSessionPath(
				WorkspaceRepositoryPath.relative(WorkspaceRepositoryLayout.MANAGED_BASE_PATH, item.path()),
				WorkspaceRepositoryLayout.CURRENT_SCHEMA_VERSION
			)
		);
		boolean hasWorkspaceMarker = files.stream().anyMatch(item -> WorkspaceRepositoryLayout.CONFIG_PATH.equals(item.path()));
		Integer markerSchemaVersion = null;
		if (hasWorkspaceMarker) {
			try {
				GitLabFileContent marker = gitLab.getRepositoryFile(accessToken, project.id(), WorkspaceRepositoryLayout.CONFIG_PATH, branch);
				var matcher = CONFIG_SCHEMA.matcher(marker.content());
				if (marker.content().startsWith("version: 1\n") && matcher.find()) {
					int parsed = Integer.parseInt(matcher.group(1));
					if (parsed == WorkspaceRepositoryLayout.LEGACY_SCHEMA_VERSION
						|| parsed == WorkspaceRepositoryLayout.CURRENT_SCHEMA_VERSION) {
						markerSchemaVersion = parsed;
					}
				}
			} catch (RuntimeException ignored) {
				markerSchemaVersion = null;
			}
		}

		int detectedLayouts = (rootV1 ? 1 : 0) + (nestedV1 ? 1 : 0) + (nestedV2 ? 1 : 0);
		String basePath = rootV1 && detectedLayouts == 1 ? "" : WorkspaceRepositoryLayout.MANAGED_BASE_PATH;
		int schemaVersion = nestedV2
			? WorkspaceRepositoryLayout.CURRENT_SCHEMA_VERSION
			: rootV1 || nestedV1
				? WorkspaceRepositoryLayout.LEGACY_SCHEMA_VERSION
				: markerSchemaVersion != null
					? markerSchemaVersion
					: WorkspaceRepositoryLayout.CURRENT_SCHEMA_VERSION;

		List<ImportIssue> issues = new ArrayList<>();
		boolean hardConflict = false;
		if (detectedLayouts > 1) {
			hardConflict = true;
			issues.add(new ImportIssue(".study-workspace", "MIXED_REPOSITORY_LAYOUT", "V1과 V2 저장 경로가 함께 있어 자동으로 선택할 수 없습니다."));
		}
		if (markerSchemaVersion != null && detectedLayouts > 0 && markerSchemaVersion != schemaVersion) {
			hardConflict = true;
			issues.add(new ImportIssue(WorkspaceRepositoryLayout.CONFIG_PATH, "SCHEMA_MARKER_MISMATCH", "설정 파일의 스키마 버전과 실제 파일 경로가 다릅니다."));
		}

		List<GitLabTreeItem> candidates = files.stream().filter(item -> {
			String relative = WorkspaceRepositoryPath.relative(basePath, item.path());
			return WorkspaceRepositoryLayout.isSessionPath(relative, schemaVersion);
		}).toList();
		if (candidates.size() > MAX_ANALYZED_SESSION_FILES) {
			throw new WorkspaceException("IMPORT_ANALYSIS_TOO_LARGE", "분석할 일정 파일이 500개를 초과합니다.", 413);
		}

		int validSessions = 0;
		for (GitLabTreeItem item : candidates) {
			try {
				GitLabFileContent file = gitLab.getRepositoryFile(accessToken, project.id(), item.path(), branch);
				parser.parse(WorkspaceRepositoryPath.relative(basePath, item.path()), file.content(), file.lastCommitId());
				validSessions++;
			} catch (RuntimeException exception) {
				String message = exception instanceof WorkspaceException workspaceException
					? workspaceException.getMessage() : "파일을 분석하지 못했습니다.";
				issues.add(new ImportIssue(item.path(), "INVALID_SESSION_FILE", message));
			}
		}
		int validSubmissions = (int) files.stream().filter(item -> {
			String relative = WorkspaceRepositoryPath.relative(basePath, item.path());
			return WorkspaceRepositoryLayout.isSubmissionPath(relative, schemaVersion);
		}).count();
		boolean validWorkspaceMarker = markerSchemaVersion != null;
		boolean reservedPathConflict = !rootV1 && !nestedV1 && !nestedV2 && !validWorkspaceMarker
			&& files.stream().anyMatch(item -> item.path().equals(".study-workspace") || item.path().startsWith(".study-workspace/"));
		if (reservedPathConflict) {
			hardConflict = true;
			issues.add(new ImportIssue(".study-workspace", "RESERVED_PATH_CONFLICT", "서비스 전용 경로가 이미 다른 용도로 사용되고 있습니다."));
		}
		if (nestedV2 && !validWorkspaceMarker) {
			issues.add(new ImportIssue(WorkspaceRepositoryLayout.CONFIG_PATH, "MISSING_WORKSPACE_CONFIG", "V2 파일은 있지만 Workspace 설정 파일이 없습니다."));
		}

		String classification;
		if (files.isEmpty()) classification = "EMPTY";
		else if (hardConflict) classification = "CONFLICTED";
		else if (validSessions > 0 && !issues.isEmpty()) classification = "PARTIALLY_COMPATIBLE";
		else if (validSessions > 0) classification = "COMPATIBLE";
		else classification = "LEGACY";
		int recognized = validSessions + validSubmissions + (validWorkspaceMarker ? 1 : 0);
		return new RepositoryImportAnalysis(
			project.id(), project.pathWithNamespace(), branch, classification, basePath, schemaVersion, fingerprint(files),
			files.size(), validSessions, validSubmissions, Math.max(0, files.size() - recognized), List.copyOf(issues)
		);
	}

	static String fingerprint(List<GitLabTreeItem> files) {
		try {
			MessageDigest digest = MessageDigest.getInstance("SHA-256");
			files.stream().sorted(Comparator.comparing(GitLabTreeItem::path)).forEach(item -> {
				digest.update(item.path().getBytes(StandardCharsets.UTF_8));
				digest.update((byte) 0);
				digest.update((item.id() == null ? "" : item.id()).getBytes(StandardCharsets.UTF_8));
				digest.update((byte) '\n');
			});
			return HexFormat.of().formatHex(digest.digest());
		} catch (java.security.NoSuchAlgorithmException exception) {
			throw new IllegalStateException(exception);
		}
	}
}
