package com.studyworkspace.workspace.service;

import java.util.List;

import com.studyworkspace.common.exception.RepositoryProviderException;
import com.studyworkspace.gitlab.service.GitLabOAuthProjectService;
import com.studyworkspace.gitlab.service.GitLabRepositoryDataAdapter;
import com.studyworkspace.workspace.port.RepositoryDataPort;
import com.studyworkspace.workspace.domain.WorkspaceException;
import com.studyworkspace.workspace.domain.WorkspaceModels.WorkspaceState;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;

@Service
public class RepositoryInitializationService {
	private final RepositoryDataService repositories;

	@Autowired
	public RepositoryInitializationService(RepositoryDataService repositories) {
		this.repositories = repositories;
	}

	public RepositoryInitializationService(GitLabOAuthProjectService gitLab) {
		this(new RepositoryDataService(List.of(new GitLabRepositoryDataAdapter(gitLab))));
	}

	public void initialize(String accessToken, WorkspaceState workspace, String authorName) {
		if (!WorkspaceRepositoryLayout.MANAGED_BASE_PATH.equals(workspace.repositoryBasePath())) return;
		String content = configContent(workspace.id(), workspace.repositorySchemaVersion());
		RepositoryDataPort repository = repositories.require(workspace.repository());
		try {
			repository.createFile(
				accessToken, workspace.repository(), WorkspaceRepositoryLayout.CONFIG_PATH, workspace.defaultBranch(), content,
				"study: initialize workspace", authorName
			);
		} catch (RepositoryProviderException exception) {
			if (exception.upstreamStatus() != 400 && exception.upstreamStatus() != 409) throw exception;
			RepositoryDataPort.RepositoryFile existing = repository.getFile(
				accessToken, workspace.repository(), WorkspaceRepositoryLayout.CONFIG_PATH, workspace.defaultBranch()
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
