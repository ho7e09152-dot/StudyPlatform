package com.studyworkspace.workspace.service;

import java.time.DateTimeException;
import java.time.Instant;
import java.util.List;

import com.studyworkspace.auth.persistence.UserAccountEntity;
import com.studyworkspace.auth.persistence.UserAccountRepository;
import com.studyworkspace.workspace.domain.WorkspaceException;
import com.studyworkspace.workspace.infrastructure.WorkspaceDocumentEntity;
import com.studyworkspace.workspace.infrastructure.WorkspaceDocumentRepository;
import com.studyworkspace.workspace.security.WorkspaceAccessService;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class WorkspaceDocumentService {
	private static final int PAGE_SIZE = 24;
	private final WorkspaceDocumentRepository repository;
	private final UserAccountRepository userRepository;
	private final WorkspaceAccessService accessService;

	public WorkspaceDocumentService(WorkspaceDocumentRepository repository, UserAccountRepository userRepository, WorkspaceAccessService accessService) {
		this.repository = repository;
		this.userRepository = userRepository;
		this.accessService = accessService;
	}

	@Transactional(readOnly = true)
	public DocumentPage list(String workspaceId, long actorGitLabUserId, String query, String cursor) {
		accessService.requireActiveMember(workspaceId, actorGitLabUserId, false);
		String accountId = requireAccount(actorGitLabUserId).id();
		String normalizedQuery = normalizeQuery(query);
		List<WorkspaceDocumentEntity> fetched = repository.findPage(workspaceId, normalizedQuery, parseCursor(cursor), PageRequest.of(0, PAGE_SIZE + 1));
		boolean hasNext = fetched.size() > PAGE_SIZE;
		List<WorkspaceDocumentEntity> page = hasNext ? fetched.subList(0, PAGE_SIZE) : fetched;
		String nextCursor = hasNext ? page.get(page.size() - 1).updatedAt().toString() : null;
		return new DocumentPage(page.stream().map(entity -> DocumentView.from(entity, accountId.equals(entity.authorUserId()))).toList(), nextCursor);
	}

	@Transactional(readOnly = true)
	public DocumentView get(String workspaceId, String documentId, long actorGitLabUserId) {
		accessService.requireActiveMember(workspaceId, actorGitLabUserId, false);
		String accountId = requireAccount(actorGitLabUserId).id();
		WorkspaceDocumentEntity document = requireDocument(workspaceId, documentId);
		return DocumentView.from(document, accountId.equals(document.authorUserId()));
	}

	@Transactional
	public DocumentView create(String workspaceId, long actorGitLabUserId, DocumentMutation request) {
		var member = accessService.requireActiveMember(workspaceId, actorGitLabUserId, false);
		UserAccountEntity account = requireAccount(actorGitLabUserId);
		String title = normalizeTitle(request == null ? null : request.title());
		String body = normalizeBody(request == null ? null : request.bodyMarkdown());
		WorkspaceDocumentEntity document = repository.save(WorkspaceDocumentEntity.create(workspaceId, account.id(), member.displayName(), title, body));
		return DocumentView.from(document, true);
	}

	@Transactional
	public DocumentView update(String workspaceId, String documentId, long actorGitLabUserId, DocumentMutation request) {
		accessService.requireActiveMember(workspaceId, actorGitLabUserId, false);
		String accountId = requireAccount(actorGitLabUserId).id();
		WorkspaceDocumentEntity document = requireDocument(workspaceId, documentId);
		if (!accountId.equals(document.authorUserId())) {
			throw new WorkspaceException("DOCUMENT_EDIT_FORBIDDEN", "문서를 만든 사람만 수정할 수 있습니다.", 403);
		}
		if (request == null || request.expectedVersion() == null || request.expectedVersion() != document.version()) {
			throw new WorkspaceException("DOCUMENT_VERSION_CONFLICT", "다른 화면에서 문서가 변경되었습니다. 최신 내용을 다시 확인해 주세요.", 409);
		}
		document.update(normalizeTitle(request.title()), normalizeBody(request.bodyMarkdown()));
		repository.flush();
		return DocumentView.from(document, true);
	}

	@Transactional
	public void delete(String workspaceId, String documentId, long actorGitLabUserId, Integer expectedVersion) {
		accessService.requireActiveMember(workspaceId, actorGitLabUserId, false);
		String accountId = requireAccount(actorGitLabUserId).id();
		WorkspaceDocumentEntity document = requireDocument(workspaceId, documentId);
		if (!accountId.equals(document.authorUserId())) {
			throw new WorkspaceException("DOCUMENT_DELETE_FORBIDDEN", "문서를 만든 사람만 삭제할 수 있습니다.", 403);
		}
		if (expectedVersion == null || expectedVersion != document.version()) {
			throw new WorkspaceException("DOCUMENT_VERSION_CONFLICT", "다른 화면에서 문서가 변경되었습니다. 최신 내용을 다시 확인해 주세요.", 409);
		}
		document.softDelete();
	}

	private WorkspaceDocumentEntity requireDocument(String workspaceId, String documentId) {
		return repository.findById(documentId)
			.filter(entity -> entity.workspaceId().equals(workspaceId) && entity.deletedAt() == null)
			.orElseThrow(() -> new WorkspaceException("DOCUMENT_NOT_FOUND", "팀 문서를 찾을 수 없습니다.", 404));
	}

	private UserAccountEntity requireAccount(long gitLabUserId) {
		return userRepository.findByGitLabUserId(gitLabUserId)
			.orElseThrow(() -> new WorkspaceException("ACCOUNT_NOT_FOUND", "사용자 계정을 찾을 수 없습니다.", 404));
	}

	private static String normalizeTitle(String value) {
		String normalized = value == null ? "" : value.strip().replaceAll("\\s+", " ");
		if (!StringUtils.hasText(normalized) || normalized.length() > 120 || normalized.chars().anyMatch(Character::isISOControl)) {
			throw new WorkspaceException("INVALID_DOCUMENT_TITLE", "문서 제목은 1자 이상 120자 이하로 입력해 주세요.", 400);
		}
		return normalized;
	}

	private static String normalizeBody(String value) {
		String normalized = value == null ? "" : value.replace("\r\n", "\n").replace('\r', '\n');
		boolean invalidControl = normalized.chars().anyMatch(character -> Character.isISOControl(character) && character != '\n' && character != '\t');
		if (normalized.length() > 100_000 || invalidControl) {
			throw new WorkspaceException("INVALID_DOCUMENT_BODY", "문서 내용은 제어 문자 없이 100,000자 이하로 입력해 주세요.", 400);
		}
		return normalized;
	}

	private static String normalizeQuery(String query) {
		if (!StringUtils.hasText(query)) return null;
		String normalized = query.strip();
		if (normalized.length() > 100) throw new WorkspaceException("INVALID_DOCUMENT_QUERY", "검색어는 100자 이하로 입력해 주세요.", 400);
		return normalized;
	}

	private static Instant parseCursor(String cursor) {
		if (!StringUtils.hasText(cursor)) return null;
		try { return Instant.parse(cursor.strip()); }
		catch (DateTimeException exception) { throw new WorkspaceException("INVALID_DOCUMENT_CURSOR", "문서 페이지 위치가 올바르지 않습니다.", 400); }
	}

	public record DocumentMutation(String title, String bodyMarkdown, Integer expectedVersion) { }
	public record DocumentPage(List<DocumentView> items, String nextCursor) { }
	public record DocumentView(String id, String authorName, String title, String bodyMarkdown, int version, Instant createdAt, Instant updatedAt, boolean canEdit) {
		static DocumentView from(WorkspaceDocumentEntity entity, boolean canEdit) {
			return new DocumentView(entity.id(), entity.authorDisplayName(), entity.title(), entity.bodyMarkdown(), entity.version(), entity.createdAt(), entity.updatedAt(), canEdit);
		}
	}
}
