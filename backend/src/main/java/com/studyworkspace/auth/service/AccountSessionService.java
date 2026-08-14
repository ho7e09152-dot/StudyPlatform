package com.studyworkspace.auth.service;

import java.util.Map;

import jakarta.servlet.http.HttpSession;
import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.session.Session;
import org.springframework.stereotype.Service;

@Service
public class AccountSessionService {
	private final FindByIndexNameSessionRepository<? extends Session> repository;

	public AccountSessionService(FindByIndexNameSessionRepository<? extends Session> repository) {
		this.repository = repository;
	}

	public void register(HttpSession session, String userId) {
		session.setAttribute(FindByIndexNameSessionRepository.PRINCIPAL_NAME_INDEX_NAME, principal(userId));
	}

	public void clear(HttpSession session) {
		session.removeAttribute(FindByIndexNameSessionRepository.PRINCIPAL_NAME_INDEX_NAME);
	}

	public void deleteAll(String userId) {
		Map<String, ? extends Session> sessions = repository.findByPrincipalName(principal(userId));
		sessions.keySet().forEach(repository::deleteById);
	}

	/** @deprecated only for pre-migration callers. */
	@Deprecated
	public void register(HttpSession session, long gitLabUserId) {
		session.setAttribute(FindByIndexNameSessionRepository.PRINCIPAL_NAME_INDEX_NAME, "gitlab:" + gitLabUserId);
	}

	/** @deprecated only for pre-migration callers. */
	@Deprecated
	public void deleteAll(long gitLabUserId) {
		Map<String, ? extends Session> sessions = repository.findByPrincipalName("gitlab:" + gitLabUserId);
		sessions.keySet().forEach(repository::deleteById);
	}

	private static String principal(String userId) {
		return "study-ing:" + userId;
	}
}
