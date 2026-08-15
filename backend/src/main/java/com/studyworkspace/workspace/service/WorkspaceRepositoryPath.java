package com.studyworkspace.workspace.service;

import org.springframework.util.StringUtils;

public final class WorkspaceRepositoryPath {
	private WorkspaceRepositoryPath() { }

	public static String normalizeBasePath(String value) {
		if (!StringUtils.hasText(value)) return "";
		String normalized = value.trim().replaceAll("^/+|/+$", "");
		boolean invalid = normalized.isBlank() || normalized.length() > 240 || normalized.contains("\\")
			|| normalized.chars().anyMatch(Character::isISOControl)
			|| java.util.Arrays.stream(normalized.split("/"))
				.anyMatch(segment -> segment.isBlank() || ".".equals(segment) || "..".equals(segment)
					|| ".git".equalsIgnoreCase(segment));
		if (invalid) {
			throw new com.studyworkspace.workspace.domain.WorkspaceException(
				"INVALID_REPOSITORY_BASE_PATH", "학습 기록 위치가 올바르지 않습니다.", 400
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
