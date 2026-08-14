package com.studyworkspace.github.service;

import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import com.studyworkspace.common.exception.GitHubApiException;
import com.studyworkspace.github.config.GitHubAppProperties;
import com.studyworkspace.github.dto.GitHubCommitComment;
import com.studyworkspace.github.dto.GitHubContentResponse;
import com.studyworkspace.github.dto.GitHubInstallation;
import com.studyworkspace.github.dto.GitHubRepository;
import com.studyworkspace.workspace.domain.RepositoryProvider;
import com.studyworkspace.workspace.domain.WorkspaceModels.RepositoryIdentity;
import com.studyworkspace.workspace.dto.RepositorySummary;
import com.studyworkspace.workspace.port.RepositoryDataPort;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.client.reactive.JdkClientHttpConnector;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import reactor.core.publisher.Mono;

/** GitHub App user-token repository adapter. App installation and user permissions both bound every request. */
@Service
public class GitHubRepositoryService implements RepositoryDataPort {
	private static final String API_VERSION = "2026-03-10";
	private static final String USER_AGENT = "Study-ing";
	private static final long MAX_TEXT_FILE_SIZE = 1_000_000;
	private static final int MAX_INSTALLATIONS = 100;
	private static final int MAX_REPOSITORIES = 10_000;

	private final WebClient api;
	private final GitHubAppProperties properties;

	public GitHubRepositoryService(WebClient.Builder builder, GitHubAppProperties properties) {
		this.properties = properties;
		HttpClient client = HttpClient.newBuilder().connectTimeout(properties.requestTimeout())
			.followRedirects(HttpClient.Redirect.NEVER).build();
		this.api = builder.clone().clientConnector(new JdkClientHttpConnector(client))
			.baseUrl(properties.apiBaseUrl()).build();
	}

	@Override public RepositoryProvider provider() { return RepositoryProvider.GITHUB; }

	@Override
	public List<RepositorySummary> listRepositories(String token, String search, int page, int perPage) {
		List<GitHubRepository> all = listAllRepositories(token);
		String query = search == null ? "" : search.strip().toLowerCase();
		List<GitHubRepository> filtered = all.stream()
			.filter(repo -> query.isBlank() || repo.name().toLowerCase().contains(query) || repo.fullName().toLowerCase().contains(query))
			.sorted(java.util.Comparator.comparing(GitHubRepository::fullName, String.CASE_INSENSITIVE_ORDER)).toList();
		int start = Math.min(filtered.size(), Math.max(0, page - 1) * perPage);
		int end = Math.min(filtered.size(), start + perPage);
		return filtered.subList(start, end).stream().map(GitHubRepositoryService::summary).toList();
	}

	@Override
	public RepositorySummary getRepository(String token, String externalId) {
		return listAllRepositories(token).stream()
			.filter(repo -> Long.toString(repo.id()).equals(externalId))
			.findFirst().map(GitHubRepositoryService::summary)
			.orElseThrow(() -> error("GITHUB_REPOSITORY_NOT_FOUND", "GitHub 저장소를 찾지 못했습니다.", 404));
	}

	@Override
	public List<TreeEntry> listTree(String token, RepositoryIdentity repository) {
		String fullName = requireFullName(repository);
		if (!StringUtils.hasText(repository.defaultBranch())) return List.of();
		try {
			TreeResponse response = execute(api.get()
				.uri(builder -> builder.path("/repos/{owner}/{repo}/git/trees/{ref}")
					.queryParam("recursive", "1").build(parts(fullName, repository.defaultBranch())))
				.headers(headers -> authorize(headers, token)).retrieve()
				.onStatus(HttpStatusCode::isError, this::toException).bodyToMono(TreeResponse.class));
			return response.tree() == null ? List.of() : response.tree().stream()
				.map(item -> new TreeEntry(item.sha(), fileName(item.path()), item.type(), item.path(), item.mode())).toList();
		} catch (GitHubApiException exception) {
			if (exception.upstreamStatus() == 409) return List.of();
			throw exception;
		}
	}

	@Override
	public RepositoryFile getFile(String token, RepositoryIdentity repository, String path, String ref) {
		GitHubContentResponse file = loadContent(token, repository, path, ref);
		String commitId = latestCommit(token, repository, path, ref);
		return decoded(file, ref, commitId);
	}

