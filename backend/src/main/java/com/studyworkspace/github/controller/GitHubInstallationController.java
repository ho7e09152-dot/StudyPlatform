package com.studyworkspace.github.controller;

import com.studyworkspace.auth.security.StudyIngPrincipal;
import com.studyworkspace.github.config.GitHubAppProperties;
import com.studyworkspace.github.service.GitHubRepositoryService;
import com.studyworkspace.github.service.GitHubUserTokenProvider;
import com.studyworkspace.provider.ProviderCapabilities;
import com.studyworkspace.workspace.domain.RepositoryProvider;
import com.studyworkspace.workspace.domain.WorkspaceException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** GitHub App installation entry and verified Setup URL callback. */
@RestController
@RequestMapping("/api/v1/github/installations")
public class GitHubInstallationController {
	private final String frontendUrl;
	private final GitHubAppProperties properties;
	private final ProviderCapabilities capabilities;
	private final GitHubUserTokenProvider tokens;
	private final GitHubRepositoryService github;

	public GitHubInstallationController(
		@Value("${app.frontend-url:http://localhost:3000}") String frontendUrl,
		GitHubAppProperties properties,
		ProviderCapabilities capabilities,
		GitHubUserTokenProvider tokens,
		GitHubRepositoryService github
	) {
		this.frontendUrl = frontendUrl.replaceAll("/+$", "");
		this.properties = properties;
		this.capabilities = capabilities;
		this.tokens = tokens;
		this.github = github;
	}

	@GetMapping("/new")
	public ResponseEntity<Void> install(@AuthenticationPrincipal StudyIngPrincipal principal) {
		requireReady(principal);
		return redirect("https://github.com/apps/" + properties.slug() + "/installations/new");
	}

	@GetMapping("/setup")
	public ResponseEntity<Void> setup(
		@RequestParam(name = "installation_id") long installationId,
		@AuthenticationPrincipal StudyIngPrincipal principal
	) {
		requireReady(principal);
		String token = tokens.requireValidCredential(principal.userId()).accessToken();
		// Never trust installation_id from the query string. GitHub must confirm it belongs to this user token.
		github.requireInstallation(token, installationId);
		return redirect(frontendUrl + "/workspaces/new?provider=GITHUB&installation=verified");
	}

	private void requireReady(StudyIngPrincipal principal) {
		if (principal == null) throw new WorkspaceException("AUTH_REQUIRED", "Study-ing 로그인이 필요합니다.", 401);
		if (!capabilities.supportsRepositoryProvider(RepositoryProvider.GITHUB)) {
			throw new WorkspaceException("GITHUB_REPOSITORY_NOT_AVAILABLE", "GitHub 저장소 연결이 아직 준비되지 않았습니다.", 503);
		}
	}

	private static ResponseEntity<Void> redirect(String location) {
		return ResponseEntity.status(HttpStatus.FOUND).header(HttpHeaders.LOCATION, location).build();
	}
}
