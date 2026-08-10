"use client";

import { useEffect, useState, type FormEvent } from "react";
import { GitCommitHorizontal, MessageCircle, RefreshCw, Send } from "lucide-react";
import {
  createSubmissionReview,
  getSubmissionReviews,
  type SubmissionReviewThread,
} from "@/lib/api/services/workspaceApi";
import { formatDateTime } from "@/lib/domain/format";
import { useAuth } from "@/components/providers/AuthProvider";

export function SubmissionReviewPanel({
  workspaceId,
  date,
  memberId,
  currentGitLabUserId,
  currentUserName,
  memberName,
  filePath,
  commitId,
}: {
  workspaceId: string;
  date: string;
  memberId: string;
  currentGitLabUserId: number;
  currentUserName: string;
  memberName: string;
  filePath: string;
  commitId: string;
}) {
  const { mode } = useAuth();
  const demoMode = mode === "demo";
  const [thread, setThread] = useState<SubmissionReviewThread | null>(() => demoMode ? {
    memberId,
    memberName,
    filePath,
    commitId,
    comments: [],
  } : null);
  const [loading, setLoading] = useState(!demoMode);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    if (demoMode) return;
    const controller = new AbortController();
    void getSubmissionReviews(workspaceId, date, memberId, controller.signal)
      .then(setThread)
      .catch((requestError) => {
        if (controller.signal.aborted) return;
        setError(requestError instanceof Error ? requestError.message : "리뷰를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [date, demoMode, memberId, workspaceId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = body.trim();
    if (!normalized || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      if (demoMode) {
        setThread((current) => current ? {
          ...current,
          comments: [...current.comments, {
            id: `demo-${Date.now()}`,
            body: normalized,
            authorGitLabUserId: currentGitLabUserId,
            authorUsername: "demo-user",
            authorName: currentUserName,
            createdAt: new Date().toISOString(),
          }],
        } : current);
        setBody("");
        return;
      }
      const updated = await createSubmissionReview(workspaceId, date, memberId, normalized);
      setThread(updated);
      setBody("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "리뷰를 등록하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="submission-review" aria-labelledby={`review-title-${memberId}`}>
      <header className="submission-review__header">
        <span className="submission-review__icon"><MessageCircle size={17} /></span>
        <div>
          <h3 id={`review-title-${memberId}`}>팀 리뷰</h3>
          <p>이 제출의 현재 GitLab 커밋에 댓글로 남습니다.</p>
        </div>
        {thread ? (
          <span className="submission-review__commit">
            <GitCommitHorizontal size={13} /> {thread.commitId.slice(0, 8)}
          </span>
        ) : null}
      </header>

      {loading ? (
        <div className="submission-review__state">리뷰를 불러오는 중…</div>
      ) : thread ? (
        <div className="submission-review__comments" aria-live="polite">
          {thread.comments.length ? thread.comments.map((comment) => (
            <article key={comment.id} className="review-comment">
              <span
                className={`review-comment__avatar ${comment.authorAvatarUrl ? "has-image" : ""}`}
                style={comment.authorAvatarUrl ? { backgroundImage: `url(${comment.authorAvatarUrl})` } : undefined}
                aria-hidden="true"
              >
                {comment.authorAvatarUrl ? "" : (comment.authorName || comment.authorUsername || "?").slice(0, 1)}
              </span>
              <div>
                <header>
                  <strong>{comment.authorName || comment.authorUsername}</strong>
                  {comment.authorGitLabUserId === currentGitLabUserId ? <em>나</em> : null}
                  <span>{comment.createdAt ? formatDateTime(comment.createdAt) : "방금"}</span>
                </header>
                <p>{comment.body}</p>
              </div>
            </article>
          )) : (
            <div className="submission-review__empty">
              <MessageCircle size={18} />
              <span><strong>아직 리뷰가 없습니다</strong><small>잘한 점이나 개선할 점을 첫 댓글로 남겨보세요.</small></span>
            </div>
          )}
        </div>
      ) : null}

      {error ? (
        <div className="submission-review__error" role="alert">
          <span>{error}</span>
          {!thread ? (
            <button type="button" onClick={() => window.location.reload()}><RefreshCw size={13} /> 다시 시도</button>
          ) : null}
        </div>
      ) : null}

      {thread ? (
        <form className="submission-review__form" onSubmit={submit}>
          <textarea
            value={body}
            maxLength={4000}
            rows={3}
            placeholder="풀이에서 좋았던 점이나 함께 이야기할 내용을 남겨주세요."
            aria-label="리뷰 댓글"
            onChange={(event) => setBody(event.target.value)}
          />
          <footer>
            <span>{body.length.toLocaleString("ko-KR")}/4,000</span>
            <button type="submit" className="button button--primary button--small" disabled={!body.trim() || submitting}>
              <Send size={14} /> {submitting ? "등록 중…" : "댓글 남기기"}
            </button>
          </footer>
        </form>
      ) : null}
    </section>
  );
}
