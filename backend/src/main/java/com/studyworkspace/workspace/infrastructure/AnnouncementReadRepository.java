package com.studyworkspace.workspace.infrastructure;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AnnouncementReadRepository extends JpaRepository<AnnouncementReadEntity, AnnouncementReadEntity.AnnouncementReadId> { }
