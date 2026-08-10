package com.studyworkspace.workspace.service;

import com.studyworkspace.common.exception.GitLabApiException;
import com.studyworkspace.gitlab.dto.GitLabFileContent;
import com.studyworkspace.gitlab.service.GitLabOAuthProjectService;
import com.studyworkspace.workspace.domain.WorkspaceException;
import com.studyworkspace.workspace.domain.WorkspaceModels.WorkspaceState;
import org.springframework.stereotype.Service;

@Service
public class RepositoryInitializationService {
	private final GitLabOAuthProjectService gitLab;

	public RepositoryInitializationService(GitLabOAuthProjectService gitLab) {
		this.gitLab = gitLab;
	}

	public void initialize(String accessToken, WorkspaceState workspace, String authorName) {
		if (!WorkspaceRepositoryLayout.MANAGED_BASE_PATH.equals(workspace.repositoryBasePath())) return;
		String content = configContent(workspace.id(), workspace.repositorySchemaVersion());
		try {
			gitLab.createRepositoryFile(
				accessToken, workspace.gitlabProjectId(), WorkspaceRepositoryLayout.CONFIG_PATH, workspace.defaultBranch(), content,
				"study: initialize workspace", authorName
			);
		} catch (GitLabApiException exception) {
			if (exception.upstreamStatus() != 400 && exception.upstreamStatus() != 409) throw exception;
			GitLabFileContent existing = gitLab.getRepositoryFile(
				accessToken, workspace.gitlabProjectId(), WorkspaceRepositoryLayout.CONFIG_PATH, workspace.defaultBranch()
			);
			if (!existing.content().equals(content)) {
				throw new WorkspaceException("REPOSITORY_PATH_CONFLICT", "서비스 전용 설정 파일이 다른 용도로 사용되고 있습니다.", 409);
			}
		}
	}

	public static String configContent(String workspaceId, Integer repositorySchemaVersion) {
		return "version: 1\nrepositorySchemaVersion: "
			+ WorkspaceRepositoryLayout.schemaVersion(repositorySchemaVersion)
			+ "\nworkspaceId: \"" + workspaceId + "\"\n";
	}
}
