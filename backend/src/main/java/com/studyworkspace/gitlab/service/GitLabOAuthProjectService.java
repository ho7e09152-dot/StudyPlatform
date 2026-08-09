package com.studyworkspace.gitlab.service;

import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.ArrayList;
import java.util.List;

import com.studyworkspace.common.exception.GitLabApiException;
import com.studyworkspace.gitlab.config.GitLabProperties;
import com.studyworkspace.gitlab.dto.GitLabProject;
import com.studyworkspace.gitlab.dto.GitLabTreeItem;
import com.studyworkspace.gitlab.dto.GitLabFileResponse;
import com.studyworkspace.gitlab.dto.GitLabFileContent;
import com.studyworkspace.gitlab.dto.GitLabCommitResponse;
import com.studyworkspace.gitlab.dto.GitLabCreateFileRequest;
import com.studyworkspace.gitlab.dto.GitLabUpdateFileRequest;
import com.studyworkspace.gitlab.dto.GitLabProjectMember;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.client.reactive.JdkClientHttpConnector;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import reactor.core.publisher.Mono;

@Service
public class GitLabOAuthProjectService {
	private static final Logger log = LoggerFactory.getLogger(GitLabOAuthProjectService.class);
	private static final long MAX_TEXT_FILE_SIZE = 1_000_000;

	private final WebClient webClient;
	private final GitLabProperties properties;

	public GitLabOAuthProjectService(WebClient.Builder webClientBuilder, GitLabProperties properties) {
		HttpClient httpClient = HttpClient.newBuilder()
			.connectTimeout(properties.requestTimeout())
			.followRedirects(HttpClient.Redirect.NEVER)
			.build();
		this.webClient = webClientBuilder
			.clientConnector(new JdkClientHttpConnector(httpClient))
			.baseUrl(properties.apiBaseUrl())
			.build();
		this.properties = properties;
	}

	public List<GitLabProject> listProjects(String accessToken, String search, int page, int perPage) {
		return execute(webClient.get()
			.uri(builder -> {
				builder.path("/projects")
					.queryParam("membership", true)
					.queryParam("order_by", "last_activity_at")
					.queryParam("sort", "desc")
					.queryParam("page", page)
					.queryParam("per_page", perPage);
				if (search != null && !search.isBlank()) builder.queryParam("search", search.trim());
				return builder.build();
			})
			.headers(headers -> headers.setBearerAuth(accessToken))
			.retrieve()
			.onStatus(HttpStatusCode::isError, this::toException)
			.bodyToMono(new ParameterizedTypeReference<>() {
			}));
	}

	public GitLabProject getProject(String accessToken, long projectId) {
		try {
			return execute(webClient.get()
				.uri(builder -> builder.pathSegment("projects", Long.toString(projectId)).build())
				.headers(headers -> headers.setBearerAuth(accessToken))
				.retrieve()
				.onStatus(HttpStatusCode::isError, this::toException)
				.bodyToMono(GitLabProject.class));
		} catch (GitLabApiException exception) {
			log.warn("GitLab project lookup failed: projectId={}, upstreamStatus={}, code={}",
				projectId, exception.upstreamStatus(), exception.code());
			throw exception;
		}
	}

	public List<GitLabProjectMember> getAllProjectMembers(String accessToken, long projectId) {
		List<GitLabProjectMember> result = new ArrayList<>();
		for (int page = 1; page <= 100; page++) {
			int currentPage = page;
			List<GitLabProjectMember> members = execute(webClient.get()
				.uri(builder -> builder.pathSegment("projects", Long.toString(projectId), "members", "all")
					.queryParam("page", currentPage).queryParam("per_page", 100).build())
				.headers(headers -> headers.setBearerAuth(accessToken))
				.retrieve()
				.onStatus(HttpStatusCode::isError, this::toException)
				.bodyToMono(new ParameterizedTypeReference<>() { }));
			result.addAll(members);
			if (members.size() < 100) return List.copyOf(result);
		}
		throw new GitLabApiException("GITLAB_MEMBER_LIST_TOO_LARGE", "프로젝트 멤버 목록이 허용 범위를 초과했습니다.", 413);
	}

