package com.studyworkspace.workspace.service;

import static com.studyworkspace.workspace.domain.WorkspaceModels.*;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class DemoDataFactory {

	private DemoDataFactory() {
	}

	static List<WorkspaceState> create() {
		List<StudyMember> members = List.of(
			member("member-a", 101, "gitlab-user-a", "김서연", "A", "#6d52b5", 30),
			member("member-b", 102, "gitlab-user-b", "이준호", "B", "#a15169", 30),
			member("member-c", 103, "gitlab-user-c", "박민지", "C", "#3d7175", 40)
		);

		Map<String, StudySession> sessions = new LinkedHashMap<>();
		sessions.put("2026-07-21", session(
			"2026-07-21", 1, "cs", "운영체제 스케줄링 정리",
			"CPU 스케줄링 알고리즘을 비교해 정리합니다.", "2026-07-21T23:59:00+09:00",
			List.of(item("item-cpu-scheduling", 1, "스케줄링 비교표", "text"))
		));
		sessions.put("2026-07-22", session(
			"2026-07-22", 1, "free", "이번 주 회고",
			"자유 형식으로 한 주의 학습을 회고합니다.", "2026-07-22T23:59:00+09:00",
			List.of(item("item-weekly-retro", 1, "주간 회고 한 편", "text"))
		));
		List<SessionItem> algorithmItems = List.of(
			new SessionItem("item-a8f11c", 1, "행렬 테두리 회전하기", "programmers",
				"https://school.programmers.co.kr/learn/courses/30/lessons/77485", "link", true, "active", null, null),
			new SessionItem("item-b712dd", 2, "프로세스", "programmers",
				"https://school.programmers.co.kr/learn/courses/30/lessons/42587", "link", true, "active", "item-old22", null)
		);
		StudySession today = new StudySession(
			"2026-07-23", "260723", 3, "algorithm", "큐와 배열 집중 학습",
			"풀이를 작성하고 링크를 항목별로 제출합니다.", "active",
			"2026-07-23T23:59:00+09:00", "2026-07-24T23:59:00+09:00",
			"2026-07-21T20:00:00+09:00", "gitlab-user-a", "2026-07-23T00:05:00+09:00", "gitlab-user-b",
			new SessionChange(true, "두 번째 문제가 프로세스로 변경되었습니다.", "난이도 조정"),
			algorithmItems,
			List.of(new SessionItem("item-old22", 2, "삼각 달팽이", null, null, "link", true, "replaced", null, "item-b712dd")),
			"abc123e"
		);
		sessions.put(today.date(), today);
		sessions.put("2026-07-24", session(
			"2026-07-24", 1, "english", "영어 표현과 듣기",
			"표현을 정리하고 영어 영상을 시청합니다.", "2026-07-24T23:59:00+09:00",
			List.of(
				item("item-daily-phrases", 1, "오늘의 표현 10개", "text"),
				item("item-listening", 2, "영어 영상 15분 듣기", "link"),
				item("item-summary", 3, "한 문단 요약", "text")
			)
		));

		Map<String, MemberSubmissionFile> submissions = new LinkedHashMap<>();
		for (int index = 0; index < members.size(); index++) {
			StudyMember member = members.get(index);
			put(submissions, sessions.get("2026-07-21"), member, List.of(
				entry("item-cpu-scheduling", "text", List.of("FCFS·SJF·RR 비교 완료", "라운드로빈 타임퀀텀 정리", "선점·비선점 표 정리").get(index), "2026-07-21T2" + index + ":10:00+09:00")
			));
			put(submissions, sessions.get("2026-07-22"), member, List.of(
				entry("item-weekly-retro", "text", List.of("문제를 쪼개는 습관을 만들었다.", "복습 주기를 줄이기로 했다.", "작은 기록을 꾸준히 남겼다.").get(index), "2026-07-22T2" + index + ":15:00+09:00")
			));
		}
		put(submissions, today, members.get(0), List.of(
			entry("item-a8f11c", "link", "https://blog.example.com/rotation", "2026-07-23T20:10:00+09:00")
		));
		put(submissions, today, members.get(1), List.of(
			entry("item-a8f11c", "link", "https://blog.b.dev/rotate", "2026-07-23T19:40:00+09:00"),
			entry("item-b712dd", "link", "https://blog.b.dev/process", "2026-07-23T21:32:00+09:00")
		));
		put(submissions, today, members.get(2), List.of(
			entry("item-a8f11c", "link", "https://minji.log/rotation", "2026-07-23T18:20:00+09:00"),
			entry("item-b712dd", "link", "https://minji.log/process", "2026-07-23T21:50:00+09:00")
		));

		WorkspaceState evening = new WorkspaceState(
			"workspace-evening", "저녁 스터디", 48213, "study-team/evening-workspace", "main", "ACTIVE",
			"2026-07-23T21:58:00+09:00", members, sessions, submissions, settings(true)
		);

		List<StudyMember> readingMembers = members.subList(0, 2);
		StudySession readingSession = session(
			"2026-07-23", 1, "cs", "Designing Data-Intensive Applications",
			"2장 데이터 모델과 질의 언어를 읽고 핵심 문장을 정리합니다.", "2026-07-23T22:30:00+09:00",
			List.of(
				item("item-ddia-summary", 1, "2장 핵심 내용 요약", "mixed"),
				item("item-ddia-question", 2, "토론 질문 한 가지", "text")
			)
		);
		Map<String, MemberSubmissionFile> readingSubmissions = new LinkedHashMap<>();
		put(readingSubmissions, readingSession, readingMembers.get(0), List.of(
			entry("item-ddia-summary", "mixed", "## 관계형 모델\n\n데이터를 튜플의 집합으로 표현한다.", "2026-07-23T20:40:00+09:00")
		));
		WorkspaceState reading = new WorkspaceState(
			"workspace-reading", "CS 원서 읽기", 50117, "study-team/cs-book-club", "main", "ACTIVE",
			"2026-07-23T21:12:00+09:00", readingMembers, Map.of(readingSession.date(), readingSession),
			readingSubmissions, settings(false)
		);

		return List.of(evening, reading);
	}

	private static StudyMember member(String id, long gitlabId, String username, String name, String avatar, String color, int accessLevel) {
		String role = "member-a".equals(id) ? "OWNER" : accessLevel >= 40 ? "MANAGER" : "MEMBER";
		return new StudyMember(id, gitlabId, username, name, avatar, color, id + ".md", role, "ACTIVE", accessLevel);
	}

	private static SessionItem item(String id, int order, String title, String type) {
		return new SessionItem(id, order, title, null, null, type, true, "active", null, null);
	}

	private static StudySession session(String date, int revision, String type, String title, String description, String deadline, List<SessionItem> items) {
		String folder = date.substring(2).replace("-", "");
		return new StudySession(
			date, folder, revision, type, title, description, "active", deadline, null,
			date + "T09:00:00+09:00", "gitlab-user-a", date + "T09:00:00+09:00", "gitlab-user-a",
			null, items, List.of(), "demo-" + folder + "-r" + revision
		);
	}

	private static SubmissionEntry entry(String itemId, String type, String value, String timestamp) {
		return new SubmissionEntry(itemId, type, value, null, timestamp, timestamp);
	}

	private static void put(Map<String, MemberSubmissionFile> target, StudySession session, StudyMember member, List<SubmissionEntry> entries) {
		String updatedAt = entries.stream().map(SubmissionEntry::updatedAt).max(String::compareTo).orElse(session.updatedAt());
		target.put(session.folder() + "/" + member.id(), new MemberSubmissionFile(
			1, member.id(), member.gitlabUserId(), member.username(), session.folder(), session.revision(), session.type(),
			updatedAt, new ArrayList<>(entries), null, "commit-" + session.folder() + "-" + member.id(), null
		));
	}

	private static WorkspaceSettings settings(boolean syncFailures) {
		return new WorkspaceSettings("Asia/Seoul", true, new Notifications(true, true, syncFailures));
	}
}
