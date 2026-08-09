package com.studyworkspace.common.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import com.studyworkspace.workspace.security.WorkspaceAccessInterceptor;

@Configuration
public class WebConfig implements WebMvcConfigurer {

	private final CorsProperties corsProperties;
	private final WorkspaceAccessInterceptor workspaceAccessInterceptor;

	public WebConfig(CorsProperties corsProperties, WorkspaceAccessInterceptor workspaceAccessInterceptor) {
		this.corsProperties = corsProperties;
		this.workspaceAccessInterceptor = workspaceAccessInterceptor;
	}

	@Override
	public void addCorsMappings(CorsRegistry registry) {
		registry.addMapping("/api/**")
			.allowedOrigins(corsProperties.allowedOrigins().toArray(String[]::new))
			.allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
			.allowedHeaders("Accept", "Content-Type", "X-CSRF-TOKEN")
			.allowCredentials(true)
			.maxAge(3600);
	}

	@Override
	public void addInterceptors(InterceptorRegistry registry) {
		registry.addInterceptor(workspaceAccessInterceptor)
			.addPathPatterns("/api/v1/workspaces/**");
	}
}