	@Override
	public RepositoryFile createFile(String token, RepositoryIdentity repository, String path, String branch,
		String content, String commitMessage, String authorName) {
		return putFile(token, repository, path, branch, content, commitMessage, null);
	}

	@Override
	public RepositoryFile updateFile(String token, RepositoryIdentity repository, String path, String branch,
		String content, String commitMessage, String expectedVersion, String authorName) {
		RepositoryFile current = getFile(token, repository, path, branch);
		if (StringUtils.hasText(expectedVersion) && !expectedVersion.equals(current.version())) {
			throw error("GITHUB_FILE_CONFLICT", "GitHub 파일이 다른 변경과 충돌했습니다.", 409);
		}
		GitHubContentResponse raw = loadContent(token, repository, path, branch);
		return putFile(token, repository, path, branch, content, commitMessage, raw.sha());
	}

	@Override
	public String createCommit(String token, RepositoryIdentity repository, String branch, String message,
		List<CommitAction> actions, String authorName) {
		String fullName = requireFullName(repository);
		RefResponse ref = get(token, "/repos/{owner}/{repo}/git/ref/heads/{branch}", RefResponse.class, parts(fullName, branch));
		GitCommitResponse base = get(token, "/repos/{owner}/{repo}/git/commits/{sha}", GitCommitResponse.class,
			parts(fullName, ref.object().sha()));
		List<Map<String, Object>> entries = new ArrayList<>();
		for (CommitAction action : actions) {
			if ("MOVE".equals(action.action())) {
				GitHubContentResponse source = loadContent(token, repository, action.sourcePath(), branch);
				entries.add(treeEntry(action.targetPath(), source.sha(), null));
				entries.add(treeEntry(action.sourcePath(), null, null));
			} else {
				entries.add(treeEntry(action.targetPath(), null, Objects.toString(action.content(), "")));
			}
		}
		TreeCreated tree = post(token, "/repos/{owner}/{repo}/git/trees", Map.of("base_tree", base.tree().sha(), "tree", entries),
			TreeCreated.class, parts(fullName));
		GitCommitResponse commit = post(token, "/repos/{owner}/{repo}/git/commits",
			Map.of("message", message, "tree", tree.sha(), "parents", List.of(ref.object().sha())), GitCommitResponse.class, parts(fullName));
		patch(token, "/repos/{owner}/{repo}/git/refs/heads/{branch}", Map.of("sha", commit.sha(), "force", false),
			RefResponse.class, parts(fullName, branch));
		return commit.sha();
	}

	@Override
	public List<CommitComment> listCommitComments(String token, RepositoryIdentity repository, String commitId) {
		String fullName = requireFullName(repository);
		List<GitHubCommitComment> comments = execute(api.get()
			.uri(builder -> builder.path("/repos/{owner}/{repo}/commits/{sha}/comments").queryParam("per_page", 100)
				.build(parts(fullName, commitId)))
			.headers(headers -> authorize(headers, token)).retrieve().onStatus(HttpStatusCode::isError, this::toException)
			.bodyToMono(new ParameterizedTypeReference<>() {}));
		return comments.stream().map(GitHubRepositoryService::comment).toList();
	}

	@Override
	public CommitComment createCommitComment(String token, RepositoryIdentity repository, String commitId, String body) {
		String fullName = requireFullName(repository);
		return comment(post(token, "/repos/{owner}/{repo}/commits/{sha}/comments", Map.of("body", body),
			GitHubCommitComment.class, parts(fullName, commitId)));
	}

	public List<GitHubInstallation> listInstallations(String token) {
		List<GitHubInstallation> result = new ArrayList<>();
		for (int page = 1; page <= MAX_INSTALLATIONS; page++) {
			int current = page;
			InstallationsResponse response = execute(api.get().uri(builder -> builder.path("/user/installations")
				.queryParam("per_page", 100).queryParam("page", current).build())
				.headers(headers -> authorize(headers, token)).retrieve().onStatus(HttpStatusCode::isError, this::toException)
				.bodyToMono(InstallationsResponse.class));
			List<GitHubInstallation> pageItems = response.installations() == null ? List.of() : response.installations();
			result.addAll(pageItems);
			if (pageItems.size() < 100) return List.copyOf(result);
		}
		throw error("GITHUB_INSTALLATION_LIST_TOO_LARGE", "GitHub App 설치 목록이 허용 범위를 초과했습니다.", 413);
	}

