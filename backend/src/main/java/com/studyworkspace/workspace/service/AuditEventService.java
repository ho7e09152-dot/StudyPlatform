package com.studyworkspace.workspace.service;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import com.studyworkspace.auth.persistence.UserAccountRepository;
import com.studyworkspace.gitlab.dto.GitLabUser;
import com.studyworkspace.workspace.infrastructure.AuditEventEntity;
import com.studyworkspace.workspace.infrastructure.AuditEventRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class AuditEventService {
	private static final Logger log = LoggerFactory.getLogger(AuditEventService.class);
	private final AuditEventRepository repository;
	private final UserAccountRepository userRepository;
	private final ObjectMapper objectMapper;

	public AuditEventService(AuditEventRepository repository, UserAccountRepository userRepository, ObjectMapper objectMapper) {
		this.repository = repository;
		this.userRepository = userRepository;
		this.objectMapper = objectMapper;
	}

	public void record(String workspaceId, GitLabUser actor, String eventType, String targetType, String targetId, Map<String, ?> details) {
		try {
			String actorId = actor == null ? null : userRepository.findByGitLabUserId(actor.id()).map(account -> account.id()).orElse(null);
			Map<String, ?> safeDetails = details == null ? Map.of() : details;
			repository.saveAndFlush(AuditEventEntity.create(workspaceId, actorId, eventType, targetType, targetId, objectMapper.writeValueAsString(safeDetails)));
		} catch (Exception exception) {
			log.error("Audit event persistence failed: workspaceId={}, eventType={}", workspaceId, eventType, exception);
		}
	}

	@Transactional(readOnly = true)
	public List<AuditEventView> list(String workspaceId) {
		return repository.findTop100ByWorkspaceIdOrderByCreatedAtDesc(workspaceId).stream().map(AuditEventView::from).toList();
	}

	public record AuditEventView(String id, String eventType, String targetType, String targetId, String detailsJson, Instant createdAt) {
		static AuditEventView from(AuditEventEntity event) {
			return new AuditEventView(event.id(), event.eventType(), event.targetType(), event.targetId(), event.detailsJson(), event.createdAt());
		}
	}
}
