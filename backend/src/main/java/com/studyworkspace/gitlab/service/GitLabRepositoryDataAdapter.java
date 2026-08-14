package com.studyworkspace.gitlab.service;

import java.util.List;
import java.util.Objects;

import com.studyworkspace.gitlab.dto.GitLabCommitAction;
import com.studyworkspace.gitlab.dto.GitLabCommitComment;
import com.studyworkspace.workspace.domain.RepositoryProvider;
import com.studyworkspace.workspace.domain.WorkspaceModels.RepositoryIdentity;
import com.studyworkspace.workspace.dto.RepositorySummary;
import com.studyworkspace.workspace.port.RepositoryDataPort;
import org.springframework.stereotype.Component;

@Component
public class GitLabRepositoryDataAdapter implements RepositoryDataPort {
	private final GitLabOAuthProjectService gitLab;

	public GitLabRepositoryDataAdapter(GitLabOAuthProjectService gitLab) { this.gitLab = gitLab; }

	@Override public RepositoryProvider provider() { return RepositoryProvider.GITLAB; }

	@Override
	public List<RepositorySummary> listRepositories(String token, String search, int page, int perPage) {
		return gitLab.listProjects(token, search, page, perPage).stream().map(RepositorySummary::fromGitLab).toList();
	}

	@Override
	public RepositorySummary getRepository(String token, String externalId) {
		return RepositorySummary.fromGitLab(gitLab.getProject(token, parseId(externalId)));
	}

	@Override
	public List<TreeEntry> listTree(String token, RepositoryIdentity repository) {
		return gitLab.getAllRepositoryTree(token, parseId(repository.externalRepositoryId()), repository.defaultBranch()).stream()
			.map(item -> new TreeEntry(item.id(), item.name(), item.type(), item.path(), item.mode())).toList();
	}

	@Override
	public RepositoryFile getFile(String token, RepositoryIdentity repository, String path, String ref) {
		var file = gitLab.getRepositoryFile(token, parseId(repository.externalRepositoryId()), path, ref);
		return new RepositoryFile(file.fileName(), file.filePath(), file.size(), file.content(), file.ref(),
			file.blobId(), file.commitId(), file.lastCommitId());
	}

	@Override
	public RepositoryFile createFile(String token, RepositoryIdentity repository, String path, String branch,
		String content, String commitMessage, String authorName) {
		var file = gitLab.createRepositoryFile(token, parseId(repository.externalRepositoryId()), path, branch,
			content, commitMessage, authorName);
		return new RepositoryFile(file.fileName(), file.filePath(), file.size(), file.content(), file.ref(),
			file.blobId(), file.commitId(), file.lastCommitId());
	}

	@Override
	public RepositoryFile updateFile(String token, RepositoryIdentity repository, String path, String branch,
		String content, String commitMessage, String expectedVersion, String authorName) {
		var file = gitLab.updateRepositoryFile(token, parseId(repository.externalRepositoryId()), path, branch,
			content, commitMessage, expectedVersion, authorName);
		return new RepositoryFile(file.fileName(), file.filePath(), file.size(), file.content(), file.ref(),
			file.blobId(), file.commitId(), file.lastCommitId());
	}

	@Override
	public String createCommit(String token, RepositoryIdentity repository, String branch, String message,
		List<CommitAction> actions, String authorName) {
		var mapped = actions.stream().map(action -> switch (action.action()) {
			case "MOVE" -> GitLabCommitAction.move(action.sourcePath(), action.targetPath());
			case "CREATE" -> GitLabCommitAction.create(action.targetPath(), action.content());
			case "UPDATE" -> GitLabCommitAction.update(action.targetPath(), action.content(), action.expectedVersion());
			default -> throw new IllegalArgumentException("Unsupported repository action: " + action.action());
		}).toList();
		return gitLab.createCommit(token, parseId(repository.externalRepositoryId()), branch, message, mapped, authorName).id();
	}

	@Override
	public List<CommitComment> listCommitComments(String token, RepositoryIdentity repository, String commitId) {
		return gitLab.getCommitComments(token, parseId(repository.externalRepositoryId()), commitId).stream()
			.map(GitLabRepositoryDataAdapter::comment).toList();
	}

	@Override
	public CommitComment createCommitComment(String token, RepositoryIdentity repository, String commitId, String body) {
		GitLabCommitComment created = gitLab.createCommitComment(token, parseId(repository.externalRepositoryId()), commitId, body);
		return created == null ? new CommitComment("created", body, "0", "unknown", "알 수 없는 사용자", null, "") : comment(created);
	}

	private static CommitComment comment(GitLabCommitComment comment) {
		var author = comment.author();
		String body = Objects.toString(comment.note(), "");
		String createdAt = Objects.toString(comment.createdAt(), "");
		String externalId = author == null ? "0" : Long.toString(author.id());
		return new CommitComment(
			externalId + "-" + Integer.toUnsignedString(Objects.hash(createdAt, body), 36), body, externalId,
			author == null ? "unknown" : author.username(), author == null ? "알 수 없는 사용자" : author.name(),
			author == null ? null : author.avatarUrl(), createdAt
		);
	}

	private static long parseId(String value) {
		try { return Long.parseLong(value); }
		catch (NumberFormatException exception) { throw new IllegalArgumentException("Invalid GitLab repository id", exception); }
	}
}
