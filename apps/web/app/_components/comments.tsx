"use client";

import { useState } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { SignInButton } from "@clerk/nextjs";
import type { FunctionReturnType } from "convex/server";
import { api } from "@annotated/backend/convex/_generated/api";
import type { Id } from "@annotated/backend/convex/_generated/dataModel";

type Thread = FunctionReturnType<typeof api.comments.listByAnnotation>;
type ThreadComment = Thread[number];
type Reply = ThreadComment["replies"][number];

function byline(author: ThreadComment["author"]): string {
  return `${author?.displayName ?? "Unknown"} @${author?.username ?? "?"}`;
}

const bylineCls = "font-mono text-[13px] text-[color:var(--b-dim-onbg)]";

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

      <ul className="mt-6 flex flex-col gap-5">
        {comments?.length === 0 && (
          <li className="text-sm text-[color:var(--b-dim-onbg)]">No comments yet — start the thread.</li>
        )}
        {comments?.map((comment) => (
          <CommentItem
            key={comment._id}
            annotationId={id}
            comment={comment}
            canReply={isAuthenticated}
          />
        ))}
      </ul>
    </section>
  );
}

function CommentItem({
  annotationId,
  comment,
  canReply,
}: {
  annotationId: Id<"annotations">;
  comment: ThreadComment;
  canReply: boolean;
}) {
  const [replying, setReplying] = useState(false);

  return (
    <li className="border-l-[5px] border-[color:var(--b-acid)] pl-4">
      <p className={bylineCls}>{byline(comment.author)}</p>
      <p className="mt-0.5 text-[15px] leading-relaxed">{comment.text}</p>

      {canReply && (
        <button
          className="mt-1 font-mono text-xs font-bold uppercase tracking-wide text-[color:var(--b-dim-onbg)] underline decoration-[color:var(--b-acid)] decoration-2 underline-offset-2"
          onClick={() => setReplying((v) => !v)}
        >
          {replying ? "Cancel" : "Reply"}
        </button>
      )}

      {(replying || comment.replies.length > 0) && (
        <ul className="mt-3 flex flex-col gap-3 border-l-[5px] border-[color:var(--b-line)] pl-4">
          {comment.replies.map((reply: Reply) => (
            <li key={reply._id}>
              <p className={bylineCls}>{byline(reply.author)}</p>
              <p className="mt-0.5 text-[15px] leading-relaxed">{reply.text}</p>
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
