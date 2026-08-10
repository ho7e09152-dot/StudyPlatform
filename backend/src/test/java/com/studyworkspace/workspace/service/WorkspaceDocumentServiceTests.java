package com.studyworkspace.workspace.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Optional;

import com.studyworkspace.auth.persistence.UserAccountEntity;
import com.studyworkspace.auth.persistence.UserAccountRepository;
import com.studyworkspace.gitlab.dto.GitLabUser;
import com.studyworkspace.workspace.domain.WorkspaceException;
import com.studyworkspace.workspace.domain.WorkspaceModels.StudyMember;
import com.studyworkspace.workspace.infrastructure.WorkspaceDocumentEntity;
import com.studyworkspace.workspace.infrastructure.WorkspaceDocumentRepository;
import com.studyworkspace.workspace.security.WorkspaceAccessService;
import org.junit.jupiter.api.Test;

class WorkspaceDocumentServiceTests {
	private final WorkspaceDocumentRepository documents = mock(WorkspaceDocumentRepository.class);
	private final UserAccountRepository users = mock(UserAccountRepository.class);
	private final WorkspaceAccessService access = mock(WorkspaceAccessService.class);
	private final WorkspaceDocumentService service = new WorkspaceDocumentService(documents, users, access);

	@Test
	void activeMemberCanCreateAMarkdownDocument() {
		UserAccountEntity account = account(1, "author", "작성자");
		when(users.findByGitLabUserId(1)).thenReturn(Optional.of(account));
		when(access.requireActiveMember("workspace", 1, false)).thenReturn(member(1, "작성자"));
		when(documents.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

		var created = service.create("workspace", 1, new WorkspaceDocumentService.DocumentMutation("  운영체제 정리  ", "# 스케줄링\n\n- FCFS", null));

		assertThat(created.title()).isEqualTo("운영체제 정리");
		assertThat(created.bodyMarkdown()).contains("# 스케줄링");
		assertThat(created.canEdit()).isTrue();
	}

	@Test
	void anotherMemberCanReadButCannotEditTheDocument() {
		UserAccountEntity author = account(1, "author", "작성자");
		UserAccountEntity reader = account(2, "reader", "독자");
		WorkspaceDocumentEntity document = WorkspaceDocumentEntity.create("workspace", author.id(), "작성자", "문서", "내용");
		when(documents.findById(document.id())).thenReturn(Optional.of(document));
		when(users.findByGitLabUserId(2)).thenReturn(Optional.of(reader));
		when(access.requireActiveMember("workspace", 2, false)).thenReturn(member(2, "독자"));

		assertThat(service.get("workspace", document.id(), 2).canEdit()).isFalse();
		assertThatThrownBy(() -> service.update("workspace", document.id(), 2, new WorkspaceDocumentService.DocumentMutation("수정", "수정", 0)))
			.isInstanceOf(WorkspaceException.class)
			.extracting("code").isEqualTo("DOCUMENT_EDIT_FORBIDDEN");
	}

	@Test
	void staleVersionCannotOverwriteTheDocument() {
		UserAccountEntity author = account(1, "author", "작성자");
		WorkspaceDocumentEntity document = WorkspaceDocumentEntity.create("workspace", author.id(), "작성자", "문서", "내용");
		when(documents.findById(document.id())).thenReturn(Optional.of(document));
		when(users.findByGitLabUserId(1)).thenReturn(Optional.of(author));
		when(access.requireActiveMember("workspace", 1, false)).thenReturn(member(1, "작성자"));

		assertThatThrownBy(() -> service.update("workspace", document.id(), 1, new WorkspaceDocumentService.DocumentMutation("수정", "수정", 3)))
			.isInstanceOf(WorkspaceException.class)
			.extracting("code").isEqualTo("DOCUMENT_VERSION_CONFLICT");
	}

	private static UserAccountEntity account(long id, String username, String name) {
		return UserAccountEntity.create(new GitLabUser(id, username, name, null, null), Instant.now());
	}

	private static StudyMember member(long id, String name) {
		return new StudyMember("member-" + id, id, "user-" + id, name, name.substring(0, 1), "#6750a4", name + ".md", "MEMBER", "ACTIVE", 30);
	}
}
