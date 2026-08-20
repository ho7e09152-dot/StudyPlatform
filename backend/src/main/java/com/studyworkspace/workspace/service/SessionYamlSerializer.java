package com.studyworkspace.workspace.service;

import static com.studyworkspace.workspace.domain.WorkspaceModels.SessionItem;
import static com.studyworkspace.workspace.domain.WorkspaceModels.StudySession;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

@Component
public class SessionYamlSerializer {

	private final ObjectMapper objectMapper;

	public SessionYamlSerializer(ObjectMapper objectMapper) {
		this.objectMapper = objectMapper;
	}

	public String serialize(StudySession session) {
		StringBuilder yaml = new StringBuilder()
			.append("version: 1\n")
			.append("revision: ").append(session.revision()).append('\n')
			.append("date: ").append(quoted(session.date())).append('\n')
			.append("type: ").append(quoted(session.type())).append('\n')
			.append("title: ").append(quoted(session.title())).append('\n')
			.append("description: ").append(quoted(session.description())).append('\n')
			.append("status: ").append(quoted(session.status())).append('\n')
			.append("deadline: ").append(quoted(session.deadline())).append('\n');
		if (session.secondaryDeadline() != null) {
			yaml.append("secondaryDeadline: ").append(quoted(session.secondaryDeadline())).append('\n');
		}
		yaml.append("createdAt: ").append(quoted(session.createdAt())).append('\n')
			.append("createdBy:\n  username: ").append(quoted(session.createdBy())).append('\n')
			.append("updatedAt: ").append(quoted(session.updatedAt())).append('\n')
			.append("updatedBy:\n  username: ").append(quoted(session.updatedBy())).append('\n');
		if (session.change() != null) {
			yaml.append("change:\n")
				.append("  changed: ").append(session.change().changed()).append('\n')
				.append("  message: ").append(quoted(session.change().message())).append('\n')
				.append("  reason: ").append(quoted(session.change().reason())).append('\n');
		}
		appendItems(yaml, "items", session.items());
		if (!session.archivedItems().isEmpty()) {
			appendItems(yaml, "archivedItems", session.archivedItems());
		}
		return yaml.toString();
	}

	private void appendItems(StringBuilder yaml, String field, java.util.List<SessionItem> items) {
		yaml.append(field).append(":\n");
		for (SessionItem item : items) {
			yaml.append("  - id: ").append(quoted(item.id())).append('\n')
				.append("    order: ").append(item.order()).append('\n')
				.append("    title: ").append(quoted(item.title())).append('\n')
				.append("    kind: ").append(quoted(item.kind())).append('\n')
				.append("    type: ").append(quoted(item.type())).append('\n');
			appendOptional(yaml, "description", item.description());
			appendOptional(yaml, "source", item.source());
			appendOptional(yaml, "url", item.url());
			yaml.append("    submitType: ").append(quoted(item.submitType())).append('\n')
				.append("    required: ").append(item.required()).append('\n')
				.append("    status: ").append(quoted(item.status())).append('\n');
			appendOptional(yaml, "deadline", item.deadline());
			appendOptional(yaml, "secondaryDeadline", item.secondaryDeadline());
			appendOptional(yaml, "startTime", item.startTime());
			appendOptional(yaml, "endTime", item.endTime());
			appendOptional(yaml, "replaces", item.replaces());
			appendOptional(yaml, "replacedBy", item.replacedBy());
		}
	}

	private void appendOptional(StringBuilder yaml, String field, String value) {
		if (value != null && !value.isBlank()) {
			yaml.append("    ").append(field).append(": ").append(quoted(value)).append('\n');
		}
	}

	private String quoted(String value) {
		try {
			return objectMapper.writeValueAsString(value == null ? "" : value);
		} catch (JacksonException exception) {
			throw new IllegalStateException("session.yml 문자열을 직렬화하지 못했습니다.", exception);
		}
	}
}
