package com.studyworkspace.gitlab.service;

import java.util.Arrays;

import com.studyworkspace.common.exception.InvalidRepositoryPathException;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class RepositoryPathPolicy {

	private static final int MAX_PATH_LENGTH = 512;

	public String validate(String path) {
		if (!StringUtils.hasText(path)) {
			throw new InvalidRepositoryPathException("조회할 파일 경로가 필요합니다.");
		}

		String normalized = path.trim();
		boolean hasInvalidSegment = Arrays.stream(normalized.split("/"))
			.anyMatch(segment -> segment.isBlank() || segment.equals(".") || segment.equals(".."));
		boolean hasControlCharacter = normalized.chars().anyMatch(Character::isISOControl);

		if (
			normalized.length() > MAX_PATH_LENGTH
				|| normalized.startsWith("/")
				|| normalized.endsWith("/")
				|| normalized.contains("\\")
				|| hasInvalidSegment
				|| hasControlCharacter
		) {
			throw new InvalidRepositoryPathException("허용되지 않는 저장소 파일 경로입니다.");
		}

		return normalized;
	}
}
