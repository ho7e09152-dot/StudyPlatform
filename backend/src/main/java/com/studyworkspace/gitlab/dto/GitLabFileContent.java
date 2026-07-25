package com.studyworkspace.gitlab.dto;

public record GitLabFileContent(
	String fileName,
	String filePath,
	long size,
	String content,
	String ref,
	String blobId,
	String commitId,
	String lastCommitId
) {
}
