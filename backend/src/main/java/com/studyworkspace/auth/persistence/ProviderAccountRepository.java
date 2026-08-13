package com.studyworkspace.auth.persistence;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProviderAccountRepository extends JpaRepository<ProviderAccountEntity, String> {
	Optional<ProviderAccountEntity> findByProviderAndExternalUserId(String provider, String externalUserId);
	Optional<ProviderAccountEntity> findByUserIdAndProvider(String userId, String provider);
	List<ProviderAccountEntity> findAllByUserIdOrderByProvider(String userId);
}
