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
		assertThat(result.repositoryBasePath()).isEqualTo("study");
		assertThat(result.repositorySchemaVersion()).isEqualTo(2);
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
		assertThat(result.repositorySchemaVersion()).isEqualTo(1);
		assertThat(result.compatibleSessions()).isEqualTo(1);
	}

	@Test
	void recognizesExistingManagedV2Format() {
		GitLabOAuthProjectService gitLab = mock(GitLabOAuthProjectService.class);
		when(gitLab.getProject("token", 12)).thenReturn(project());
		String sessionPath = ".study-workspace/sessions/2026/2026-08-09/session.yml";
		when(gitLab.getAllRepositoryTree("token", 12, "main")).thenReturn(List.of(
			new GitLabTreeItem("config", "config.yml", "blob", ".study-workspace/config.yml", "100644"),
			new GitLabTreeItem("session", "session.yml", "blob", sessionPath, "100644"),
			new GitLabTreeItem("submission", "김서연.md", "blob", ".study-workspace/sessions/2026/2026-08-09/submissions/김서연.md", "100644")
		));
		when(gitLab.getRepositoryFile("token", 12, ".study-workspace/config.yml", "main"))
			.thenReturn(new GitLabFileContent("config.yml", ".study-workspace/config.yml", 40, "version: 1\nrepositorySchemaVersion: 2\n", "main", "config", "sha", "sha"));
		String content = new SessionYamlSerializer(new ObjectMapper()).serialize(SessionYamlParserTests.validSession());
		when(gitLab.getRepositoryFile("token", 12, sessionPath, "main"))
			.thenReturn(new GitLabFileContent("session.yml", sessionPath, content.length(), content, "main", "session", "sha", "sha"));

		var result = new RepositoryImportAnalysisService(gitLab, new SessionYamlParser()).analyze("token", 12);

		assertThat(result.classification()).isEqualTo("COMPATIBLE");
		assertThat(result.repositoryBasePath()).isEqualTo(".study-workspace");
		assertThat(result.repositorySchemaVersion()).isEqualTo(2);
		assertThat(result.compatibleSessions()).isEqualTo(1);
		assertThat(result.compatibleSubmissions()).isEqualTo(1);
	}

	@Test
	void detectsARepeatedExistingMarkdownLayoutWithoutMovingFiles() {
		GitLabOAuthProjectService gitLab = mock(GitLabOAuthProjectService.class);
		when(gitLab.getProject("token", 12)).thenReturn(project());
		when(gitLab.getAllRepositoryTree("token", 12, "main")).thenReturn(List.of(
			new GitLabTreeItem("one", "김서연.md", "blob", "study/260810/김서연.md", "100644"),
			new GitLabTreeItem("two", "김서연.md", "blob", "study/260811/김서연.md", "100644"),
			new GitLabTreeItem("readme", "README.md", "blob", "README.md", "100644")
		));

		var result = new RepositoryImportAnalysisService(gitLab, new SessionYamlParser()).analyze("token", 12);

		assertThat(result.classification()).isEqualTo("DETECTED");
		assertThat(result.repositoryBasePath()).isEqualTo("study");
		assertThat(result.detectedLayout().folderBlocks()).containsExactly("DATE");
		assertThat(result.detectedLayout().fileNameBlocks()).containsExactly("NAME");
		assertThat(result.detectedRecords()).isEqualTo(2);
		assertThat(result.layoutConfidence()).isEqualTo(1.0);
	}

	@Test
	void isolatesAnUnsafeCustomSubmissionPathInsteadOfFailingTheWholeAnalysis() {
		GitLabOAuthProjectService gitLab = mock(GitLabOAuthProjectService.class);
		when(gitLab.getProject("token", 12)).thenReturn(project());
		String sessionPath = "study/2026/08/09/session.yml";
		String unsafeSubmissionPath = "study/2026/08/09/김\u202E서연.md";
		when(gitLab.getAllRepositoryTree("token", 12, "main")).thenReturn(List.of(
			new GitLabTreeItem("config", "config.yml", "blob", "study/.study-workspace/config.yml", "100644"),
			new GitLabTreeItem("session", "session.yml", "blob", sessionPath, "100644"),
			new GitLabTreeItem("unsafe", "김\u202E서연.md", "blob", unsafeSubmissionPath, "100644")
		));
		String config = """
			version: 1
			repositorySchemaVersion: 3
			workspaceId: "workspace-1"
			repositoryBasePath: "study"
			storageFolderBlocks: "YEAR,MONTH,DAY"
			storageFileNameBlocks: "NAME"
			storageYearFormat: "YYYY"
			storageMonthFormat: "MM"
			storageDateFormat: "YYMMDD"
			storageDayFormat: "DD"
			storageExtension: "md"
			""";
		when(gitLab.getRepositoryFile("token", 12, "study/.study-workspace/config.yml", "main"))
			.thenReturn(new GitLabFileContent("config.yml", "study/.study-workspace/config.yml", config.length(), config, "main", "config", "sha", "sha"));
		String session = new SessionYamlSerializer(new ObjectMapper()).serialize(SessionYamlParserTests.validSession());
		when(gitLab.getRepositoryFile("token", 12, sessionPath, "main"))
			.thenReturn(new GitLabFileContent("session.yml", sessionPath, session.length(), session, "main", "session", "sha", "sha"));

		var result = new RepositoryImportAnalysisService(gitLab, new SessionYamlParser()).analyze("token", 12);

		assertThat(result.classification()).isEqualTo("PARTIALLY_COMPATIBLE");
		assertThat(result.compatibleSessions()).isEqualTo(1);
		assertThat(result.compatibleSubmissions()).isZero();
		assertThat(result.issues()).anySatisfy(issue -> {
			assertThat(issue.path()).isEqualTo(unsafeSubmissionPath);
			assertThat(issue.code()).isEqualTo("INVALID_SUBMISSION_FILE");
		});
	}

	private static GitLabProject project() {
		return new GitLabProject(12, "Study", "team/study", "main", "https://gitlab.example/team/study", "private");
	}
}
