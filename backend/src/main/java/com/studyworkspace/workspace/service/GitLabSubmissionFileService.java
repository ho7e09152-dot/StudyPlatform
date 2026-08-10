package com.studyworkspace.workspace.service;

import com.studyworkspace.common.exception.GitLabApiException;
import com.studyworkspace.gitlab.dto.GitLabFileContent;
import com.studyworkspace.gitlab.service.GitLabOAuthProjectService;
import com.studyworkspace.gitlab.service.RepositoryPathPolicy;
import com.studyworkspace.workspace.domain.WorkspaceException;
import com.studyworkspace.workspace.domain.WorkspaceModels.MemberSubmissionFile;
import com.studyworkspace.workspace.domain.WorkspaceModels.StudyMember;
import com.studyworkspace.workspace.domain.WorkspaceModels.StudySession;
import com.studyworkspace.workspace.domain.WorkspaceModels.WorkspaceState;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class GitLabSubmissionFileService {
	private final GitLabOAuthProjectService gitLab;
	private final RepositoryPathPolicy pathPolicy;
	private final SubmissionMarkdownCodec codec;

	public GitLabSubmissionFileService(
		GitLabOAuthProjectService gitLab,
		RepositoryPathPolicy pathPolicy,
		SubmissionMarkdownCodec codec
	) {
		this.gitLab = gitLab;
		this.pathPolicy = pathPolicy;
		this.codec = codec;
	}

	public String write(
		String accessToken,
		WorkspaceState workspace,
		StudySession session,
		StudyMember member,
		MemberSubmissionFile current,
		MemberSubmissionFile next,
		String commitMessage
	) {
		String path = submissionPath(workspace, session, member);
		String content = codec.encode(next, session);
		if (current == null) {
			try {
				return commitId(gitLab.createRepositoryFile(
					accessToken, workspace.gitlabProjectId(), path, workspace.defaultBranch(), content, commitMessage, member.displayName()
				));
			} catch (GitLabApiException exception) {
				if (exception.upstreamStatus() == 400 || exception.upstreamStatus() == 409) {
					throw conflict("GitLab에 이미 제출 파일이 있습니다. 먼저 일정을 동기화해 주세요.");
				}
				throw exception;
			}
		}

		GitLabFileContent remote = loadCurrent(accessToken, workspace, path);
		if (!StringUtils.hasText(current.lastCommitId()) || !current.lastCommitId().equals(remote.lastCommitId())) {
			throw conflict("GitLab 제출 파일이 변경되었습니다. 최신 내용을 동기화한 뒤 다시 시도해 주세요.");
		}
		try {
			return commitId(gitLab.updateRepositoryFile(
				accessToken, workspace.gitlabProjectId(), path, workspace.defaultBranch(), content, commitMessage, remote.lastCommitId(), member.displayName()
			));
		} catch (GitLabApiException exception) {
			if (exception.upstreamStatus() == 400 || exception.upstreamStatus() == 409) {
				throw conflict("GitLab 제출 파일이 다른 변경과 충돌했습니다. 최신 내용을 동기화해 주세요.");
			}
			throw exception;
		}
	}

	private GitLabFileContent loadCurrent(String accessToken, WorkspaceState workspace, String path) {
		try {
			return gitLab.getRepositoryFile(accessToken, workspace.gitlabProjectId(), path, workspace.defaultBranch());
		} catch (GitLabApiException exception) {
			if (exception.upstreamStatus() == 404) {
				throw conflict("GitLab에서 제출 파일을 찾지 못했습니다. 최신 내용을 동기화해 주세요.");
			}
			throw exception;
		}
	}

	private String submissionPath(WorkspaceState workspace, StudySession session, StudyMember member) {
		String fileName = member.fileName();
		if (!StringUtils.hasText(fileName) || !fileName.matches("[\\p{L}\\p{N}._-]+\\.md") || fileName.contains("..")) {
			throw new WorkspaceException("INVALID_SUBMISSION_PATH", "멤버 제출 파일명이 올바르지 않습니다.", 400);
		}
		return pathPolicy.validate(WorkspaceRepositoryLayout.submissionPath(workspace, session, fileName));
	}

	private static String commitId(GitLabFileContent file) {
		String value = StringUtils.hasText(file.lastCommitId()) ? file.lastCommitId() : file.commitId();
		if (!StringUtils.hasText(value)) {
			throw new GitLabApiException("GITLAB_COMMIT_ID_MISSING", "GitLab 커밋 SHA를 확인하지 못했습니다.", 502);
		}
		return value;
	}

	private static WorkspaceException conflict(String message) {
		return new WorkspaceException("SUBMISSION_CONFLICT", message, 409);
	}
}