	public List<GitLabTreeItem> getRepositoryTree(String accessToken, long projectId, String ref) {
		return getRepositoryTreePage(accessToken, projectId, ref, 1);
	}

	public List<GitLabTreeItem> getAllRepositoryTree(String accessToken, long projectId, String ref) {
		if (ref == null || ref.isBlank()) return List.of();
		List<GitLabTreeItem> result = new ArrayList<>();
		for (int page = 1; page <= 100; page++) {
			List<GitLabTreeItem> items = getRepositoryTreePage(accessToken, projectId, ref, page);
			result.addAll(items);
			if (items.size() < 100) return List.copyOf(result);
		}
		throw new GitLabApiException("GITLAB_TREE_TOO_LARGE", "저장소 파일 목록이 허용된 범위를 초과했습니다.", 413);
	}

	private List<GitLabTreeItem> getRepositoryTreePage(String accessToken, long projectId, String ref, int page) {
		if (ref == null || ref.isBlank()) {
			return List.of();
		}
		try {
			return execute(webClient.get()
				.uri(builder -> builder.pathSegment("projects", Long.toString(projectId), "repository", "tree")
					.queryParam("ref", ref)
					.queryParam("recursive", true)
					.queryParam("per_page", 100)
					.queryParam("page", page)
					.build())
				.headers(headers -> headers.setBearerAuth(accessToken))
				.retrieve()
				.onStatus(HttpStatusCode::isError, this::toException)
				.bodyToMono(new ParameterizedTypeReference<>() {
				}));
		} catch (GitLabApiException exception) {
			if (exception.upstreamStatus() == 404) {
				log.info("GitLab repository tree is empty: projectId={}, ref={}", projectId, ref);
				return List.of();
			}
			throw exception;
		}
	}

	public GitLabFileContent getRepositoryFile(
		String accessToken,
		long projectId,
		String path,
		String ref
	) {
		GitLabFileResponse file = execute(webClient.get()
			.uri(builder -> builder.pathSegment("projects", Long.toString(projectId), "repository", "files", path)
				.queryParam("ref", ref)
				.build())
			.headers(headers -> headers.setBearerAuth(accessToken))
			.retrieve()
			.onStatus(HttpStatusCode::isError, this::toException)
			.bodyToMono(GitLabFileResponse.class));
		if (file.size() > MAX_TEXT_FILE_SIZE) {
			throw new GitLabApiException("GITLAB_FILE_TOO_LARGE", "미리보기는 1MB 이하의 텍스트 파일만 지원합니다.", 413);
		}
		if (!"base64".equalsIgnoreCase(file.encoding())) {
			throw new GitLabApiException("GITLAB_FILE_ENCODING_UNSUPPORTED", "지원하지 않는 GitLab 파일 인코딩입니다.", 502);
		}
		try {
			String content = new String(Base64.getMimeDecoder().decode(file.content()), StandardCharsets.UTF_8);
			return new GitLabFileContent(
				file.fileName(), file.filePath(), file.size(), content, file.ref(),
				file.blobId(), file.commitId(), file.lastCommitId()
			);
		} catch (IllegalArgumentException exception) {
			throw new GitLabApiException("GITLAB_FILE_DECODE_FAILED", "GitLab 파일 내용을 디코딩하지 못했습니다.", 502);
		}
	}

	public GitLabFileContent createRepositoryFile(
		String accessToken,
		long projectId,
		String path,
		String branch,
		String content,
		String commitMessage
	) {
		return createRepositoryFile(accessToken, projectId, path, branch, content, commitMessage, null);
	}

