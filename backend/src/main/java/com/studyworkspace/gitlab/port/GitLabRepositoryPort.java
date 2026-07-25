package com.studyworkspace.gitlab.port;

import java.util.List;

import com.studyworkspace.gitlab.dto.GitLabBranch;
import com.studyworkspace.gitlab.dto.GitLabCommitResponse;
import com.studyworkspace.gitlab.dto.GitLabFileResponse;
import com.studyworkspace.gitlab.dto.GitLabProject;
import com.studyworkspace.gitlab.dto.GitLabTreeItem;
import com.studyworkspace.gitlab.dto.GitLabUser;

public interface GitLabRepositoryPort {

	GitLabUser getCurrentUser();

	GitLabProject getConfiguredProject();

	List<GitLabTreeItem> getRepositoryTree(String ref);

	GitLabFileResponse getRepositoryFile(String path, String ref);

	GitLabBranch createBranch(String branch, String ref);

	void deleteBranch(String branch);

	GitLabCommitResponse createRepositoryFile(
		String path,
		String branch,
		String content,
		String commitMessage
	);

	GitLabCommitResponse updateRepositoryFile(
		String path,
		String branch,
		String content,
		String commitMessage,
		String lastCommitId
	);

	void deleteRepositoryFile(
		String path,
		String branch,
		String commitMessage,
		String lastCommitId
	);
}