	public GitHubInstallation requireInstallation(String token, long installationId) {
		return listInstallations(token).stream().filter(item -> item.id() == installationId).findFirst()
			.orElseThrow(() -> error("GITHUB_INSTALLATION_NOT_ACCESSIBLE", "GitHub App 설치 권한을 확인할 수 없습니다.", 403));
	}

	private List<GitHubRepository> listAllRepositories(String token) {
		Map<Long, GitHubRepository> result = new LinkedHashMap<>();
		for (GitHubInstallation installation : listInstallations(token)) {
			for (int page = 1; page <= 100; page++) {
				int current = page;
				RepositoriesResponse response = execute(api.get().uri(builder -> builder
					.path("/user/installations/{installationId}/repositories").queryParam("per_page", 100)
					.queryParam("page", current).build(installation.id()))
					.headers(headers -> authorize(headers, token)).retrieve().onStatus(HttpStatusCode::isError, this::toException)
					.bodyToMono(RepositoriesResponse.class));
				List<GitHubRepository> repositories = response.repositories() == null ? List.of() : response.repositories();
				repositories.forEach(repo -> result.putIfAbsent(repo.id(), repo));
				if (result.size() > MAX_REPOSITORIES) throw error("GITHUB_REPOSITORY_LIST_TOO_LARGE", "접근 가능한 GitHub 저장소가 너무 많습니다.", 413);
				if (repositories.size() < 100) break;
			}
		}
		return List.copyOf(result.values());
	}

	private RepositoryFile putFile(String token, RepositoryIdentity repository, String path, String branch,
		String content, String message, String sha) {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("message", message);
		body.put("content", Base64.getEncoder().encodeToString(content.getBytes(StandardCharsets.UTF_8)));
		body.put("branch", branch);
		if (StringUtils.hasText(sha)) body.put("sha", sha);
		ContentWriteResponse response = put(token, "/repos/{owner}/{repo}/contents/{path}", body,
			ContentWriteResponse.class, parts(requireFullName(repository), path));
		String commitId = response.commit() == null ? null : response.commit().sha();
		String blobId = response.content() == null ? sha : response.content().sha();
		if (!StringUtils.hasText(commitId)) throw error("GITHUB_COMMIT_ID_MISSING", "GitHub 커밋 SHA를 확인하지 못했습니다.", 502);
		return new RepositoryFile(fileName(path), path, content.getBytes(StandardCharsets.UTF_8).length, content,
			branch, blobId, commitId, commitId);
	}

	private GitHubContentResponse loadContent(String token, RepositoryIdentity repository, String path, String ref) {
		GitHubContentResponse file = execute(api.get().uri(builder -> builder.path("/repos/{owner}/{repo}/contents/{path}")
			.queryParam("ref", ref).build(parts(requireFullName(repository), path)))
			.headers(headers -> authorize(headers, token)).retrieve().onStatus(HttpStatusCode::isError, this::toException)
			.bodyToMono(GitHubContentResponse.class));
		if (file.size() > MAX_TEXT_FILE_SIZE) throw error("GITHUB_FILE_TOO_LARGE", "미리보기는 1MB 이하의 텍스트 파일만 지원합니다.", 413);
		return file;
	}

	private String latestCommit(String token, RepositoryIdentity repository, String path, String ref) {
		String fullName = requireFullName(repository);
		List<CommitListItem> commits = execute(api.get().uri(builder -> builder.path("/repos/{owner}/{repo}/commits")
			.queryParam("path", path).queryParam("sha", ref).queryParam("per_page", 1).build(parts(fullName)))
			.headers(headers -> authorize(headers, token)).retrieve().onStatus(HttpStatusCode::isError, this::toException)
			.bodyToMono(new ParameterizedTypeReference<>() {}));
		if (commits.isEmpty() || !StringUtils.hasText(commits.getFirst().sha())) {
			throw error("GITHUB_COMMIT_ID_MISSING", "GitHub 파일의 최신 커밋을 확인하지 못했습니다.", 502);
		}
		return commits.getFirst().sha();
	}