	public GitLabFileContent createRepositoryFile(
		String accessToken, long projectId, String path, String branch, String content,
		String commitMessage, String authorName
	) {
		execute(webClient.post()
			.uri(builder -> builder.pathSegment("projects", Long.toString(projectId), "repository", "files", path).build())
			.headers(headers -> headers.setBearerAuth(accessToken))
			.bodyValue(new GitLabCreateFileRequest(branch, content, commitMessage, authorName))
			.retrieve()
			.onStatus(HttpStatusCode::isError, this::toException)
			.bodyToMono(GitLabCommitResponse.class));
		return getRepositoryFile(accessToken, projectId, path, branch);
	}

	public GitLabFileContent updateRepositoryFile(
		String accessToken,
		long projectId,
		String path,
		String branch,
		String content,
		String commitMessage,
		String lastCommitId
	) {
		return updateRepositoryFile(accessToken, projectId, path, branch, content, commitMessage, lastCommitId, null);
	}

	public GitLabFileContent updateRepositoryFile(
		String accessToken, long projectId, String path, String branch, String content,
		String commitMessage, String lastCommitId, String authorName
	) {
		execute(webClient.put()
			.uri(builder -> builder.pathSegment("projects", Long.toString(projectId), "repository", "files", path).build())
			.headers(headers -> headers.setBearerAuth(accessToken))
			.bodyValue(new GitLabUpdateFileRequest(branch, content, commitMessage, lastCommitId, authorName))
			.retrieve()
			.onStatus(HttpStatusCode::isError, this::toException)
			.bodyToMono(GitLabCommitResponse.class));
		return getRepositoryFile(accessToken, projectId, path, branch);
	}

	private <T> T execute(Mono<T> request) {
		try {
			T response = request.block(properties.requestTimeout());
			if (response == null) {
				throw new GitLabApiException("GITLAB_EMPTY_RESPONSE", "GitLab 응답이 비어 있습니다.", 502);
			}
			return response;
		} catch (GitLabApiException exception) {
			throw exception;
		} catch (WebClientRequestException exception) {
			throw new GitLabApiException("GITLAB_CONNECTION_FAILED", "GitLab 서버에 연결하지 못했습니다.", 502);
		} catch (RuntimeException exception) {
			throw new GitLabApiException("GITLAB_REQUEST_FAILED", "GitLab 프로젝트 요청을 처리하지 못했습니다.", 502);
		}
	}

	private Mono<? extends Throwable> toException(org.springframework.web.reactive.function.client.ClientResponse response) {
		int status = response.statusCode().value();
		int apiStatus = status == 400 || status == 401 || status == 403 || status == 404 || status == 409 || status == 422 || status == 429 ? status : 502;
		String code = switch (status) {
			case 400, 422 -> "GITLAB_COMMIT_REJECTED";
			case 401 -> "GITLAB_AUTHENTICATION_FAILED";
			case 403 -> "GITLAB_PROJECT_ACCESS_DENIED";
			case 404 -> "GITLAB_PROJECT_NOT_FOUND";
			case 409 -> "GITLAB_CONFLICT";
			case 429 -> "GITLAB_RATE_LIMITED";
			default -> "GITLAB_UPSTREAM_ERROR";
		};
		String message = switch (status) {
			case 400, 422 -> "GitLab이 커밋을 거부했습니다. 브랜치 권한과 최신 파일 상태를 확인해 주세요.";
			case 401 -> "GitLab 승인이 만료되었습니다. 다시 로그인해 주세요.";
			case 403 -> "이 GitLab 프로젝트에 접근할 권한이 없습니다.";
			case 404 -> "GitLab 프로젝트를 찾지 못했습니다.";
			case 409 -> "GitLab 파일이 다른 변경과 충돌했습니다.";
			case 429 -> "GitLab 요청 제한에 도달했습니다. 잠시 후 다시 시도해 주세요.";
			default -> "GitLab이 프로젝트 요청을 처리하지 못했습니다.";
		};
		return response.releaseBody().thenReturn(new GitLabApiException(code, message, apiStatus));
	}
}
