package com.studyworkspace.workspace.service;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.studyworkspace.workspace.domain.RepositoryProvider;
import com.studyworkspace.workspace.domain.WorkspaceException;
import com.studyworkspace.workspace.domain.WorkspaceModels.RepositoryIdentity;
import com.studyworkspace.workspace.port.RepositoryDataPort;
import org.springframework.stereotype.Service;

/** Selects one provider adapter without leaking provider API objects into Workspace services. */
@Service
public class RepositoryDataService {
	private final Map<RepositoryProvider, RepositoryDataPort> ports;

	public RepositoryDataService(List<RepositoryDataPort> ports) {
		this.ports = ports.stream().collect(Collectors.toUnmodifiableMap(RepositoryDataPort::provider, Function.identity()));
	}

	public RepositoryDataPort require(RepositoryProvider provider) {
		RepositoryDataPort port = ports.get(provider);
		if (port == null) throw new WorkspaceException(
			"REPOSITORY_PROVIDER_UNAVAILABLE", providerName(provider) + " 저장소 기능이 아직 준비되지 않았습니다.", 503
		);
		return port;
	}

	public RepositoryDataPort require(RepositoryIdentity repository) {
		if (repository == null) throw new WorkspaceException("REPOSITORY_CONNECTION_REQUIRED", "Workspace 저장소 연결이 필요합니다.", 409);
		return require(RepositoryProvider.valueOf(repository.provider()));
	}

	private static String providerName(RepositoryProvider provider) {
		return provider == RepositoryProvider.GITHUB ? "GitHub" : "GitLab";
	}
}
