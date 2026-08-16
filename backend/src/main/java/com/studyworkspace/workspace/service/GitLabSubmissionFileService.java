package com.studyworkspace.workspace.service;

import java.util.List;

import com.studyworkspace.common.exception.RepositoryProviderException;
import com.studyworkspace.gitlab.service.GitLabOAuthProjectService;
import com.studyworkspace.gitlab.service.GitLabRepositoryDataAdapter;
import com.studyworkspace.gitlab.service.RepositoryPathPolicy;
import com.studyworkspace.workspace.domain.WorkspaceException;
import com.studyworkspace.workspace.domain.WorkspaceModels.MemberSubmissionFile;
import com.studyworkspace.workspace.domain.WorkspaceModels.SessionItem;
import com.studyworkspace.workspace.domain.WorkspaceModels.SubmissionEntry;
import com.studyworkspace.workspace.domain.WorkspaceModels.StudyMember;
import com.studyworkspace.workspace.domain.WorkspaceModels.StudySession;
import com.studyworkspace.workspace.domain.WorkspaceModels.WorkspaceState;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import com.studyworkspace.workspace.port.RepositoryDataPort;

@Service
public class GitLabSubmissionFileService {
	private final RepositoryDataService repositories;
	private final RepositoryPathPolicy pathPolicy;
	private final SubmissionMarkdownCodec codec;

	@Autowired
	public GitLabSubmissionFileService(
		RepositoryDataService repositories,
		RepositoryPathPolicy pathPolicy,
		SubmissionMarkdownCodec codec
	) {
		this.repositories = repositories;
		this.pathPolicy = pathPolicy;
		this.codec = codec;
	}

	public GitLabSubmissionFileService(GitLabOAuthProjectService gitLab, RepositoryPathPolicy pathPolicy,
		SubmissionMarkdownCodec codec) {
		this(new RepositoryDataService(List.of(new GitLabRepositoryDataAdapter(gitLab))), pathPolicy, codec);
	}

	public String write(
		String accessToken,
		WorkspaceState workspace,
		StudySession session,
		SessionItem item,
		StudyMember member,
		MemberSubmissionFile current,
		MemberSubmissionFile next,
		String commitMessage
	) {
		String path = submissionPath(workspace, session, member);
		String content = codec.encode(next, session);
		RepositoryDataPort repository = repositories.require(workspace.repository());
		if (current == null) {
			try {
				return commitId(repository.createFile(
					accessToken, workspace.repository(), path, workspace.defaultBranch(), content, commitMessage, member.displayName()
				));
			} catch (RepositoryProviderException exception) {
				if (exception.upstreamStatus() == 400 || exception.upstreamStatus() == 409) {
					throw conflict("저장소에 이미 제출 파일이 있습니다. 먼저 일정을 동기화해 주세요.");
				}
				throw exception;
			}
		}

		RepositoryDataPort.RepositoryFile remote = loadCurrent(repository, accessToken, workspace, path);
		if (!StringUtils.hasText(current.lastCommitId()) || !current.lastCommitId().equals(remote.version())) {
			throw conflict("저장소의 제출 파일이 변경되었습니다. 최신 내용을 동기화한 뒤 다시 시도해 주세요.");
		}
		try {
			return commitId(repository.updateFile(
				accessToken, workspace.repository(), path, workspace.defaultBranch(), content, commitMessage, remote.version(), member.displayName()
			));
		} catch (RepositoryProviderException exception) {
			if (exception.upstreamStatus() == 400 || exception.upstreamStatus() == 409) {
				throw conflict("제출 파일이 다른 변경과 충돌했습니다. 최신 내용을 동기화해 주세요.");
			}
			throw exception;
		}
	}

	/** Backward-compatible aggregate writer used by fixed V1/V2 layout tests. */
	public String write(String accessToken, WorkspaceState workspace, StudySession session, StudyMember member,
		MemberSubmissionFile current, MemberSubmissionFile next, String commitMessage) {
		SessionItem changed = session.items().stream().filter(item -> {
			SubmissionEntry before = entry(current, item.id());
			SubmissionEntry after = entry(next, item.id());
			return !java.util.Objects.equals(before, after);
		}).findFirst().orElse(session.items().getFirst());
		return write(accessToken, workspace, session, changed, member, current, next, commitMessage);
	}

	private static SubmissionEntry entry(MemberSubmissionFile file, String itemId) {
		return file == null ? null : file.submissions().stream()
			.filter(candidate -> candidate.itemId().equals(itemId)).findFirst().orElse(null);
	}

	private RepositoryDataPort.RepositoryFile loadCurrent(RepositoryDataPort repository, String accessToken, WorkspaceState workspace, String path) {
		try {
			return repository.getFile(accessToken, workspace.repository(), path, workspace.defaultBranch());
		} catch (RepositoryProviderException exception) {
			if (exception.upstreamStatus() == 404) {
				throw conflict("저장소에서 제출 파일을 찾지 못했습니다. 최신 내용을 동기화해 주세요.");
			}
			throw exception;
		}
	}

	private String submissionPath(WorkspaceState workspace, StudySession session, StudyMember member) {
		String fileName = member.fileName();
		if (!StringUtils.hasText(fileName) || !fileName.toLowerCase(java.util.Locale.ROOT).endsWith(".md")) {
			throw new WorkspaceException("INVALID_SUBMISSION_PATH", "멤버 제출 파일명이 올바르지 않습니다.", 400);
		}
		RepositoryStorageLayoutPolicy.validateSegment(fileName.substring(0, fileName.length() - 3), "학습 기록 이름");
		return pathPolicy.validate(WorkspaceRepositoryLayout.submissionPath(workspace, session, member));
	}

	private static String commitId(RepositoryDataPort.RepositoryFile file) {
		String value = StringUtils.hasText(file.version()) ? file.version() : file.commitId();
		if (!StringUtils.hasText(value)) {
			throw new WorkspaceException("REPOSITORY_COMMIT_ID_MISSING", "저장소 커밋 SHA를 확인하지 못했습니다.", 502);
		}
		return value;
	}

	private static WorkspaceException conflict(String message) {
		return new WorkspaceException("SUBMISSION_CONFLICT", message, 409);
	}
}
