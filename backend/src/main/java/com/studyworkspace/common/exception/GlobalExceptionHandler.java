package com.studyworkspace.common.exception;

import com.studyworkspace.common.api.ApiErrorResponse;
import com.studyworkspace.workspace.domain.WorkspaceException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
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
		return ResponseEntity.status(exception.upstreamStatus())
			.body(ApiErrorResponse.of(exception.code(), exception.getMessage()));
	}

	@ExceptionHandler(WorkspaceException.class)
	public ResponseEntity<ApiErrorResponse> handleWorkspace(WorkspaceException exception) {
		return ResponseEntity.status(exception.status())
			.body(ApiErrorResponse.of(exception.code(), exception.getMessage()));
	}

	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ResponseEntity<ApiErrorResponse> handleValidation(MethodArgumentNotValidException exception) {
		return ResponseEntity.badRequest()
			.body(ApiErrorResponse.of("INVALID_REQUEST", "요청값을 확인해 주세요."));
	}

	@ExceptionHandler({
		HttpMessageNotReadableException.class,
		MissingServletRequestParameterException.class,
		MethodArgumentTypeMismatchException.class
	})
	public ResponseEntity<ApiErrorResponse> handleMalformedRequest(Exception exception) {
		return ResponseEntity.badRequest()
			.body(ApiErrorResponse.of("INVALID_REQUEST", "요청 형식과 필수 값을 확인해 주세요."));
	}

	@ExceptionHandler(InvalidRepositoryPathException.class)
	public ResponseEntity<ApiErrorResponse> handleInvalidPath(InvalidRepositoryPathException exception) {
		return ResponseEntity.badRequest()
			.body(ApiErrorResponse.of("INVALID_REPOSITORY_PATH", exception.getMessage()));
	}
}
