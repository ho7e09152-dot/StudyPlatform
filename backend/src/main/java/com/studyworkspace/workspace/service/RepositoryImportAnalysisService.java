package com.studyworkspace.workspace.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.studyworkspace.gitlab.dto.GitLabTreeItem;
import com.studyworkspace.gitlab.service.GitLabOAuthProjectService;
import com.studyworkspace.gitlab.service.GitLabRepositoryDataAdapter;
import com.studyworkspace.workspace.domain.RepositoryProvider;
import com.studyworkspace.workspace.domain.RepositoryStorageLayout;
import com.studyworkspace.workspace.domain.WorkspaceModels.RepositoryIdentity;
import com.studyworkspace.workspace.dto.RepositorySummary;
import com.studyworkspace.workspace.port.RepositoryDataPort;
import com.studyworkspace.workspace.domain.WorkspaceException;
import com.studyworkspace.workspace.dto.RepositoryImportAnalysis;
import com.studyworkspace.workspace.dto.RepositoryImportAnalysis.ImportIssue;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;

@Service
public class RepositoryImportAnalysisService {
	private static final Pattern CONFIG_SCHEMA = Pattern.compile("(?m)^repositorySchemaVersion:\\s*(\\d+)\\s*$");
	private static final int MAX_ANALYZED_SESSION_FILES = 500;

	private final RepositoryDataService repositories;
	private final SessionYamlParser parser;
	private final RepositoryLayoutDetectionService layoutDetection;
	private final RepositoryStorageLayoutPolicy storageLayouts;

	@Autowired
	public RepositoryImportAnalysisService(RepositoryDataService repositories, SessionYamlParser parser,
		RepositoryLayoutDetectionService layoutDetection, RepositoryStorageLayoutPolicy storageLayouts) {
		this.repositories = repositories;
		this.parser = parser;
		this.layoutDetection = layoutDetection;
		this.storageLayouts = storageLayouts;
	}

	public RepositoryImportAnalysisService(RepositoryDataService repositories, SessionYamlParser parser) {
		this(repositories, parser, new RepositoryLayoutDetectionService(), new RepositoryStorageLayoutPolicy());
	}

	/** Test/backward-compatible GitLab constructor. */
	public RepositoryImportAnalysisService(GitLabOAuthProjectService gitLab, SessionYamlParser parser) {
		this(new RepositoryDataService(List.of(new GitLabRepositoryDataAdapter(gitLab))), parser,
			new RepositoryLayoutDetectionService(), new RepositoryStorageLayoutPolicy());
	}

	public RepositoryImportAnalysis analyze(String accessToken, long projectId) {
		return analyze(accessToken, RepositoryProvider.GITLAB, Long.toString(projectId));
	}

	public RepositoryImportAnalysis analyze(String accessToken, RepositoryProvider provider, String externalRepositoryId) {
		RepositoryDataPort port = repositories.require(provider);
		RepositorySummary project = port.getRepository(accessToken, externalRepositoryId);
		String branch = project.defaultBranch() == null || project.defaultBranch().isBlank() ? "main" : project.defaultBranch();
		RepositoryIdentity identity = identity(project, branch);
		List<RepositoryDataPort.TreeEntry> tree = project.defaultBranch() == null || project.defaultBranch().isBlank()
			? List.of() : port.listTree(accessToken, identity);
		return analyze(accessToken, port, project, identity, branch, tree);
	}

