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
	private static final Pattern ROOT_SESSION = Pattern.compile("^\\d{6}/session\\.yml$");
	private static final Pattern NESTED_SESSION = Pattern.compile("^\\.study-workspace/\\d{6}/session\\.yml$");
	private static final Pattern SUBMISSION = Pattern.compile("^\\d{6}/[^/]+\\.md$");
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
		boolean nestedFormat = files.stream().anyMatch(item -> NESTED_SESSION.matcher(item.path()).matches());
		boolean rootFormat = files.stream().anyMatch(item -> ROOT_SESSION.matcher(item.path()).matches());
		boolean hasWorkspaceMarker = files.stream().anyMatch(item -> ".study-workspace/config.yml".equals(item.path()));
		boolean validWorkspaceMarker = false;
		if (hasWorkspaceMarker) {
			try {
				GitLabFileContent marker = gitLab.getRepositoryFile(accessToken, project.id(), ".study-workspace/config.yml", branch);
				validWorkspaceMarker = marker.content().startsWith("version: 1\nrepositorySchemaVersion: 1\n");
			} catch (RuntimeException ignored) {
				validWorkspaceMarker = false;
			}
		}
		String basePath = nestedFormat ? ".study-workspace" : rootFormat ? "" : ".study-workspace";
		List<GitLabTreeItem> candidates = files.stream().filter(item -> {
			String relative = WorkspaceRepositoryPath.relative(basePath, item.path());
			return relative != null && ROOT_SESSION.matcher(relative).matches();
		}).toList();
		if (candidates.size() > MAX_ANALYZED_SESSION_FILES) {
			throw new WorkspaceException("IMPORT_ANALYSIS_TOO_LARGE", "분석할 일정 파일이 500개를 초과합니다.", 413);
		}

		List<ImportIssue> issues = new ArrayList<>();
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
			return relative != null && SUBMISSION.matcher(relative).matches() && !relative.endsWith("/session.yml");
		}).count();
		boolean reservedPathConflict = !rootFormat && !nestedFormat && !validWorkspaceMarker
			&& files.stream().anyMatch(item -> item.path().equals(".study-workspace") || item.path().startsWith(".study-workspace/"));
		if (reservedPathConflict) {
			issues.add(new ImportIssue(".study-workspace", "RESERVED_PATH_CONFLICT", "서비스 전용 경로가 이미 다른 용도로 사용되고 있습니다."));
		}

		String classification;
		if (files.isEmpty()) classification = "EMPTY";
		else if (reservedPathConflict) classification = "CONFLICTED";
		else if (validSessions > 0 && !issues.isEmpty()) classification = "PARTIALLY_COMPATIBLE";
		else if (validSessions > 0) classification = "COMPATIBLE";
		else classification = "LEGACY";
		int recognized = validSessions + validSubmissions;
		return new RepositoryImportAnalysis(
			project.id(), project.pathWithNamespace(), branch, classification, basePath, fingerprint(files),
			files.size(), validSessions, validSubmissions, Math.max(0, files.size() - recognized), List.copyOf(issues)
		);
	}

	private static String fingerprint(List<GitLabTreeItem> files) {
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
