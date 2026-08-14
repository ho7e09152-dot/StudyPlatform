package com.studyworkspace.workspace.controller;

import java.util.List;

import com.studyworkspace.auth.service.GitLabOAuthTokenProvider;
import com.studyworkspace.auth.security.StudyIngPrincipal;
import com.studyworkspace.github.service.GitHubUserTokenProvider;
import com.studyworkspace.provider.ProviderCapabilities;
import com.studyworkspace.workspace.domain.RepositoryProvider;
import com.studyworkspace.workspace.domain.WorkspaceException;
import com.studyworkspace.workspace.dto.RepositorySummary;
import com.studyworkspace.workspace.service.RepositoryDataService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import com.studyworkspace.workspace.dto.RepositoryImportAnalysis;
import com.studyworkspace.workspace.service.RepositoryImportAnalysisService;

@RestController
@RequestMapping("/api/v1/repositories")
public class RepositoryController {
	private final GitLabOAuthTokenProvider tokens;
	private final GitHubUserTokenProvider githubTokens;
	private final ProviderCapabilities capabilities;
	private final RepositoryDataService repositories;
	private final RepositoryImportAnalysisService analysis;

	public RepositoryController(GitLabOAuthTokenProvider tokens, GitHubUserTokenProvider githubTokens,
		ProviderCapabilities capabilities, RepositoryDataService repositories, RepositoryImportAnalysisService analysis) {
		this.tokens = tokens;
		this.githubTokens = githubTokens;
		this.capabilities = capabilities;
		this.repositories = repositories;
		this.analysis = analysis;
	}

	@GetMapping("/{provider}/{externalId}")
	public RepositorySummary get(
		@PathVariable RepositoryProvider provider,
		@PathVariable String externalId,
		@AuthenticationPrincipal StudyIngPrincipal principal,
		HttpServletRequest request
	) {
		return repositories.require(requireSupported(provider)).getRepository(accessToken(provider, principal, request), externalId);
	}

	@GetMapping("/{provider}/{externalId}/import-analysis")
	public RepositoryImportAnalysis analyze(
		@PathVariable RepositoryProvider provider,
		@PathVariable String externalId,
		@AuthenticationPrincipal StudyIngPrincipal principal,
		HttpServletRequest request
	) {
		return analysis.analyze(accessToken(requireSupported(provider), principal, request), provider, externalId);
	}

	private RepositoryProvider requireSupported(RepositoryProvider provider) {
		if (!capabilities.supportsRepositoryProvider(provider)) {
			throw new WorkspaceException("REPOSITORY_PROVIDER_UNAVAILABLE", "현재 선택한 저장소 Provider를 사용할 수 없습니다.", 503);
		}
		return provider;
	}

	private String accessToken(RepositoryProvider provider, StudyIngPrincipal principal, HttpServletRequest request) {
		return provider == RepositoryProvider.GITLAB
			? tokens.requireValidSession(request).accessToken()
			: githubTokens.requireValidCredential(requirePrincipal(principal).userId()).accessToken();
	}

	@GetMapping
	public List<RepositorySummary> list(
		@RequestParam(required = false) String search,
		@RequestParam(defaultValue = "GITLAB") RepositoryProvider provider,
		@RequestParam(defaultValue = "1") int page,
		@RequestParam(defaultValue = "50") int perPage,
		@AuthenticationPrincipal StudyIngPrincipal principal,
		HttpServletRequest request
	) {
		if (search != null && search.length() > 100) {
			throw new WorkspaceException("INVALID_REQUEST", "저장소 검색어는 100자 이하여야 합니다.", 400);
		}
		if (!capabilities.supportsRepositoryProvider(provider)) {
			throw new WorkspaceException("REPOSITORY_PROVIDER_UNAVAILABLE", "현재 선택한 저장소 Provider를 사용할 수 없습니다.", 503);
		}
		String accessToken = provider == RepositoryProvider.GITLAB
			? tokens.requireValidSession(request).accessToken()
			: githubTokens.requireValidCredential(requirePrincipal(principal).userId()).accessToken();
		return repositories.require(provider).listRepositories(
			accessToken, search, Math.max(1, page), Math.max(1, Math.min(perPage, 100))
		);
	}

	private static StudyIngPrincipal requirePrincipal(StudyIngPrincipal principal) {
		if (principal == null) throw new WorkspaceException("AUTH_REQUIRED", "Study-ing 로그인이 필요합니다.", 401);
		return principal;
	}
}
