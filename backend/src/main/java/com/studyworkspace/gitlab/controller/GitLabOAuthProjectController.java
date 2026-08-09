package com.studyworkspace.gitlab.controller;

import java.util.List;

import com.studyworkspace.auth.dto.GitLabOAuthSession;
import com.studyworkspace.auth.service.GitLabOAuthTokenProvider;
import com.studyworkspace.gitlab.dto.GitLabConnectionResponse;
import com.studyworkspace.gitlab.dto.GitLabProject;
import com.studyworkspace.gitlab.dto.GitLabFileContent;
import com.studyworkspace.gitlab.service.GitLabOAuthProjectService;
import com.studyworkspace.gitlab.service.RepositoryPathPolicy;
import com.studyworkspace.workspace.domain.WorkspaceException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.studyworkspace.workspace.dto.RepositoryImportAnalysis;
import com.studyworkspace.workspace.service.RepositoryImportAnalysisService;

@RestController
@RequestMapping("/api/v1/gitlab/projects")
public class GitLabOAuthProjectController {

	private final GitLabOAuthTokenProvider tokenProvider;
	private final GitLabOAuthProjectService projectService;
	private final RepositoryPathPolicy pathPolicy;
	private final RepositoryImportAnalysisService importAnalysisService;

	public GitLabOAuthProjectController(
		GitLabOAuthTokenProvider tokenProvider,
		GitLabOAuthProjectService projectService,
		RepositoryPathPolicy pathPolicy,
		RepositoryImportAnalysisService importAnalysisService
	) {
		this.tokenProvider = tokenProvider;
		this.projectService = projectService;
		this.pathPolicy = pathPolicy;
		this.importAnalysisService = importAnalysisService;
	}

	@GetMapping("/{projectId}/import-analysis")
	public RepositoryImportAnalysis importAnalysis(@PathVariable long projectId, HttpServletRequest request) {
		GitLabOAuthSession oauth = tokenProvider.requireValidSession(request);
		return importAnalysisService.analyze(oauth.accessToken(), projectId);
	}

	@GetMapping
	public List<GitLabProject> projects(
		@RequestParam(required = false) String search,
		@RequestParam(defaultValue = "1") int page,
		@RequestParam(defaultValue = "20") int perPage,
		HttpServletRequest request
	) {
		if (search != null && search.length() > 100) {
			throw new WorkspaceException("INVALID_REQUEST", "프로젝트 검색어는 100자 이하여야 합니다.", 400);
		}
		GitLabOAuthSession oauth = tokenProvider.requireValidSession(request);
		int safePage = Math.max(1, page);
		int safePerPage = Math.max(1, Math.min(perPage, 100));
		return projectService.listProjects(oauth.accessToken(), search, safePage, safePerPage);
	}

	@GetMapping("/{projectId}/connection-check")
	public GitLabConnectionResponse projectConnection(
		@PathVariable long projectId,
		HttpServletRequest request
	) {
		GitLabOAuthSession oauth = tokenProvider.requireValidSession(request);
		GitLabProject project = projectService.getProject(oauth.accessToken(), projectId);
		return GitLabConnectionResponse.connected(
			oauth.user(),
			project,
			projectService.getRepositoryTree(oauth.accessToken(), project.id(), project.defaultBranch())
		);
	}

	@GetMapping("/{projectId}/repository/file")
	public GitLabFileContent repositoryFile(
		@PathVariable long projectId,
		@RequestParam String path,
		@RequestParam(required = false) String ref,
		HttpServletRequest request
	) {
		GitLabOAuthSession oauth = tokenProvider.requireValidSession(request);
		GitLabProject project = projectService.getProject(oauth.accessToken(), projectId);
		String resolvedRef = ref == null || ref.isBlank() ? project.defaultBranch() : ref;
		if (resolvedRef == null || resolvedRef.isBlank()) resolvedRef = "HEAD";
		return projectService.getRepositoryFile(
			oauth.accessToken(),
			project.id(),
			pathPolicy.validate(path),
			resolvedRef
		);
	}
}
