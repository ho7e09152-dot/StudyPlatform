package com.studyworkspace.common.exception;

import com.studyworkspace.common.api.ApiErrorResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

	@ExceptionHandler(GitLabConfigurationException.class)
	public ResponseEntity<ApiErrorResponse> handleConfiguration(GitLabConfigurationException exception) {
		return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
			.body(ApiErrorResponse.of("GITLAB_NOT_CONFIGURED", exception.getMessage()));
	}

	@ExceptionHandler(GitLabApiException.class)
	public ResponseEntity<ApiErrorResponse> handleGitLab(GitLabApiException exception) {
		return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
			.body(ApiErrorResponse.of(exception.code(), exception.getMessage()));
	}

	@ExceptionHandler(InvalidRepositoryPathException.class)
	public ResponseEntity<ApiErrorResponse> handleInvalidPath(InvalidRepositoryPathException exception) {
		return ResponseEntity.badRequest()
			.body(ApiErrorResponse.of("INVALID_REPOSITORY_PATH", exception.getMessage()));
	}
}
