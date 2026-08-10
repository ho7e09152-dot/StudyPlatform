package com.studyworkspace.workspace.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Optional;

import com.studyworkspace.auth.persistence.UserAccountEntity;
import com.studyworkspace.auth.persistence.UserAccountRepository;
import com.studyworkspace.gitlab.dto.GitLabUser;
import com.studyworkspace.workspace.domain.WorkspaceException;
import com.studyworkspace.workspace.domain.WorkspaceModels.StudyMember;
import com.studyworkspace.workspace.infrastructure.WorkspaceAnnouncementRepository;
import com.studyworkspace.workspace.infrastructure.AnnouncementReadRepository;
import com.studyworkspace.workspace.infrastructure.WorkspaceMessageEntity;
import com.studyworkspace.workspace.infrastructure.WorkspaceMessageRepository;
import com.studyworkspace.workspace.security.WorkspaceAccessService;
import org.junit.jupiter.api.Test;

class WorkspaceFeedServiceTests {
	private final WorkspaceAnnouncementRepository announcements = mock(WorkspaceAnnouncementRepository.class);
	private final WorkspaceMessageRepository messages = mock(WorkspaceMessageRepository.class);
	private final UserAccountRepository users = mock(UserAccountRepository.class);
	private final WorkspaceAccessService access = mock(WorkspaceAccessService.class);
	private final WorkspaceService workspaces = mock(WorkspaceService.class);
	private final AnnouncementReadRepository reads = mock(AnnouncementReadRepository.class);
	private final WorkspaceFeedService service = new WorkspaceFeedService(announcements, messages, users, access, workspaces, reads);

	@Test
	void managerCanCreateAPinnedAnnouncement() {
		UserAccountEntity account = account(1, "manager", "관리자");
		when(users.findByGitLabUserId(1)).thenReturn(Optional.of(account));
		when(access.requireManager("workspace", 1, false)).thenReturn(member(1, "MANAGER", "관리자"));
		when(announcements.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

		var created = service.createAnnouncement("workspace", 1, new WorkspaceFeedService.AnnouncementRequest(
			"  회의 안내  ", "  금요일 9시에 만나요.  ", true, null, null
		));

		assertThat(created.title()).isEqualTo("회의 안내");
		assertThat(created.body()).isEqualTo("금요일 9시에 만나요.");
		assertThat(created.pinned()).isTrue();
		assertThat(created.canEdit()).isTrue();
	}

	@Test
	void memberCanCreateAMessageForTheSelectedDate() {
		UserAccountEntity account = account(2, "member", "스터디원");
		when(users.findByGitLabUserId(2)).thenReturn(Optional.of(account));
		when(access.requireActiveMember("workspace", 2, false)).thenReturn(member(2, "MEMBER", "스터디원"));
		when(messages.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

		var created = service.createMessage("workspace", 2, new WorkspaceFeedService.MessageRequest("  풀이를 올렸어요.  ", "2026-08-10"));

		assertThat(created.contextDate()).isEqualTo(LocalDate.of(2026, 8, 10));
		assertThat(created.body()).isEqualTo("풀이를 올렸어요.");
		assertThat(created.canEdit()).isTrue();
	}

	@Test
	void memberCannotEditAnotherMembersMessage() {
		UserAccountEntity author = account(3, "author", "작성자");
		UserAccountEntity reader = account(4, "reader", "다른 멤버");
		WorkspaceMessageEntity message = WorkspaceMessageEntity.create("workspace", author.id(), "작성자", LocalDate.of(2026, 8, 10), "원문");
		when(messages.findById(message.id())).thenReturn(Optional.of(message));
		when(users.findByGitLabUserId(4)).thenReturn(Optional.of(reader));
		when(access.requireActiveMember("workspace", 4, false)).thenReturn(member(4, "MEMBER", "다른 멤버"));

		assertThatThrownBy(() -> service.updateMessage("workspace", message.id(), 4, new WorkspaceFeedService.MessageRequest("수정", null)))
			.isInstanceOf(WorkspaceException.class)
			.extracting("code").isEqualTo("MESSAGE_EDIT_FORBIDDEN");
	}

	private static UserAccountEntity account(long id, String username, String name) {
		return UserAccountEntity.create(new GitLabUser(id, username, name, null, null), Instant.now());
	}

	private static StudyMember member(long id, String role, String name) {
		return new StudyMember("member-" + id, id, "user-" + id, name, name.substring(0, 1), "#6750a4", name + ".md", role, "ACTIVE", 30);
	}
}
