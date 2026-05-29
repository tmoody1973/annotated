"use client";

import { useState } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { SignInButton } from "@clerk/nextjs";
import type { FunctionReturnType } from "convex/server";
import { formatRelativeTime } from "@annotated/shared";
import { api } from "@annotated/backend/convex/_generated/api";
import type { Id } from "@annotated/backend/convex/_generated/dataModel";
import { AuthorAvatar } from "./author-avatar";

type Thread = FunctionReturnType<typeof api.comments.listByAnnotation>;
type ThreadComment = Thread[number];
type Reply = ThreadComment["replies"][number];
type AnyComment = ThreadComment | Reply;

/** Real-time comment thread + composer for an annotation (one level of replies). */
export function Comments({ annotationId }: { annotationId: string }) {
  const { isAuthenticated } = useConvexAuth();
  const id = annotationId as Id<"annotations">;
  const comments = useQuery(api.comments.listByAnnotation, { annotationId: id });

  return (
    <section className="mt-10">
      <h2 className="inline-block border-b-[4px] border-[color:var(--b-acid)] pb-1 font-display text-2xl tracking-tight">
        Comments
      </h2>

      {isAuthenticated ? (
        <CommentComposer annotationId={id} placeholder="Add a comment…" submitLabel="Post" />
      ) : (
        <p className="mt-4 text-sm text-[color:var(--b-dim-onbg)]">
          <SignInButton mode="modal">
            <button className="font-bold text-[color:var(--b-onbg)] underline decoration-[color:var(--b-acid)] decoration-2 underline-offset-2">
              Sign in
            </button>
          </SignInButton>{" "}
          to comment.
        </p>
      )}

      <ul className="mt-6 flex flex-col gap-4">
        {comments?.length === 0 && (
          <li className="text-sm text-[color:var(--b-dim-onbg)]">No comments yet — start the thread.</li>
        )}
        {comments?.map((comment) => (
          <CommentItem
            key={comment._id}
            annotationId={id}
            comment={comment}
            canInteract={isAuthenticated}
          />
        ))}
      </ul>
    </section>
  );
}

function CommentItem({
  annotationId,
  comment,
  canInteract,
}: {
  annotationId: Id<"annotations">;
  comment: ThreadComment;
  canInteract: boolean;
}) {
  const [replying, setReplying] = useState(false);

  return (
    <li className="border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-card)] p-3 text-[color:var(--b-ink)] shadow-[4px_4px_0_0_var(--b-shadow)]">
      <CommentRow
        comment={comment}
        canInteract={canInteract}
        avatarSize={36}
        extraAction={
          canInteract ? (
            <button
              className="font-mono text-[11px] font-bold uppercase tracking-wide text-[color:var(--b-dim)] hover:text-[color:var(--b-ink)]"
              onClick={() => setReplying((v) => !v)}
            >
              {replying ? "Cancel" : "Reply"}
            </button>
          ) : null
        }
      />

      {(replying || comment.replies.length > 0) && (
        <ul className="mt-3 flex flex-col gap-3 border-l-[3px] border-[color:var(--b-line)] pl-3">
          {comment.replies.map((reply) => (
            <li key={reply._id}>
              <CommentRow comment={reply} canInteract={canInteract} avatarSize={28} />
            </li>
          ))}
          {replying && (
            <li>
              <CommentComposer
                annotationId={annotationId}
                parentId={comment._id}
                placeholder="Write a reply…"
                submitLabel="Reply"
                onPosted={() => setReplying(false)}
              />
            </li>
          )}
        </ul>
      )}
    </li>
  );
}

/** One comment or reply: avatar, byline (name · @user · relative date), text,
 *  and an action row (Like + an optional extra action like Reply). */
