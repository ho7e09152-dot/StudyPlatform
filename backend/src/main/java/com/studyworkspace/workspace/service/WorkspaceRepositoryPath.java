package com.studyworkspace.workspace.service;

import com.studyworkspace.common.validation.RepositoryPathSafety;
import org.springframework.util.StringUtils;

public final class WorkspaceRepositoryPath {
	private WorkspaceRepositoryPath() { }

	public static String normalizeBasePath(String value) {
		if (!StringUtils.hasText(value)) return "";
		String raw = value.trim();
		boolean invalidRaw = raw.startsWith("/") || raw.contains("\\") || raw.contains("//")
			|| RepositoryPathSafety.containsDisallowedUnicode(raw);
		if (invalidRaw) throw invalid();
		String normalized = raw.replaceAll("/+$", "");
		boolean invalid = normalized.isBlank() || normalized.length() > RepositoryStorageLayoutPolicy.MAX_RESOLVED_PATH_CHARS
			|| RepositoryPathSafety.containsDisallowedUnicode(normalized)
			|| java.util.Arrays.stream(normalized.split("/"))
				.anyMatch(segment -> segment.isBlank() || ".".equals(segment) || "..".equals(segment)
					|| ".git".equalsIgnoreCase(segment)
					|| segment.length() > RepositoryStorageLayoutPolicy.MAX_SEGMENT_CHARS
					|| segment.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > RepositoryStorageLayoutPolicy.MAX_SEGMENT_BYTES);
		if (invalid) throw invalid();
		return normalized;
	}

	private static com.studyworkspace.workspace.domain.WorkspaceException invalid() {
		return new com.studyworkspace.workspace.domain.WorkspaceException(
			"INVALID_REPOSITORY_BASE_PATH", "학습 기록 위치가 올바르지 않습니다.", 400
		);
	}

	public static String join(String basePath, String relativePath) {
		String base = normalizeBasePath(basePath);
		return base.isEmpty() ? relativePath : base + "/" + relativePath;
	}

	public static String relative(String basePath, String repositoryPath) {
		String base = normalizeBasePath(basePath);
		if (base.isEmpty()) return repositoryPath;
		String prefix = base + "/";
		return repositoryPath != null && repositoryPath.startsWith(prefix)
			? repositoryPath.substring(prefix.length())
			: null;
	}
}
