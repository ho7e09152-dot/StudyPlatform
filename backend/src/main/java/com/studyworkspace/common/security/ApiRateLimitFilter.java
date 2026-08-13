package com.studyworkspace.common.security;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

import com.studyworkspace.common.api.ApiErrorResponse;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import tools.jackson.databind.ObjectMapper;

@Component
public class ApiRateLimitFilter extends OncePerRequestFilter {
	private static final long WINDOW_MILLIS = 60_000L;
	private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();
	private final AtomicLong requestCounter = new AtomicLong();
	private final ObjectMapper objectMapper;
	private final Clock clock;
	private final boolean enabled;
	private final int readLimit;
	private final int writeLimit;

	public ApiRateLimitFilter(
		ObjectMapper objectMapper,
		@Value("${app.security.rate-limit.enabled:true}") boolean enabled,
		@Value("${app.security.rate-limit.read-per-minute:240}") int readLimit,
		@Value("${app.security.rate-limit.write-per-minute:60}") int writeLimit
	) {
		this.objectMapper = objectMapper;
		this.clock = Clock.systemUTC();
		this.enabled = enabled;
		this.readLimit = readLimit;
		this.writeLimit = writeLimit;
	}

	@Override
	protected boolean shouldNotFilter(HttpServletRequest request) {
		return !enabled || !request.getRequestURI().startsWith("/api/") || "OPTIONS".equals(request.getMethod());
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
		throws ServletException, IOException {
		long now = clock.millis();
		boolean read = "GET".equals(request.getMethod()) || "HEAD".equals(request.getMethod());
		int limit = read ? readLimit : writeLimit;
		String sessionId = request.getRequestedSessionId();
		String client = sessionId == null || sessionId.isBlank() ? request.getRemoteAddr() : sessionId;
		String key = client + ':' + (read ? "read" : "write");
		Window window = windows.computeIfAbsent(key, ignored -> new Window(now));
		if (!window.tryAcquire(now, limit)) {
			response.setStatus(429);
			response.setCharacterEncoding(StandardCharsets.UTF_8.name());
			response.setContentType(MediaType.APPLICATION_JSON_VALUE);
			response.setHeader("Retry-After", "60");
			objectMapper.writeValue(response.getOutputStream(), ApiErrorResponse.of("RATE_LIMITED", "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."));
			return;
		}
		if ((requestCounter.incrementAndGet() & 1023) == 0) {
			windows.entrySet().removeIf(entry -> now - entry.getValue().startedAt() > WINDOW_MILLIS * 2);
		}
		response.setHeader("X-RateLimit-Limit", Integer.toString(limit));
		filterChain.doFilter(request, response);
	}

	private static final class Window {
		private long startedAt;
		private int count;
		private Window(long startedAt) { this.startedAt = startedAt; }
		private synchronized boolean tryAcquire(long now, int limit) {
			if (now - startedAt >= WINDOW_MILLIS) {
				startedAt = now;
				count = 0;
			}
			if (count >= limit) return false;
			count++;
			return true;
		}
		private synchronized long startedAt() { return startedAt; }
	}
}