function CommentRow({
  comment,
  canInteract,
  avatarSize,
  extraAction,
}: {
  comment: AnyComment;
  canInteract: boolean;
  avatarSize: number;
  extraAction?: React.ReactNode;
}) {
  const name = comment.author?.displayName ?? "Unknown";
  return (
    <div className="flex gap-3">
      <AuthorAvatar displayName={name} avatarUrl={comment.author?.avatarUrl} size={avatarSize} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2 leading-tight">
          <span className="text-[14px] font-extrabold">{name}</span>
          <span className="font-mono text-[12px] text-[color:var(--b-dim)]">
            @{comment.author?.username ?? "?"}
          </span>
          <span className="font-mono text-[11px] text-[color:var(--b-dim)]">
            · {formatRelativeTime(comment.createdAt)}
          </span>
        </p>
        <p className="mt-1 text-[15px] leading-relaxed">{comment.text}</p>
        <div className="mt-1.5 flex items-center gap-4">
          <CommentLikeButton
            commentId={comment._id}
            likeCount={comment.likeCount}
            liked={comment.viewerHasLiked}
            canInteract={canInteract}
          />
          {extraAction}
        </div>
      </div>
    </div>
  );
}

/** Heart + count for a single comment. Reactive: the toggle mutation re-runs the
 *  thread query, so count/state update without local optimism. Signed-out clicks
 *  open the sign-in modal instead. */
function CommentLikeButton({
  commentId,
  likeCount,
  liked,
  canInteract,
}: {
  commentId: Id<"comments">;
  likeCount: number;
  liked: boolean;
  canInteract: boolean;
}) {
  const toggle = useMutation(api.comments.toggleCommentLike);
  const [pending, setPending] = useState(false);

  const label = (
    <span
      className={`flex items-center gap-1 font-mono text-[12px] font-bold ${
        liked ? "text-[color:var(--b-ink)]" : "text-[color:var(--b-dim)]"
      }`}
    >
      <span aria-hidden>{liked ? "♥" : "♡"}</span>
      {likeCount > 0 ? likeCount : ""}
    </span>
  );

  if (!canInteract) {
    return (
      <SignInButton mode="modal">
        <button aria-label="Like (sign in)" className="hover:text-[color:var(--b-ink)]">
          {label}
        </button>
      </SignInButton>
    );
  }

  return (
    <button
      aria-label={liked ? "Unlike comment" : "Like comment"}
      aria-pressed={liked}
      disabled={pending}
      className="hover:opacity-70 disabled:opacity-50"
      onClick={async () => {
        setPending(true);
        try {
          await toggle({ commentId });
        } finally {
          setPending(false);
        }
      }}
    >
      {label}
    </button>
  );
}

function CommentComposer({
  annotationId,
  parentId,
  placeholder,
  submitLabel,
  onPosted,
}: {
  annotationId: Id<"annotations">;
  parentId?: Id<"comments">;
  placeholder: string;
  submitLabel: string;
  onPosted?: () => void;
}) {
  const add = useMutation(api.comments.add);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const disabled = text.trim().length === 0 || posting;

  const onPost = async (): Promise<void> => {
    const value = text.trim();
    if (value.length === 0 || posting) return;
    setPosting(true);
    try {
      await add({ annotationId, text: value, ...(parentId ? { parentId } : {}) });
      setText("");
      onPosted?.();
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="mt-4 flex flex-col items-start gap-3">
      <textarea
        className="min-h-20 w-full border-2 border-[color:var(--b-line)] bg-[color:var(--b-card)] p-3 text-[color:var(--b-ink)] shadow-[4px_4px_0_0_var(--b-shadow)] outline-none placeholder:text-[color:var(--b-dim)] focus:border-[color:var(--b-acid)]"
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label={placeholder}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => void onPost()}
        className="border-2 border-[color:var(--b-line)] bg-[color:var(--b-acid)] px-5 py-2 text-sm font-black uppercase tracking-wide text-[color:var(--b-acid-ink)] shadow-[4px_4px_0_0_var(--b-shadow)] transition-transform hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_var(--b-shadow)] disabled:opacity-50"
      >
        {posting ? "Posting…" : submitLabel}
      </button>
    </div>
  );
}
