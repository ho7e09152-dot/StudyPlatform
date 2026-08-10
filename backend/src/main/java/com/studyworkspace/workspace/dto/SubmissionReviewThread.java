package com.studyworkspace.workspace.dto;

import java.util.List;

public record SubmissionReviewThread(
	String memberId,
	String memberName,
	String filePath,
	String commitId,
	List<ReviewComment> comments
) {
	public record ReviewComment(
		String id,
		String body,
		long authorGitLabUserId,
		String authorUsername,
		String authorName,
		String authorAvatarUrl,
		String createdAt
	) { }
}
