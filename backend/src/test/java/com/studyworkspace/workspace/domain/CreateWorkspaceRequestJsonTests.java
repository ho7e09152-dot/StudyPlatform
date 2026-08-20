package com.studyworkspace.workspace.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyworkspace.workspace.domain.WorkspaceModels.CreateWorkspaceRequest;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class CreateWorkspaceRequestJsonTests {

	private final ObjectMapper objectMapper = new ObjectMapper();

	@Test
	void acceptsProviderNeutralGitHubRequestWithoutLegacyGitLabProjectId() {
		CreateWorkspaceRequest request = objectMapper.readValue("""
			{
			  "name": "empty-repository",
			  "provider": "GITHUB",
			  "externalRepositoryId": "12345",
			  "gitlabProjectPath": "study-team/empty-repository",
			  "defaultBranch": "main",
			  "timezone": "Asia/Seoul",
			  "repositoryBasePath": "study",
			  "repositorySchemaVersion": 3,
			  "importMode": "EMPTY",
			  "expectedTreeFingerprint": "empty-tree",
			  "storageLayout": {
			    "folderBlocks": ["MONTH", "DAY"],
			    "fileNameBlocks": ["NAME"],
			    "yearFormat": "YYYY",
			    "monthFormat": "YYYY-MM",
			    "dateFormat": "YYMMDD",
			    "dayFormat": "DD",
			    "extension": "md"
			  }
			}
			""", CreateWorkspaceRequest.class);

		assertThat(request.provider()).isEqualTo("GITHUB");
		assertThat(request.externalRepositoryId()).isEqualTo("12345");
		assertThat(request.gitlabProjectId()).isNull();
	}
}
