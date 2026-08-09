package com.studyworkspace.auth.security;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;

import com.studyworkspace.gitlab.dto.GitLabUser;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = "app.demo.persistence-path=build/test-data/security-boundary-workspaces.json")
@AutoConfigureMockMvc
class SecurityBoundaryTests {

	@Autowired
	private MockMvc mockMvc;

	@Test
	void unauthenticatedWorkspaceRequestReturnsJson401() throws Exception {
		mockMvc.perform(get("/api/v1/workspaces"))
			.andExpect(status().isUnauthorized())
			.andExpect(header().exists("X-Request-ID"))
			.andExpect(header().string("X-Content-Type-Options", "nosniff"))
			.andExpect(header().string("X-Frame-Options", "DENY"))
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
}
