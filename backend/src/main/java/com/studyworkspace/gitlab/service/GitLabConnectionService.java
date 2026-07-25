package com.studyworkspace.gitlab.service;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import com.studyworkspace.common.exception.GitLabApiException;
import com.studyworkspace.gitlab.config.GitLabProperties;
import com.studyworkspace.gitlab.dto.GitLabConnectionResponse;
import com.studyworkspace.gitlab.dto.GitLabFileContent;
import com.studyworkspace.gitlab.dto.GitLabFileResponse;
import com.studyworkspace.gitlab.dto.GitLabProject;
import com.studyworkspace.gitlab.dto.GitLabUser;
import com.studyworkspace.gitlab.port.GitLabRepositoryPort;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class GitLabConnectionService {

	private static final long MAX_TEXT_FILE_SIZE = 1_000_000;

	private final GitLabRepositoryPort gitLabRepository;
	private final GitLabProperties properties;
	private final RepositoryPathPolicy repositoryPathPolicy;

	public GitLabConnectionService(
		GitLabRepositoryPort gitLabRepository,
		GitLabProperties properties,
		RepositoryPathPolicy repositoryPathPolicy
	) {
		this.gitLabRepository = gitLabRepository;
		this.properties = properties;
		this.repositoryPathPolicy = repositoryPathPolicy;
	}

	public GitLabConnectionResponse checkConnection() {
		if (!properties.isConfigured()) {
			return GitLabConnectionResponse.notConfigured();
		}

		GitLabUser user = gitLabRepository.getCurrentUser();
		GitLabProject project = gitLabRepository.getConfiguredProject();
		String ref = resolveRef(project);

		return GitLabConnectionResponse.connected(
			user,
			project,
			gitLabRepository.getRepositoryTree(ref)
		);
	}

	public GitLabFileContent getFile(String path) {
		String safePath = repositoryPathPolicy.validate(path);
		GitLabProject project = gitLabRepository.getConfiguredProject();
		GitLabFileResponse file = gitLabRepository.getRepositoryFile(safePath, resolveRef(project));

		if (file.size() > MAX_TEXT_FILE_SIZE) {
			throw new GitLabApiException(
				"GITLAB_FILE_TOO_LARGE",
				"미리보기는 1MB 이하의 텍스트 파일만 지원합니다.",
				413
			);
		}
		if (!"base64".equalsIgnoreCase(file.encoding())) {
			throw new GitLabApiException(
				"GITLAB_FILE_ENCODING_UNSUPPORTED",
				"지원하지 않는 GitLab 파일 인코딩입니다.",
				502
			);
		}

		try {
			String content = new String(
				Base64.getMimeDecoder().decode(file.content()),
				StandardCharsets.UTF_8
			);
			return new GitLabFileContent(
				file.fileName(),
				file.filePath(),
				file.size(),
				content,
				file.ref(),
				file.blobId(),
				file.commitId(),
				file.lastCommitId()
			);
		} catch (IllegalArgumentException exception) {
			throw new GitLabApiException(
				"GITLAB_FILE_DECODE_FAILED",
				"GitLab 파일 내용을 디코딩하지 못했습니다.",
				502
			);
		}
	}

	private String resolveRef(GitLabProject project) {
		if (StringUtils.hasText(properties.defaultRef())) {
			return properties.defaultRef();
		}
		if (StringUtils.hasText(project.defaultBranch())) {
			return project.defaultBranch();
		}
		return "HEAD";
	}
}