	private RepositoryImportAnalysis analyze(String accessToken, RepositoryDataPort port, RepositorySummary project,
		RepositoryIdentity identity, String branch, List<RepositoryDataPort.TreeEntry> tree) {
		List<RepositoryDataPort.TreeEntry> files = tree.stream().filter(item -> "blob".equals(item.type())).toList();
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
		List<String> markerPaths = files.stream().map(RepositoryDataPort.TreeEntry::path)
			.filter(WorkspaceRepositoryLayout::isConfigPath).sorted().toList();
		String markerPath = markerPaths.size() == 1 ? markerPaths.getFirst() : null;
		boolean hasWorkspaceMarker = markerPath != null;
		boolean markerInvalid = markerPaths.size() > 1;
		Integer markerSchemaVersion = null;
		String markerBasePath = null;
		RepositoryStorageLayout markerLayout = null;
		if (hasWorkspaceMarker) {
			try {
				RepositoryDataPort.RepositoryFile marker = port.getFile(accessToken, identity, markerPath, branch);
				var matcher = CONFIG_SCHEMA.matcher(marker.content());
				if (marker.content().startsWith("version: 1\n") && matcher.find()) {
					int parsed = Integer.parseInt(matcher.group(1));
					if (parsed == WorkspaceRepositoryLayout.LEGACY_SCHEMA_VERSION
						|| parsed == WorkspaceRepositoryLayout.CURRENT_SCHEMA_VERSION
						|| parsed == WorkspaceRepositoryLayout.CUSTOM_SCHEMA_VERSION) {
						markerSchemaVersion = parsed;
					}
					if (parsed == WorkspaceRepositoryLayout.CUSTOM_SCHEMA_VERSION) {
						markerBasePath = WorkspaceRepositoryPath.normalizeBasePath(configValue(marker.content(), "repositoryBasePath"));
						markerLayout = parseLayout(marker.content());
						if (!WorkspaceRepositoryLayout.customConfigPath(markerBasePath).equals(markerPath)) markerInvalid = true;
					}
				}
			} catch (RuntimeException ignored) {
				markerSchemaVersion = null;
				markerInvalid = true;
			}
		}

		int detectedLayouts = (rootV1 ? 1 : 0) + (nestedV1 ? 1 : 0) + (nestedV2 ? 1 : 0);
		String basePath = markerSchemaVersion != null && markerSchemaVersion == WorkspaceRepositoryLayout.CUSTOM_SCHEMA_VERSION
			? markerBasePath
			: rootV1 && detectedLayouts == 1 ? "" : detectedLayouts > 0
				? WorkspaceRepositoryLayout.MANAGED_BASE_PATH : WorkspaceRepositoryLayout.DEFAULT_STORAGE_BASE_PATH;
		int schemaVersion = markerSchemaVersion != null && markerSchemaVersion == WorkspaceRepositoryLayout.CUSTOM_SCHEMA_VERSION
			? WorkspaceRepositoryLayout.CUSTOM_SCHEMA_VERSION
			: nestedV2
			? WorkspaceRepositoryLayout.CURRENT_SCHEMA_VERSION
			: rootV1 || nestedV1
				? WorkspaceRepositoryLayout.LEGACY_SCHEMA_VERSION
				: markerSchemaVersion != null
					? markerSchemaVersion
					: WorkspaceRepositoryLayout.CURRENT_SCHEMA_VERSION;

		List<ImportIssue> issues = new ArrayList<>();
		boolean hardConflict = false;
		String markerIssuePath = markerPath == null
			? WorkspaceRepositoryLayout.customConfigPath(WorkspaceRepositoryLayout.DEFAULT_STORAGE_BASE_PATH) : markerPath;
		if (markerInvalid) {
			hardConflict = true;
			issues.add(new ImportIssue(markerIssuePath, "INVALID_WORKSPACE_CONFIG_LOCATION",
				"Workspace 설정 파일은 학습 기록 위치의 .study-workspace 폴더에 하나만 있어야 합니다."));
		}
		if (detectedLayouts > 1) {
			hardConflict = true;
			issues.add(new ImportIssue(".study-workspace", "MIXED_REPOSITORY_LAYOUT", "V1과 V2 저장 경로가 함께 있어 자동으로 선택할 수 없습니다."));
		}
		if (markerSchemaVersion != null && detectedLayouts > 0 && markerSchemaVersion != schemaVersion) {
			hardConflict = true;
			issues.add(new ImportIssue(markerIssuePath, "SCHEMA_MARKER_MISMATCH", "설정 파일의 스키마 버전과 실제 파일 경로가 다릅니다."));
		}
		if (markerSchemaVersion != null && markerSchemaVersion == WorkspaceRepositoryLayout.CUSTOM_SCHEMA_VERSION
			&& markerLayout == null) {
			hardConflict = true;
			issues.add(new ImportIssue(markerIssuePath, "INVALID_STORAGE_LAYOUT_CONFIG",
				"Workspace 저장 구조 설정을 해석할 수 없습니다."));
		}

		RepositoryStorageLayout activeMarkerLayout = markerLayout;
		List<RepositoryDataPort.TreeEntry> candidates = new ArrayList<>();
		for (RepositoryDataPort.TreeEntry item : files) {
			String relative = WorkspaceRepositoryPath.relative(basePath, item.path());
			if (schemaVersion != WorkspaceRepositoryLayout.CUSTOM_SCHEMA_VERSION || activeMarkerLayout == null) {
				if (WorkspaceRepositoryLayout.isSessionPath(relative, schemaVersion)) candidates.add(item);
				continue;
			}
			try {
				if (storageLayouts.matchSession(basePath, activeMarkerLayout, item.path()) != null) candidates.add(item);
			} catch (WorkspaceException exception) {
				issues.add(new ImportIssue(item.path(), "INVALID_SESSION_FILE", exception.getMessage()));
			}
		}
		if (candidates.size() > MAX_ANALYZED_SESSION_FILES) {
			throw new WorkspaceException("IMPORT_ANALYSIS_TOO_LARGE", "분석할 일정 파일이 500개를 초과합니다.", 413);
		}

		int validSessions = 0;
		for (RepositoryDataPort.TreeEntry item : candidates) {
			try {
				RepositoryDataPort.RepositoryFile file = port.getFile(accessToken, identity, item.path(), branch);
				if (schemaVersion == WorkspaceRepositoryLayout.CUSTOM_SCHEMA_VERSION && activeMarkerLayout != null) {
					var location = storageLayouts.matchSession(basePath, activeMarkerLayout, item.path());
					parser.parseCustom(WorkspaceRepositoryPath.relative(basePath, item.path()), file.content(), file.version(), location.date());
				} else {
					parser.parse(WorkspaceRepositoryPath.relative(basePath, item.path()), file.content(), file.version());
				}
				validSessions++;
			} catch (RuntimeException exception) {
				String message = exception instanceof WorkspaceException workspaceException
					? workspaceException.getMessage() : "파일을 분석하지 못했습니다.";
				issues.add(new ImportIssue(item.path(), "INVALID_SESSION_FILE", message));
			}
		}
		int validSubmissions = 0;
		for (RepositoryDataPort.TreeEntry item : files) {
			String relative = WorkspaceRepositoryPath.relative(basePath, item.path());
			if (schemaVersion != WorkspaceRepositoryLayout.CUSTOM_SCHEMA_VERSION || activeMarkerLayout == null) {
				if (WorkspaceRepositoryLayout.isSubmissionPath(relative, schemaVersion)) validSubmissions++;
				continue;
			}
			try {
				if (storageLayouts.matchSubmission(basePath, activeMarkerLayout, item.path()) != null) validSubmissions++;
			} catch (WorkspaceException exception) {
				issues.add(new ImportIssue(item.path(), "INVALID_SUBMISSION_FILE", exception.getMessage()));
			}
		}
		boolean validWorkspaceMarker = markerSchemaVersion != null;
		String defaultSystemPath = WorkspaceRepositoryLayout.customConfigPath(WorkspaceRepositoryLayout.DEFAULT_STORAGE_BASE_PATH);
		String defaultSystemDirectory = defaultSystemPath.substring(0, defaultSystemPath.lastIndexOf('/'));
		boolean reservedPathConflict = !rootV1 && !nestedV1 && !nestedV2 && !validWorkspaceMarker
			&& files.stream().anyMatch(item -> item.path().equals(defaultSystemDirectory)
				|| item.path().startsWith(defaultSystemDirectory + "/"));
		if (reservedPathConflict) {
			hardConflict = true;
			issues.add(new ImportIssue(defaultSystemDirectory, "RESERVED_PATH_CONFLICT", "서비스 전용 경로가 이미 다른 용도로 사용되고 있습니다."));
		}
		if (nestedV2 && !validWorkspaceMarker) {
			issues.add(new ImportIssue(WorkspaceRepositoryLayout.CONFIG_PATH, "MISSING_WORKSPACE_CONFIG", "V2 파일은 있지만 Workspace 설정 파일이 없습니다."));
		}

		String classification;
		RepositoryLayoutDetectionService.Detection detected = detectedLayouts == 0 && markerSchemaVersion == null
			? layoutDetection.detect(tree) : RepositoryLayoutDetectionService.Detection.none();
		if (files.isEmpty()) classification = "EMPTY";
		else if (hardConflict) classification = "CONFLICTED";
		else if (validSessions > 0 && !issues.isEmpty()) classification = "PARTIALLY_COMPATIBLE";
		else if (validSessions > 0) classification = "COMPATIBLE";
		else if (detected.detected()) classification = "DETECTED";
		else classification = "LEGACY";
		int recognized = validSessions + Math.max(validSubmissions, detected.records()) + (validWorkspaceMarker ? 1 : 0);
		String effectiveBasePath = detected.detected() ? detected.basePath() : basePath;
		return new RepositoryImportAnalysis(
			Long.parseLong(project.externalId()), project.fullName(), branch, classification, effectiveBasePath, schemaVersion, fingerprint(files),
			files.size(), validSessions, Math.max(validSubmissions, detected.records()), Math.max(0, files.size() - recognized), List.copyOf(issues),
			markerLayout != null ? markerLayout : detected.layout(), detected.confidence(), detected.records()
		);
	}

