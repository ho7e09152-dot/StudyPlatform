package com.studyworkspace.workspace.port;

import java.util.List;

import com.studyworkspace.workspace.domain.RepositoryProvider;
import com.studyworkspace.workspace.domain.WorkspaceModels.RepositoryIdentity;
import com.studyworkspace.workspace.dto.RepositorySummary;

/** Normalized repository operations consumed by Workspace application services. */
public interface RepositoryDataPort {
	RepositoryProvider provider();

	List<RepositorySummary> listRepositories(String accessToken, String search, int page, int perPage);
	RepositorySummary getRepository(String accessToken, String externalRepositoryId);
	List<TreeEntry> listTree(String accessToken, RepositoryIdentity repository);
	RepositoryFile getFile(String accessToken, RepositoryIdentity repository, String path, String ref);
	RepositoryFile createFile(String accessToken, RepositoryIdentity repository, String path, String branch,
		String content, String commitMessage, String authorName);
	RepositoryFile updateFile(String accessToken, RepositoryIdentity repository, String path, String branch,
		String content, String commitMessage, String expectedVersion, String authorName);
	String createCommit(String accessToken, RepositoryIdentity repository, String branch, String commitMessage,
		List<CommitAction> actions, String authorName);
	List<CommitComment> listCommitComments(String accessToken, RepositoryIdentity repository, String commitId);
	CommitComment createCommitComment(String accessToken, RepositoryIdentity repository, String commitId, String body);

	record TreeEntry(String id, String name, String type, String path, String mode) { }
	record RepositoryFile(String fileName, String filePath, long size, String content, String ref,
		String blobId, String commitId, String version) { }
	record CommitAction(String action, String sourcePath, String targetPath, String content, String expectedVersion) {
		public static CommitAction move(String source, String target) { return new CommitAction("MOVE", source, target, null, null); }
		public static CommitAction create(String path, String content) { return new CommitAction("CREATE", null, path, content, null); }
		public static CommitAction update(String path, String content, String version) { return new CommitAction("UPDATE", null, path, content, version); }
	}
	record CommitComment(String id, String body, String authorExternalId, String authorUsername,
		String authorName, String authorAvatarUrl, String createdAt) { }
}
