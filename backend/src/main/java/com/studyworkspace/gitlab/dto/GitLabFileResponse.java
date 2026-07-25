package com.studyworkspace.gitlab.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record GitLabFileResponse(
	@JsonProperty("file_name") String fileName,
	@JsonProperty("file_path") String filePath,
	long size,
	String encoding,
	String content,
	String ref,
	@JsonProperty("blob_id") String blobId,
	@JsonProperty("commit_id") String commitId,
	@JsonProperty("last_commit_id") String lastCommitId
) {
}
