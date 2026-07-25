package com.studyworkspace.gitlab.controller;

import com.studyworkspace.gitlab.dto.GitLabConnectionResponse;
import com.studyworkspace.gitlab.dto.GitLabFileContent;
import com.studyworkspace.gitlab.service.GitLabConnectionService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/gitlab")
public class GitLabConnectionController {

	private final GitLabConnectionService gitLabConnectionService;

	public GitLabConnectionController(GitLabConnectionService gitLabConnectionService) {
		this.gitLabConnectionService = gitLabConnectionService;
	}

	@GetMapping("/connection")
	public GitLabConnectionResponse connection() {
		return gitLabConnectionService.checkConnection();
	}

	@GetMapping("/repository/file")
	public GitLabFileContent repositoryFile(@RequestParam String path) {
		return gitLabConnectionService.getFile(path);
	}
}
