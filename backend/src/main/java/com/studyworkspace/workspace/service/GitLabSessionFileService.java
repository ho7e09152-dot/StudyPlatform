package com.studyworkspace.workspace.service;

import com.studyworkspace.common.exception.GitLabApiException;
import com.studyworkspace.gitlab.dto.GitLabFileContent;
import com.studyworkspace.gitlab.service.GitLabOAuthProjectService;
import com.studyworkspace.workspace.domain.WorkspaceException;
import com.studyworkspace.workspace.domain.WorkspaceModels.StudySession;
import com.studyworkspace.workspace.domain.WorkspaceModels.WorkspaceState;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class GitLabSessionFileService {

	private final GitLabOAuthProjectService gitLab;
	private final SessionYamlSerializer serializer;

	public GitLabSessionFileService(
		GitLabOAuthProjectService gitLab,
		SessionYamlSerializer serializer
	) {
		this.gitLab = gitLab;
		this.serializer = serializer;
	}

	public String write(
		String accessToken,
		WorkspaceState workspace,
		StudySession current,
		StudySession next
	) {
		String path = next.folder() + "/session.yml";
		String content = serializer.serialize(next);
		String commitMessage = commitMessage(current, next);
		if (current == null) {
			try {
				return commitId(gitLab.createRepositoryFile(
					accessToken,
					workspace.gitlabProjectId(),
					path,
					workspace.defaultBranch(),
					content,
					commitMessage
				));
			} catch (GitLabApiException exception) {
				if (exception.upstreamStatus() == 400 || exception.upstreamStatus() == 409) {
					throw new WorkspaceException(
						"SESSION_ALREADY_EXISTS",
						"GitLab 저장소에 같은 날짜의 session.yml이 이미 있거나 첫 커밋을 만들 수 없습니다.",
						409
					);
				}
				throw exception;
			}
		}

		GitLabFileContent remote = loadCurrent(accessToken, workspace, path);
		if (StringUtils.hasText(current.lastCommitId()) && !current.lastCommitId().equals(remote.lastCommitId())) {
			throw new WorkspaceException(
				"SESSION_REVISION_CONFLICT",
				"GitLab에서 일정 파일이 변경되었습니다. 최신 내용을 다시 동기화해 주세요.",
				409
			);
		}
		try {
			return commitId(gitLab.updateRepositoryFile(
				accessToken,
				workspace.gitlabProjectId(),
				path,
				workspace.defaultBranch(),
				content,
				commitMessage,
				remote.lastCommitId()
			));
		} catch (GitLabApiException exception) {
			if (exception.upstreamStatus() == 400 || exception.upstreamStatus() == 409) {
				throw new WorkspaceException(
					"SESSION_REVISION_CONFLICT",
					"GitLab 일정 파일이 다른 변경과 충돌했습니다. 최신 내용을 다시 확인해 주세요.",
					409
				);
			}
			throw exception;
		}
	}

	private GitLabFileContent loadCurrent(String accessToken, WorkspaceState workspace, String path) {
		try {
			return gitLab.getRepositoryFile(
				accessToken,
				workspace.gitlabProjectId(),
				path,
				workspace.defaultBranch()
			);
		} catch (GitLabApiException exception) {
			if (exception.upstreamStatus() == 404) {
				throw new WorkspaceException(
					"SESSION_FILE_MISSING",
					"GitLab에서 일정 파일을 찾지 못했습니다. 동기화 후 다시 시도해 주세요.",
					409
				);
			}
			throw exception;
		}
	}

	private static String commitMessage(StudySession current, StudySession next) {
		if (current == null) return "study: create session " + next.date();
		if ("cancelled".equals(next.status())) return "study: cancel session " + next.date();
		return "study: update session " + next.date() + " revision " + next.revision();
	}

	private static String commitId(GitLabFileContent file) {
		String commitId = StringUtils.hasText(file.lastCommitId()) ? file.lastCommitId() : file.commitId();
		if (!StringUtils.hasText(commitId)) {
			throw new GitLabApiException(
				"GITLAB_COMMIT_ID_MISSING",
				"GitLab 커밋은 성공했지만 commit SHA를 확인하지 못했습니다.",
				502
			);
		}
		return commitId;
	}
}
