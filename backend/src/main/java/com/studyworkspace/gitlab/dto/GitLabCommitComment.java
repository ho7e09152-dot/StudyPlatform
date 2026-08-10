package com.studyworkspace.gitlab.dto;

import com.fasterxml.jackson.annotation.JsonAlias;

public record GitLabCommitComment(
	String note,
	GitLabUser author,
	@JsonAlias("created_at") String createdAt,
	Integer line,
	String path,
	@JsonAlias("line_type") String lineType
) { }
