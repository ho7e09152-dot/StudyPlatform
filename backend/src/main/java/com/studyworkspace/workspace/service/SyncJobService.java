package com.studyworkspace.workspace.service;

import java.util.List;

import com.studyworkspace.workspace.infrastructure.SyncJobEntity;
import com.studyworkspace.workspace.infrastructure.SyncJobRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SyncJobService {
	private final SyncJobRepository repository;

	public SyncJobService(SyncJobRepository repository) {
		this.repository = repository;
	}

	@Transactional
	public String start(String workspaceId, String type) {
		return repository.save(SyncJobEntity.start(workspaceId, type)).id();
	}

	@Transactional
	public void complete(String id, boolean partial) {
		repository.findById(id).ifPresent(job -> job.complete(partial));
	}

	@Transactional
	public void fail(String id, String code, String message) {
		repository.findById(id).ifPresent(job -> job.fail(code, message));
	}

	@Transactional(readOnly = true)
	public List<SyncJobView> list(String workspaceId) {
		return repository.findTop20ByWorkspaceIdOrderByStartedAtDesc(workspaceId).stream().map(SyncJobView::from).toList();
	}

	public record SyncJobView(
		String id, String status, String jobType, String errorCode, String errorMessage,
		java.time.Instant startedAt, java.time.Instant completedAt
	) {
		static SyncJobView from(SyncJobEntity job) {
			return new SyncJobView(job.id(), job.status(), job.jobType(), job.errorCode(), job.errorMessage(), job.startedAt(), job.completedAt());
		}
	}
}
