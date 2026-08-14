package com.studyworkspace.workspace.service;

import java.util.List;

import com.studyworkspace.common.exception.RepositoryProviderException;
import com.studyworkspace.gitlab.service.GitLabOAuthProjectService;
import com.studyworkspace.gitlab.service.GitLabRepositoryDataAdapter;
import com.studyworkspace.workspace.port.RepositoryDataPort;
import com.studyworkspace.workspace.domain.WorkspaceException;
import com.studyworkspace.workspace.domain.WorkspaceModels.StudySession;
import com.studyworkspace.workspace.domain.WorkspaceModels.WorkspaceState;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;

@Service
public class GitLabSessionFileService {

	private final RepositoryDataService repositories;
	private final SessionYamlSerializer serializer;

	@Autowired
	public GitLabSessionFileService(
		RepositoryDataService repositories,
		SessionYamlSerializer serializer
	) {
		this.repositories = repositories;
		this.serializer = serializer;
	}

	public GitLabSessionFileService(GitLabOAuthProjectService gitLab, SessionYamlSerializer serializer) {
		this(new RepositoryDataService(List.of(new GitLabRepositoryDataAdapter(gitLab))), serializer);
	}

	public String write(
		String accessToken,
		WorkspaceState workspace,
		StudySession current,
		StudySession next
	) {
		String path = WorkspaceRepositoryLayout.sessionPath(workspace, next);
		String content = serializer.serialize(next);
		String commitMessage = commitMessage(current, next);
		RepositoryDataPort repository = repositories.require(workspace.repository());
		if (current == null) {
			try {
				return commitId(repository.createFile(
					accessToken,
					workspace.repository(),
					path,
					workspace.defaultBranch(),
					content,
					commitMessage,
					next.updatedBy()
				));
			} catch (RepositoryProviderException exception) {
				if (exception.upstreamStatus() == 400 || exception.upstreamStatus() == 409) {
					throw new WorkspaceException(
						"SESSION_ALREADY_EXISTS",
						"저장소에 같은 날짜의 session.yml이 이미 있거나 첫 커밋을 만들 수 없습니다.",
						409
					);
				}
				throw exception;
			}
		}

		RepositoryDataPort.RepositoryFile remote = loadCurrent(repository, accessToken, workspace, path);
		if (StringUtils.hasText(current.lastCommitId()) && !current.lastCommitId().equals(remote.version())) {
			throw new WorkspaceException(
				"SESSION_REVISION_CONFLICT",
				"저장소에서 일정 파일이 변경되었습니다. 최신 내용을 다시 동기화해 주세요.",
				409
			);
		}
		try {
			return commitId(repository.updateFile(
				accessToken,
				workspace.repository(),
				path,
				workspace.defaultBranch(),
				content,
				commitMessage,
				remote.version(),
				next.updatedBy()
			));
		} catch (RepositoryProviderException exception) {
			if (exception.upstreamStatus() == 400 || exception.upstreamStatus() == 409) {
				throw new WorkspaceException(
					"SESSION_REVISION_CONFLICT",
					"일정 파일이 다른 변경과 충돌했습니다. 최신 내용을 다시 확인해 주세요.",
					409
				);
			}
			throw exception;
		}
	}

	private RepositoryDataPort.RepositoryFile loadCurrent(RepositoryDataPort repository, String accessToken, WorkspaceState workspace, String path) {
		try {
			return repository.getFile(
				accessToken,
				workspace.repository(),
				path,
				workspace.defaultBranch()
			);
		} catch (RepositoryProviderException exception) {
			if (exception.upstreamStatus() == 404) {
				throw new WorkspaceException(
					"SESSION_FILE_MISSING",
					"저장소에서 일정 파일을 찾지 못했습니다. 동기화 후 다시 시도해 주세요.",
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

	private static String commitId(RepositoryDataPort.RepositoryFile file) {
		String commitId = StringUtils.hasText(file.version()) ? file.version() : file.commitId();
		if (!StringUtils.hasText(commitId)) {
			throw new WorkspaceException(
				"REPOSITORY_COMMIT_ID_MISSING",
				"저장소 커밋은 성공했지만 commit SHA를 확인하지 못했습니다.",
				502
			);
		}
		return commitId;
	}
}
