package com.studyworkspace.gitlab.port;

import java.util.List;

import com.studyworkspace.gitlab.dto.GitLabFileResponse;
import com.studyworkspace.gitlab.dto.GitLabProject;
import com.studyworkspace.gitlab.dto.GitLabTreeItem;
import com.studyworkspace.gitlab.dto.GitLabUser;

public interface GitLabRepositoryPort {

	GitLabUser getCurrentUser();

	GitLabProject getConfiguredProject();

	List<GitLabTreeItem> getRepositoryTree(String ref);

	GitLabFileResponse getRepositoryFile(String path, String ref);
}
