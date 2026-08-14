package com.studyworkspace.workspace.service;

import java.util.List;
import java.util.Objects;

import com.studyworkspace.gitlab.service.GitLabOAuthProjectService;
import com.studyworkspace.gitlab.service.GitLabRepositoryDataAdapter;
import com.studyworkspace.workspace.port.RepositoryDataPort;
import com.studyworkspace.workspace.domain.WorkspaceException;
import com.studyworkspace.workspace.domain.WorkspaceModels.MemberSubmissionFile;
import com.studyworkspace.workspace.domain.WorkspaceModels.StudyMember;
import com.studyworkspace.workspace.domain.WorkspaceModels.StudySession;
import com.studyworkspace.workspace.domain.WorkspaceModels.WorkspaceState;
import com.studyworkspace.workspace.dto.SubmissionReviewThread;
import com.studyworkspace.workspace.dto.SubmissionReviewThread.ReviewComment;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;

@Service
public class SubmissionReviewService {
	private static final int MAX_REVIEW_LENGTH = 4_000;

	private final RepositoryDataService repositories;

	@Autowired
	public SubmissionReviewService(RepositoryDataService repositories) {
		this.repositories = repositories;
	}

	public SubmissionReviewService(GitLabOAuthProjectService gitLab) {
		this(new RepositoryDataService(List.of(new GitLabRepositoryDataAdapter(gitLab))));
	}

	public SubmissionReviewThread list(
		String accessToken,
		WorkspaceState workspace,
		String date,
		String memberId
	) {
		ReviewTarget target = requireTarget(workspace, date, memberId);
		List<ReviewComment> comments = repositories.require(workspace.repository()).listCommitComments(
			accessToken, workspace.repository(), target.submission().lastCommitId()
		).stream().map(SubmissionReviewService::toReviewComment).toList();
		return thread(target, comments);
	}

	public SubmissionReviewThread add(
		String accessToken,
		WorkspaceState workspace,
		String date,
		String memberId,
		String body
	) {
		ReviewTarget target = requireTarget(workspace, date, memberId);
		String normalized = body == null ? "" : body.strip();
		if (!StringUtils.hasText(normalized)) {
			throw new WorkspaceException("REVIEW_BODY_REQUIRED", "리뷰 댓글 내용을 입력해 주세요.", 400);
		}
		if (normalized.length() > MAX_REVIEW_LENGTH) {
			throw new WorkspaceException("REVIEW_BODY_TOO_LONG", "리뷰 댓글은 4,000자 이하로 입력해 주세요.", 400);
		}
		repositories.require(workspace.repository()).createCommitComment(
			accessToken, workspace.repository(), target.submission().lastCommitId(), normalized
		);
		return list(accessToken, workspace, date, memberId);
	}

	private static ReviewTarget requireTarget(WorkspaceState workspace, String date, String memberId) {
		StudySession session = workspace.sessions().get(date);
		if (session == null) {
			throw new WorkspaceException("SESSION_NOT_FOUND", "해당 날짜의 일정을 찾을 수 없습니다.", 404);
		}
		StudyMember member = workspace.members().stream()
			.filter(candidate -> candidate.id().equals(memberId))
			.findFirst()
			.orElseThrow(() -> new WorkspaceException("MEMBER_NOT_FOUND", "Workspace 멤버를 찾을 수 없습니다.", 404));
		MemberSubmissionFile submission = workspace.submissions().get(session.folder() + "/" + member.id());
		if (submission == null || !StringUtils.hasText(submission.lastCommitId())) {
			throw new WorkspaceException("SUBMISSION_NOT_FOUND", "리뷰할 제출 커밋이 없습니다.", 404);
		}
		return new ReviewTarget(
			session,
			member,
			submission,
			WorkspaceRepositoryLayout.submissionPath(workspace, session, member.fileName())
		);
	}

	private static SubmissionReviewThread thread(ReviewTarget target, List<ReviewComment> comments) {
		return new SubmissionReviewThread(
			target.member().id(),
			target.member().displayName(),
			target.filePath(),
			target.submission().lastCommitId(),
			List.copyOf(comments)
		);
	}

	private static ReviewComment toReviewComment(RepositoryDataPort.CommitComment comment) {
		String body = Objects.toString(comment.body(), "");
		String createdAt = Objects.toString(comment.createdAt(), "");
		long authorId;
		try { authorId = Long.parseLong(comment.authorExternalId()); }
		catch (NumberFormatException exception) { authorId = 0; }
		return new ReviewComment(
			comment.id(), body, authorId, comment.authorUsername(), comment.authorName(), comment.authorAvatarUrl(), createdAt
		);
	}

	private record ReviewTarget(
		StudySession session,
		StudyMember member,
		MemberSubmissionFile submission,
		String filePath
	) { }
}