	private static RepositoryFile decoded(GitHubContentResponse file, String ref, String commitId) {
		if (!"base64".equalsIgnoreCase(file.encoding())) throw error("GITHUB_FILE_ENCODING_UNSUPPORTED", "지원하지 않는 GitHub 파일 인코딩입니다.", 502);
		try {
			String content = new String(Base64.getMimeDecoder().decode(file.content()), StandardCharsets.UTF_8);
			return new RepositoryFile(file.name(), file.path(), file.size(), content, ref, file.sha(), commitId, commitId);
		} catch (IllegalArgumentException exception) {
			throw error("GITHUB_FILE_DECODE_FAILED", "GitHub 파일 내용을 디코딩하지 못했습니다.", 502);
		}
	}

	private <T> T get(String token, String path, Class<T> type, Object[] variables) {
		return execute(api.get().uri(path, variables).headers(headers -> authorize(headers, token)).retrieve()
			.onStatus(HttpStatusCode::isError, this::toException).bodyToMono(type));
	}
	private <T> T post(String token, String path, Object body, Class<T> type, Object[] variables) {
		return execute(api.post().uri(path, variables).headers(headers -> authorize(headers, token)).bodyValue(body).retrieve()
			.onStatus(HttpStatusCode::isError, this::toException).bodyToMono(type));
	}
	private <T> T put(String token, String path, Object body, Class<T> type, Object[] variables) {
		return execute(api.put().uri(path, variables).headers(headers -> authorize(headers, token)).bodyValue(body).retrieve()
			.onStatus(HttpStatusCode::isError, this::toException).bodyToMono(type));
	}
	private <T> T patch(String token, String path, Object body, Class<T> type, Object[] variables) {
		return execute(api.patch().uri(path, variables).headers(headers -> authorize(headers, token)).bodyValue(body).retrieve()
			.onStatus(HttpStatusCode::isError, this::toException).bodyToMono(type));
	}

	private <T> T execute(Mono<T> request) {
		try {
			T response = request.block(properties.requestTimeout());
			if (response == null) throw error("GITHUB_EMPTY_RESPONSE", "GitHub 응답이 비어 있습니다.", 502);
			return response;
		} catch (GitHubApiException exception) {
			throw exception;
		} catch (WebClientRequestException exception) {
			throw new GitHubApiException("GITHUB_CONNECTION_FAILED", "GitHub 서버에 연결하지 못했습니다.", 502, exception);
		} catch (RuntimeException exception) {
			throw new GitHubApiException("GITHUB_REQUEST_FAILED", "GitHub 저장소 요청을 처리하지 못했습니다.", 502, exception);
		}
	}

	private Mono<? extends Throwable> toException(ClientResponse response) {
		int status = response.statusCode().value();
		if (status == 403 && "0".equals(response.headers().header("X-RateLimit-Remaining").stream().findFirst().orElse(null))) status = 429;
		int mapped = status == 400 || status == 401 || status == 403 || status == 404 || status == 409 || status == 422 || status == 429 ? status : 502;
		String code = switch (status) {
			case 401 -> "GITHUB_REAUTH_REQUIRED";
			case 403 -> "GITHUB_REPOSITORY_ACCESS_DENIED";
			case 404 -> "GITHUB_REPOSITORY_NOT_FOUND";
			case 409, 422 -> "GITHUB_CONFLICT";
			case 429 -> "GITHUB_RATE_LIMITED";
			default -> "GITHUB_UPSTREAM_ERROR";
		};
		String message = switch (status) {
			case 401 -> "GitHub 계정을 다시 승인해 주세요.";
			case 403 -> "이 GitHub 저장소에 접근할 권한이 없습니다.";
			case 404 -> "GitHub 저장소를 찾지 못했습니다.";
			case 409, 422 -> "GitHub 저장소 변경이 다른 작업과 충돌했습니다.";
			case 429 -> "GitHub 요청 제한에 도달했습니다. 잠시 후 다시 시도해 주세요.";
			default -> "GitHub가 저장소 요청을 처리하지 못했습니다.";
		};
		return response.releaseBody().thenReturn(error(code, message, mapped));
	}

