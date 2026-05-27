"use client";

import { useState } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { SignInButton } from "@clerk/nextjs";
import { Button } from "@heroui/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@annotated/backend/convex/_generated/api";
import type { Id } from "@annotated/backend/convex/_generated/dataModel";

type Thread = FunctionReturnType<typeof api.comments.listByAnnotation>;
type ThreadComment = Thread[number];
type Reply = ThreadComment["replies"][number];

function byline(author: ThreadComment["author"]): string {
  return `${author?.displayName ?? "Unknown"} @${author?.username ?? "?"}`;
}

/** Real-time comment thread + composer for an annotation (one level of replies). */
export function Comments({ annotationId }: { annotationId: string }) {
  const { isAuthenticated } = useConvexAuth();
  const id = annotationId as Id<"annotations">;
  const comments = useQuery(api.comments.listByAnnotation, { annotationId: id });

  return (
    <section className="mt-8">
      <h2 className="text-lg">Comments</h2>

      {isAuthenticated ? (
        <CommentComposer annotationId={id} placeholder="Add a comment…" submitLabel="Post" />
      ) : (
        <p className="text-muted mt-3 text-sm">
          <SignInButton mode="modal">
            <button className="underline">Sign in</button>
          </SignInButton>{" "}
          to comment.
        </p>
      )}

      <ul className="mt-5 flex flex-col gap-4">
        {comments?.length === 0 && (
          <li className="text-muted text-sm">No comments yet.</li>
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
    <li className="border-l-2 border-border pl-3">
      <p className="text-sm">
        <span className="text-muted">{byline(comment.author)}</span>
      </p>
      <p>{comment.text}</p>

      {canReply && (
        <button
          className="text-muted mt-1 text-xs underline"
          onClick={() => setReplying((v) => !v)}
        >
          {replying ? "Cancel" : "Reply"}
        </button>
      )}

      {(replying || comment.replies.length > 0) && (
        <ul className="mt-3 flex flex-col gap-3 border-l-2 border-border pl-3">
          {comment.replies.map((reply: Reply) => (
            <li key={reply._id}>
              <p className="text-sm">
                <span className="text-muted">{byline(reply.author)}</span>
              </p>
              <p>{reply.text}</p>
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
    <div className="mt-3 flex flex-col gap-2">
      <textarea
        className="min-h-20 w-full rounded border border-[color:var(--calm-hair)] bg-[color:var(--calm-panel)] p-3 text-[color:var(--calm-ink)] placeholder:text-[color:var(--calm-ink-3)]"
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div>
        <Button
          size="sm"
          isDisabled={text.trim().length === 0 || posting}
          onPress={() => void onPost()}
        >
          {posting ? "Posting…" : submitLabel}
        </Button>
      </div>
    </div>
  );
}
