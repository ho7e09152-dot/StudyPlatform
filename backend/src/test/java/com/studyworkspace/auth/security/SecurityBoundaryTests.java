package com.studyworkspace.auth.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;

import java.nio.charset.StandardCharsets;
import java.io.ObjectStreamClass;
import java.time.Instant;
import java.util.Base64;

import com.studyworkspace.auth.dto.GitLabOAuthSession;
import com.studyworkspace.auth.service.GitLabOAuthTokenProvider;
import com.studyworkspace.gitlab.dto.GitLabUser;
import com.studyworkspace.workspace.security.WorkspaceRepositoryAccessVerifier;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.session.Session;
import org.springframework.session.SessionRepository;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.when;

@SpringBootTest(properties = "app.demo.persistence-path=build/test-data/security-boundary-workspaces.json")
@AutoConfigureMockMvc
class SecurityBoundaryTests {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private SessionRepository<?> sessionRepository;

	@MockitoBean
	private GitLabOAuthTokenProvider tokenProvider;

	@MockitoBean
	private WorkspaceRepositoryAccessVerifier repositoryAccessVerifier;

	@BeforeEach
	void providerAccess() {
		GitLabUser user = new GitLabUser(101, "gitlab-user-a", "GitLab User A", null, "https://gitlab.example/gitlab-user-a");
		when(tokenProvider.requireValidSession(any())).thenReturn(new GitLabOAuthSession(
			user, "access-token", "refresh-token", Instant.now().plusSeconds(3600), "api"
		));
		when(repositoryAccessVerifier.verifyAtLogin(anyList(), any())).thenAnswer(invocation -> invocation.getArgument(0));
	}

	@Test
	void unauthenticatedWorkspaceRequestReturnsJson401() throws Exception {
		mockMvc.perform(get("/api/v1/workspaces"))
			.andExpect(status().isUnauthorized())
			.andExpect(content().contentType("application/json;charset=UTF-8"))
			.andExpect(content().string(org.hamcrest.Matchers.containsString("Study-ing 로그인이 필요합니다.")))
			.andExpect(header().exists("X-Request-ID"))
			.andExpect(header().string("X-Content-Type-Options", "nosniff"))
			.andExpect(header().string("X-Frame-Options", "DENY"))
			.andExpect(jsonPath("$.code").value("AUTH_REQUIRED"));
	}

	@Test
	void unauthenticatedSessionProbeReturnsAQuietPublicState() throws Exception {
		mockMvc.perform(get("/api/v1/auth/me"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.authenticated").value(false));
	}

	@Test
	void sessionIdentityUsesStableSerializationVersions() {
		assertThat(ObjectStreamClass.lookup(GitLabUser.class).getSerialVersionUID()).isZero();
		assertThat(ObjectStreamClass.lookup(StudyIngPrincipal.class).getSerialVersionUID()).isEqualTo(1L);
	}

	@Test
	void unauthenticatedProviderLinkStartIsRejected() throws Exception {
		mockMvc.perform(get("/api/v1/provider-accounts/github/link"))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("AUTH_REQUIRED"));
	}

	@Test
	void authenticatedUserOnlyListsTheirWorkspaces() throws Exception {
		mockMvc.perform(get("/api/v1/workspaces").with(oauthUser(101, "gitlab-user-a")))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.length()").value(2))
			.andExpect(jsonPath("$[*].id").value(containsInAnyOrder("workspace-evening", "workspace-reading")));
	}

	@Test
	void gitLabUserSessionAuthenticatesWithoutPersistingADuplicateSecurityContext() throws Exception {
		SessionRepository<Session> sessions = sessions();
		Session session = sessions.createSession();
		GitLabUser user = new GitLabUser(
			101, "gitlab-user-a", "GitLab User A", null, "https://gitlab.example/gitlab-user-a"
		);
		session.setAttribute(AuthSessionAttributes.GITLAB_USER, user);
		sessions.save(session);
		String cookieValue = Base64.getEncoder().encodeToString(
			session.getId().getBytes(StandardCharsets.UTF_8)
		);

		mockMvc.perform(get("/api/v1/workspaces").cookie(new Cookie("SESSION", cookieValue)))
			.andExpect(status().isOk());

		Session persisted = sessions.findById(session.getId());
		assertThat(persisted).isNotNull();
		Object securityContext = persisted.getAttribute(
			HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY
		);
		assertThat(securityContext).isNull();
	}

	@Test
	void nonMemberCannotReadWorkspace() throws Exception {
		mockMvc.perform(get("/api/v1/workspaces/workspace-evening").with(oauthUser(999, "outsider")))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("WORKSPACE_ACCESS_DENIED"));
	}

	@Test
	void stateChangingRequestRequiresCsrfToken() throws Exception {
		mockMvc.perform(post("/api/v1/auth/logout").with(oauthUser(101, "gitlab-user-a")))
			.andExpect(status().isForbidden());

		mockMvc.perform(post("/api/v1/auth/logout")
				.with(oauthUser(101, "gitlab-user-a"))
				.with(csrf()))
			.andExpect(status().isNoContent());
	}

	private static org.springframework.test.web.servlet.request.RequestPostProcessor oauthUser(long userId, String username) {
		GitLabUser user = new GitLabUser(userId, username, username, null, "https://gitlab.example/" + username);
		return authentication(new GitLabAuthenticationToken(user));
	}

	@SuppressWarnings({"rawtypes", "unchecked"})
	private SessionRepository<Session> sessions() {
		return (SessionRepository) sessionRepository;
	}
}
