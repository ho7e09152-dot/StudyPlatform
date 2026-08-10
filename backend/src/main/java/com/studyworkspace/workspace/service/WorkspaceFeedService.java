package com.studyworkspace.workspace.service;

import java.time.DateTimeException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

import com.studyworkspace.auth.persistence.UserAccountEntity;
import com.studyworkspace.auth.persistence.UserAccountRepository;
import com.studyworkspace.workspace.domain.WorkspaceException;
import com.studyworkspace.workspace.domain.WorkspaceModels.StudyMember;
import com.studyworkspace.workspace.infrastructure.WorkspaceAnnouncementEntity;
import com.studyworkspace.workspace.infrastructure.WorkspaceAnnouncementRepository;
import com.studyworkspace.workspace.infrastructure.AnnouncementReadEntity;
import com.studyworkspace.workspace.infrastructure.AnnouncementReadRepository;
import com.studyworkspace.workspace.infrastructure.WorkspaceMessageEntity;
import com.studyworkspace.workspace.infrastructure.WorkspaceMessageRepository;
import com.studyworkspace.workspace.security.WorkspaceAccessService;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class WorkspaceFeedService {
	private static final int PAGE_SIZE = 30;
	private final WorkspaceAnnouncementRepository announcementRepository;
	private final WorkspaceMessageRepository messageRepository;
	private final UserAccountRepository userRepository;
	private final WorkspaceAccessService accessService;
	private final WorkspaceService workspaceService;
	private final AnnouncementReadRepository announcementReadRepository;

	public WorkspaceFeedService(
		WorkspaceAnnouncementRepository announcementRepository,
		WorkspaceMessageRepository messageRepository,
		UserAccountRepository userRepository,
		WorkspaceAccessService accessService,
		WorkspaceService workspaceService,
		AnnouncementReadRepository announcementReadRepository
	) {
		this.announcementRepository = announcementRepository;
		this.messageRepository = messageRepository;
		this.userRepository = userRepository;
		this.accessService = accessService;
		this.workspaceService = workspaceService;
		this.announcementReadRepository = announcementReadRepository;
	}

	@Transactional(readOnly = true)
	public List<AnnouncementView> listAnnouncements(String workspaceId, long actorGitLabUserId) {
		StudyMember member = accessService.requireActiveMember(workspaceId, actorGitLabUserId, false);
		boolean canManage = isManager(member);
		return announcementRepository.findVisible(workspaceId, Instant.now()).stream()
			.map(entity -> AnnouncementView.from(entity, canManage))
			.toList();
	}

	@Transactional
	public AnnouncementView createAnnouncement(String workspaceId, long actorGitLabUserId, AnnouncementRequest request) {
		StudyMember member = accessService.requireManager(workspaceId, actorGitLabUserId, false);
		UserAccountEntity account = requireAccount(actorGitLabUserId);
		NormalizedAnnouncement normalized = normalizeAnnouncement(request);
		WorkspaceAnnouncementEntity created = announcementRepository.save(WorkspaceAnnouncementEntity.create(
			workspaceId, account.id(), member.displayName(), normalized.title(), normalized.body(), normalized.pinned(),
			normalized.publishedAt(), normalized.expiresAt()
		));
		return AnnouncementView.from(created, true);
	}

	@Transactional
	public AnnouncementView updateAnnouncement(String workspaceId, String announcementId, long actorGitLabUserId, AnnouncementRequest request) {
		accessService.requireManager(workspaceId, actorGitLabUserId, false);
		WorkspaceAnnouncementEntity announcement = requireAnnouncement(workspaceId, announcementId);
		NormalizedAnnouncement normalized = normalizeAnnouncement(request);
		announcement.update(normalized.title(), normalized.body(), normalized.pinned(), normalized.publishedAt(), normalized.expiresAt());
		return AnnouncementView.from(announcement, true);
	}

	@Transactional
	public void deleteAnnouncement(String workspaceId, String announcementId, long actorGitLabUserId) {
		accessService.requireManager(workspaceId, actorGitLabUserId, false);
		requireAnnouncement(workspaceId, announcementId).archive();
	}

	@Transactional
	public Instant markAnnouncementRead(String workspaceId, String announcementId, long actorGitLabUserId) {
		accessService.requireActiveMember(workspaceId, actorGitLabUserId, false);
		UserAccountEntity account = requireAccount(actorGitLabUserId);
		requireAnnouncement(workspaceId, announcementId);
		AnnouncementReadEntity.AnnouncementReadId id = new AnnouncementReadEntity.AnnouncementReadId(announcementId, account.id());
		return announcementReadRepository.findById(id)
			.orElseGet(() -> announcementReadRepository.save(AnnouncementReadEntity.create(announcementId, account.id())))
			.readAt();
	}

	@Transactional(readOnly = true)
	public MessagePage listMessages(String workspaceId, long actorGitLabUserId, String date, String cursor) {
		StudyMember member = accessService.requireActiveMember(workspaceId, actorGitLabUserId, false);
		String accountId = requireAccount(actorGitLabUserId).id();
		LocalDate contextDate = parseDate(date, false);
		Instant before = parseCursor(cursor);
		List<WorkspaceMessageEntity> fetched = messageRepository.findPage(
			workspaceId, contextDate, before, PageRequest.of(0, PAGE_SIZE + 1)
		);
		boolean hasNext = fetched.size() > PAGE_SIZE;
		List<WorkspaceMessageEntity> page = hasNext ? fetched.subList(0, PAGE_SIZE) : fetched;
		String nextCursor = hasNext ? page.get(page.size() - 1).createdAt().toString() : null;
		boolean canManage = isManager(member);
		return new MessagePage(page.stream().map(entity -> MessageView.from(entity, canManage || accountId.equals(entity.authorUserId()))).toList(), nextCursor);
	}

	@Transactional
	public MessageView createMessage(String workspaceId, long actorGitLabUserId, MessageRequest request) {
		StudyMember member = accessService.requireActiveMember(workspaceId, actorGitLabUserId, false);
		UserAccountEntity account = requireAccount(actorGitLabUserId);
		String body = normalizeBody(request == null ? null : request.body(), 4000, "MESSAGE_BODY_REQUIRED", "메시지를 1자 이상 4000자 이하로 입력해 주세요.");
		LocalDate contextDate = parseDate(request == null ? null : request.contextDate(), false);
		if (contextDate == null) {
			String timezone = workspaceService.get(workspaceId).settings().timezone();
			contextDate = LocalDate.now(ZoneId.of(timezone));
		}
		WorkspaceMessageEntity created = messageRepository.save(WorkspaceMessageEntity.create(
			workspaceId, account.id(), member.displayName(), contextDate, body
		));
		return MessageView.from(created, true);
	}

	@Transactional
	public MessageView updateMessage(String workspaceId, String messageId, long actorGitLabUserId, MessageRequest request) {
		WorkspaceMessageEntity message = requireMessage(workspaceId, messageId);
		boolean canEdit = canEdit(workspaceId, actorGitLabUserId, message.authorUserId());
		if (!canEdit) throw new WorkspaceException("MESSAGE_EDIT_FORBIDDEN", "본인이 작성한 메시지만 수정할 수 있습니다.", 403);
		message.updateBody(normalizeBody(request == null ? null : request.body(), 4000, "MESSAGE_BODY_REQUIRED", "메시지를 1자 이상 4000자 이하로 입력해 주세요."));
		return MessageView.from(message, true);
	}

	@Transactional
	public void deleteMessage(String workspaceId, String messageId, long actorGitLabUserId) {
		WorkspaceMessageEntity message = requireMessage(workspaceId, messageId);
		if (!canEdit(workspaceId, actorGitLabUserId, message.authorUserId())) {
			throw new WorkspaceException("MESSAGE_DELETE_FORBIDDEN", "본인이 작성한 메시지만 삭제할 수 있습니다.", 403);
		}
		message.softDelete();
	}

	private boolean canEdit(String workspaceId, long actorGitLabUserId, String authorUserId) {
		StudyMember member = accessService.requireActiveMember(workspaceId, actorGitLabUserId, false);
		return isManager(member) || requireAccount(actorGitLabUserId).id().equals(authorUserId);
	}

	private WorkspaceAnnouncementEntity requireAnnouncement(String workspaceId, String id) {
		return announcementRepository.findById(id)
			.filter(entity -> entity.workspaceId().equals(workspaceId) && entity.archivedAt() == null)
			.orElseThrow(() -> new WorkspaceException("ANNOUNCEMENT_NOT_FOUND", "공지를 찾을 수 없습니다.", 404));
	}

	private WorkspaceMessageEntity requireMessage(String workspaceId, String id) {
		return messageRepository.findById(id)
			.filter(entity -> entity.workspaceId().equals(workspaceId) && entity.deletedAt() == null)
			.orElseThrow(() -> new WorkspaceException("MESSAGE_NOT_FOUND", "메시지를 찾을 수 없습니다.", 404));
	}

	private UserAccountEntity requireAccount(long gitLabUserId) {
		return userRepository.findByGitLabUserId(gitLabUserId)
			.orElseThrow(() -> new WorkspaceException("ACCOUNT_NOT_FOUND", "사용자 계정을 찾을 수 없습니다.", 404));
	}

	private static boolean isManager(StudyMember member) {
		return "OWNER".equals(member.role()) || "MANAGER".equals(member.role());
	}

	private static NormalizedAnnouncement normalizeAnnouncement(AnnouncementRequest request) {
		if (request == null) throw new WorkspaceException("ANNOUNCEMENT_REQUIRED", "공지 내용을 입력해 주세요.", 400);
		String title = normalizeBody(request.title(), 120, "ANNOUNCEMENT_TITLE_REQUIRED", "공지 제목은 1자 이상 120자 이하로 입력해 주세요.");
		String body = normalizeBody(request.body(), 10000, "ANNOUNCEMENT_BODY_REQUIRED", "공지 내용은 1자 이상 10000자 이하로 입력해 주세요.");
		Instant publishedAt = request.publishedAt() == null ? Instant.now() : request.publishedAt();
		if (request.expiresAt() != null && !request.expiresAt().isAfter(publishedAt)) {
			throw new WorkspaceException("INVALID_ANNOUNCEMENT_PERIOD", "공지 만료 시각은 게시 시각보다 뒤여야 합니다.", 400);
		}
		return new NormalizedAnnouncement(title, body, Boolean.TRUE.equals(request.pinned()), publishedAt, request.expiresAt());
	}

	private static String normalizeBody(String value, int maxLength, String code, String message) {
		String normalized = value == null ? "" : value.strip().replace("\r\n", "\n").replace('\r', '\n');
		boolean hasInvalidControl = normalized.chars().anyMatch(character -> Character.isISOControl(character) && character != '\n' && character != '\t');
		if (!StringUtils.hasText(normalized) || normalized.length() > maxLength || hasInvalidControl) {
			throw new WorkspaceException(code, message, 400);
		}
		return normalized;
	}

	private static LocalDate parseDate(String value, boolean required) {
		if (!StringUtils.hasText(value)) {
			if (required) throw new WorkspaceException("INVALID_CONTEXT_DATE", "날짜가 필요합니다.", 400);
			return null;
		}
		try {
			return LocalDate.parse(value.trim());
		} catch (DateTimeException exception) {
			throw new WorkspaceException("INVALID_CONTEXT_DATE", "날짜는 YYYY-MM-DD 형식으로 입력해 주세요.", 400);
		}
	}

	private static Instant parseCursor(String cursor) {
		if (!StringUtils.hasText(cursor)) return null;
		try {
			return Instant.parse(cursor.trim());
		} catch (DateTimeException exception) {
			throw new WorkspaceException("INVALID_MESSAGE_CURSOR", "메시지 페이지 위치가 올바르지 않습니다.", 400);
		}
	}

	private record NormalizedAnnouncement(String title, String body, boolean pinned, Instant publishedAt, Instant expiresAt) { }

	public record AnnouncementRequest(String title, String body, Boolean pinned, Instant publishedAt, Instant expiresAt) { }
	public record MessageRequest(String body, String contextDate) { }
	public record MessagePage(List<MessageView> items, String nextCursor) { }

	public record AnnouncementView(String id, String authorName, String title, String body, boolean pinned, Instant publishedAt, Instant expiresAt, Instant updatedAt, boolean canEdit) {
		static AnnouncementView from(WorkspaceAnnouncementEntity entity, boolean canEdit) {
			return new AnnouncementView(entity.id(), entity.authorDisplayName(), entity.title(), entity.body(), entity.pinned(), entity.publishedAt(), entity.expiresAt(), entity.updatedAt(), canEdit);
		}
	}

	public record MessageView(String id, String authorName, LocalDate contextDate, String body, Instant createdAt, Instant updatedAt, boolean edited, boolean canEdit) {
		static MessageView from(WorkspaceMessageEntity entity, boolean canEdit) {
			return new MessageView(entity.id(), entity.authorDisplayName(), entity.contextDate(), entity.body(), entity.createdAt(), entity.updatedAt(), entity.updatedAt().isAfter(entity.createdAt()), canEdit);
		}
	}
}
