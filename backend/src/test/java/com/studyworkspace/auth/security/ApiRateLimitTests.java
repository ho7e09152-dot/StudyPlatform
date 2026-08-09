package com.studyworkspace.auth.security;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = {
	"app.security.rate-limit.read-per-minute=2",
	"app.security.rate-limit.write-per-minute=2",
	"app.demo.seed-enabled=false"
})
@AutoConfigureMockMvc
class ApiRateLimitTests {
	@Autowired
	MockMvc mockMvc;

	@Test
	void returnsJson429AndRetryAfterWhenClientExceedsLimit() throws Exception {
		mockMvc.perform(get("/api/v1/workspaces")).andExpect(status().isUnauthorized());
		mockMvc.perform(get("/api/v1/workspaces")).andExpect(status().isUnauthorized());
		mockMvc.perform(get("/api/v1/workspaces"))
			.andExpect(status().isTooManyRequests())
			.andExpect(header().string("Retry-After", "60"))
			.andExpect(jsonPath("$.code").value("RATE_LIMITED"));
	}
}
