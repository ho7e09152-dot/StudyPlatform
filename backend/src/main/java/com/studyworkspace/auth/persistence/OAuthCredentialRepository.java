package com.studyworkspace.auth.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

public interface OAuthCredentialRepository extends JpaRepository<OAuthCredentialEntity, String> {
}
