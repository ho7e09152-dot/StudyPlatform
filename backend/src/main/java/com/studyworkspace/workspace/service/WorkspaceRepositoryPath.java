package com.studyworkspace.workspace.service;

import org.springframework.util.StringUtils;

public final class WorkspaceRepositoryPath {
	private WorkspaceRepositoryPath() { }

	public static String normalizeBasePath(String value) {
		if (!StringUtils.hasText(value)) return "";
		String normalized = value.trim().replaceAll("^/+|/+$", "");
		if (!normalized.equals(".study-workspace")) {
			throw new com.studyworkspace.workspace.domain.WorkspaceException(
				"INVALID_REPOSITORY_BASE_PATH", "지원하지 않는 Workspace 저장 경로입니다.", 400
			);
		}
		return normalized;
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