	private static RepositorySummary summary(GitHubRepository repository) {
		Map<String, Boolean> permissions = repository.permissions() == null ? Map.of() : repository.permissions();
		boolean admin = Boolean.TRUE.equals(permissions.get("admin"));
		boolean maintain = Boolean.TRUE.equals(permissions.get("maintain"));
		boolean push = Boolean.TRUE.equals(permissions.get("push"));
		boolean triage = Boolean.TRUE.equals(permissions.get("triage"));
		boolean pull = Boolean.TRUE.equals(permissions.get("pull"));
		String permission = admin ? "ADMIN" : maintain ? "MAINTAIN" : push ? "WRITE" : triage ? "TRIAGE" : pull ? "READ" : "NONE";
		return new RepositorySummary(RepositoryProvider.GITHUB, Long.toString(repository.id()), repository.name(), repository.fullName(),
			repository.visibility() == null ? (repository.privateRepository() ? "private" : "public") : repository.visibility(),
			repository.defaultBranch(), repository.webUrl(), new RepositorySummary.Capabilities(pull || push || maintain || admin, push || maintain || admin, admin),
			permission, "AVAILABLE");
	}

	private static CommitComment comment(GitHubCommitComment comment) {
		var user = comment.user();
		return new CommitComment(Long.toString(comment.id()), Objects.toString(comment.body(), ""), user == null ? "0" : Long.toString(user.id()),
			user == null ? "unknown" : user.login(), user == null || !StringUtils.hasText(user.name()) ? (user == null ? "알 수 없는 사용자" : user.login()) : user.name(),
			user == null ? null : user.avatarUrl(), Objects.toString(comment.createdAt(), ""));
	}

	private static void authorize(HttpHeaders headers, String token) {
		headers.setBearerAuth(token);
		headers.set(HttpHeaders.ACCEPT, "application/vnd.github+json");
		headers.set(HttpHeaders.USER_AGENT, USER_AGENT);
		headers.set("X-GitHub-Api-Version", API_VERSION);
	}
	private static String requireFullName(RepositoryIdentity repository) {
		if (repository == null || !StringUtils.hasText(repository.fullName()) || !repository.fullName().matches("[^/]+/[^/]+"))
			throw new IllegalArgumentException("GitHub repository fullName is required");
		return repository.fullName();
	}
	private static Object[] parts(String fullName, Object... tail) {
		String[] split = fullName.split("/", 2);
		Object[] values = new Object[2 + tail.length]; values[0] = split[0]; values[1] = split[1];
		System.arraycopy(tail, 0, values, 2, tail.length); return values;
	}
	private static String fileName(String path) { int slash = path.lastIndexOf('/'); return slash < 0 ? path : path.substring(slash + 1); }
	private static Map<String, Object> treeEntry(String path, String sha, String content) {
		Map<String, Object> entry = new LinkedHashMap<>(); entry.put("path", path); entry.put("mode", "100644"); entry.put("type", "blob");
		if (content != null) entry.put("content", content); else entry.put("sha", sha); return entry;
	}
	private static GitHubApiException error(String code, String message, int status) { return new GitHubApiException(code, message, status); }

	private record InstallationsResponse(@com.fasterxml.jackson.annotation.JsonAlias("total_count") int totalCount, List<GitHubInstallation> installations) { }
	private record RepositoriesResponse(@com.fasterxml.jackson.annotation.JsonAlias("total_count") int totalCount, List<GitHubRepository> repositories) { }
	private record TreeResponse(String sha, boolean truncated, List<TreeItem> tree) { }
	private record TreeItem(String path, String mode, String type, String sha, Long size) { }
	private record ContentWriteResponse(GitHubContentResponse content, CommitListItem commit) { }
	private record CommitListItem(String sha) { }
	private record RefResponse(RefObject object) { }
	private record RefObject(String sha, String type) { }
	private record GitCommitResponse(String sha, GitTree tree) { }
	private record GitTree(String sha) { }
	private record TreeCreated(String sha) { }
}