	private RepositoryStorageLayout parseLayout(String content) {
		try {
			return storageLayouts.validate(new RepositoryStorageLayout(
				split(configValue(content, "storageFolderBlocks")),
				split(configValue(content, "storageFileNameBlocks")),
				configValue(content, "storageYearFormat"), configValue(content, "storageMonthFormat"),
				configValue(content, "storageDateFormat"), configValue(content, "storageDayFormat"),
				configValue(content, "storageExtension")
			));
		} catch (RuntimeException exception) {
			return null;
		}
	}

	private static List<String> split(String value) {
		return value == null || value.isBlank() ? List.of() : java.util.Arrays.stream(value.split(","))
			.map(String::trim).filter(part -> !part.isEmpty()).toList();
	}

	private static String configValue(String content, String key) {
		Matcher matcher = Pattern.compile("(?m)^" + Pattern.quote(key) + ":\\s*[\\\"]?([^\\\"\\r\\n]+)[\\\"]?\\s*$").matcher(content);
		return matcher.find() ? matcher.group(1).trim() : null;
	}

	public static String fingerprint(List<? extends Object> rawFiles) {
		List<RepositoryDataPort.TreeEntry> files = rawFiles.stream().map(item -> {
			if (item instanceof RepositoryDataPort.TreeEntry entry) return entry;
			GitLabTreeItem legacy = (GitLabTreeItem) item;
			return new RepositoryDataPort.TreeEntry(legacy.id(), legacy.name(), legacy.type(), legacy.path(), legacy.mode());
		}).toList();
		try {
			MessageDigest digest = MessageDigest.getInstance("SHA-256");
			files.stream().sorted(Comparator.comparing(RepositoryDataPort.TreeEntry::path)).forEach(item -> {
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

	private static RepositoryIdentity identity(RepositorySummary project, String branch) {
		return new RepositoryIdentity(project.provider().name(), project.externalId(), project.fullName(), project.webUrl(),
			project.visibility(), branch, project.capabilities().canRead(), project.capabilities().canWrite(),
			project.capabilities().canManage(), project.providerPermission());
	}
}
