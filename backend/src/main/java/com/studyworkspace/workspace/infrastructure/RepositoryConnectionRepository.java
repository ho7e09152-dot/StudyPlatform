package com.studyworkspace.workspace.infrastructure;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface RepositoryConnectionRepository extends JpaRepository<RepositoryConnectionEntity, String> {
	boolean existsByProviderAndExternalRepositoryId(String provider, String externalRepositoryId);
	Optional<RepositoryConnectionEntity> findByProviderAndExternalRepositoryId(String provider, String externalRepositoryId);
}
