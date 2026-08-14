package com.studyworkspace.auth.config;

import com.studyworkspace.auth.security.GitLabSessionAuthenticationFilter;
import com.studyworkspace.common.api.ApiErrorResponse;
import com.studyworkspace.common.security.ApiRateLimitFilter;
import jakarta.servlet.http.HttpServletResponse;
import java.nio.charset.StandardCharsets;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AnonymousAuthenticationFilter;
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;
import org.springframework.security.web.context.RequestAttributeSecurityContextRepository;
import tools.jackson.databind.ObjectMapper;

@Configuration
public class SecurityConfig {

	@Bean
	SecurityFilterChain securityFilterChain(
		HttpSecurity http,
		GitLabSessionAuthenticationFilter gitLabSessionAuthenticationFilter,
		ApiRateLimitFilter apiRateLimitFilter,
		ObjectMapper objectMapper
	) throws Exception {
		HttpSessionCsrfTokenRepository csrfRepository = new HttpSessionCsrfTokenRepository();
		csrfRepository.setHeaderName("X-CSRF-TOKEN");

		http
			.cors(Customizer.withDefaults())
			.csrf(csrf -> csrf.csrfTokenRepository(csrfRepository))
			.securityContext(context -> context
				.requireExplicitSave(true)
				.securityContextRepository(new RequestAttributeSecurityContextRepository()))
			.sessionManagement(session -> session
				.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED)
				.sessionFixation(fixation -> fixation.none()))
			.authorizeHttpRequests(authorize -> authorize
				.requestMatchers(
					"/api/v1/auth/gitlab/**",
					"/api/v1/auth/github/**",
					"/api/v1/auth/me",
					"/api/v1/auth/profile",
					"/api/v1/provider-accounts/github/callback",
					"/api/v1/auth/csrf",
					"/api/v1/capabilities",
					"/actuator/health/**",
					"/actuator/info"
				).permitAll()
				.anyRequest().authenticated()
			)
			.exceptionHandling(exceptions -> exceptions
				.authenticationEntryPoint((request, response, exception) -> {
					response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
					response.setCharacterEncoding(StandardCharsets.UTF_8.name());
					response.setContentType(MediaType.APPLICATION_JSON_VALUE);
					objectMapper.writeValue(response.getOutputStream(), ApiErrorResponse.of(
						"AUTH_REQUIRED", "Study-ing 로그인이 필요합니다."
					));
				})
				.accessDeniedHandler((request, response, exception) -> {
					response.setStatus(HttpServletResponse.SC_FORBIDDEN);
					response.setCharacterEncoding(StandardCharsets.UTF_8.name());
					response.setContentType(MediaType.APPLICATION_JSON_VALUE);
					objectMapper.writeValue(response.getOutputStream(), ApiErrorResponse.of(
						"ACCESS_DENIED", "요청을 수행할 권한이 없습니다."
					));
				})
			)
			.addFilterBefore(gitLabSessionAuthenticationFilter, AnonymousAuthenticationFilter.class);

		http.addFilterAfter(apiRateLimitFilter, GitLabSessionAuthenticationFilter.class);

		return http.build();
	}
}
