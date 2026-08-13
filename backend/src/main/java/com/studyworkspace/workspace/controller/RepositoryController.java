package com.studyworkspace.workspace.controller;

import java.util.List;

import com.studyworkspace.auth.service.GitLabOAuthTokenProvider;
import com.studyworkspace.gitlab.service.GitLabOAuthProjectService;
import com.studyworkspace.workspace.domain.WorkspaceException;
import com.studyworkspace.workspace.dto.RepositorySummary;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/repositories")
public class RepositoryController {
	private final GitLabOAuthTokenProvider tokens;
	private final GitLabOAuthProjectService gitLab;

	public RepositoryController(GitLabOAuthTokenProvider tokens, GitLabOAuthProjectService gitLab) {
		this.tokens = tokens;
		this.gitLab = gitLab;
	}

	@GetMapping
	public List<RepositorySummary> list(
		@RequestParam(required = false) String search,
		@RequestParam(defaultValue = "1") int page,
		@RequestParam(defaultValue = "50") int perPage,
		HttpServletRequest request
	) {
		if (search != null && search.length() > 100) {
			throw new WorkspaceException("INVALID_REQUEST", "저장소 검색어는 100자 이하여야 합니다.", 400);
		}
		var oauth = tokens.requireValidSession(request);
		return gitLab.listProjects(oauth.accessToken(), search, Math.max(1, page), Math.max(1, Math.min(perPage, 100)))
			.stream().map(RepositorySummary::fromGitLab).toList();
	}
}
