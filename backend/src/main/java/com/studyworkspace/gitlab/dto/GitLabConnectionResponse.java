package com.studyworkspace.gitlab.dto;

import java.time.Instant;
import java.util.List;

public record GitLabConnectionResponse(
	boolean configured,
	String status,
	String message,
	Instant checkedAt,
	GitLabUser user,
	GitLabProject project,
	List<GitLabTreeItem> repositoryTree
) {
	public static GitLabConnectionResponse notConfigured() {
		return new GitLabConnectionResponse(
			false,
			"NOT_CONFIGURED",
			"백엔드 환경변수에 GitLab 토큰과 프로젝트를 설정해 주세요.",
			Instant.now(),
			null,
			null,
			List.of()
		);
	}

	public static GitLabConnectionResponse connected(
		GitLabUser user,
		GitLabProject project,
		List<GitLabTreeItem> repositoryTree
	) {
		return new GitLabConnectionResponse(
			true,
			"CONNECTED",
			"GitLab 사용자, 프로젝트, 저장소 조회에 성공했습니다.",
			Instant.now(),
			user,
			project,
			List.copyOf(repositoryTree)
		);
	}
}
