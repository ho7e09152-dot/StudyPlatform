package com.studyworkspace.workspace.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;

import com.studyworkspace.gitlab.dto.GitLabFileContent;
import com.studyworkspace.gitlab.dto.GitLabProject;
import com.studyworkspace.gitlab.dto.GitLabTreeItem;
import com.studyworkspace.gitlab.service.GitLabOAuthProjectService;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class RepositoryImportAnalysisServiceTests {
	@Test
	void classifiesLegacyRepositoryWithoutModifyingIt() {
		GitLabOAuthProjectService gitLab = mock(GitLabOAuthProjectService.class);
		when(gitLab.getProject("token", 12)).thenReturn(project());
		when(gitLab.getAllRepositoryTree("token", 12, "main")).thenReturn(List.of(
			new GitLabTreeItem("blob-1", "README.md", "blob", "README.md", "100644"),
			new GitLabTreeItem("blob-2", "Main.java", "blob", "src/Main.java", "100644")
		));

		var result = new RepositoryImportAnalysisService(gitLab, new SessionYamlParser()).analyze("token", 12);

		assertThat(result.classification()).isEqualTo("LEGACY");
		assertThat(result.repositoryBasePath()).isEqualTo(".study-workspace");
		assertThat(result.totalFiles()).isEqualTo(2);
		assertThat(result.ignoredFiles()).isEqualTo(2);
		assertThat(result.treeFingerprint()).hasSize(64);
	}

	@Test
	void recognizesExistingCompatibleRootFormat() {
		GitLabOAuthProjectService gitLab = mock(GitLabOAuthProjectService.class);
		when(gitLab.getProject("token", 12)).thenReturn(project());
		when(gitLab.getAllRepositoryTree("token", 12, "main")).thenReturn(List.of(
			new GitLabTreeItem("blob-1", "session.yml", "blob", "260809/session.yml", "100644")
		));
		String content = new SessionYamlSerializer(new ObjectMapper()).serialize(SessionYamlParserTests.validSession());
		when(gitLab.getRepositoryFile("token", 12, "260809/session.yml", "main"))
			.thenReturn(new GitLabFileContent("session.yml", "260809/session.yml", content.length(), content, "main", "blob-1", "sha", "sha"));

		var result = new RepositoryImportAnalysisService(gitLab, new SessionYamlParser()).analyze("token", 12);

		assertThat(result.classification()).isEqualTo("COMPATIBLE");
		assertThat(result.repositoryBasePath()).isEmpty();
		assertThat(result.compatibleSessions()).isEqualTo(1);
	}

	private static GitLabProject project() {
		return new GitLabProject(12, "Study", "team/study", "main", "https://gitlab.example/team/study", "private");
	}
}
