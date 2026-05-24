"use client";

import { useState } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { SignInButton } from "@clerk/nextjs";
import { Button } from "@heroui/react";
import { api } from "@annotated/backend/convex/_generated/api";
import type { Id } from "@annotated/backend/convex/_generated/dataModel";

/** Real-time comment thread + composer for an annotation. */
export function Comments({ annotationId }: { annotationId: string }) {
  const { isAuthenticated } = useConvexAuth();
  const id = annotationId as Id<"annotations">;
  const comments = useQuery(api.comments.listByAnnotation, { annotationId: id });
  const add = useMutation(api.comments.add);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  const onPost = async (): Promise<void> => {
    const value = text.trim();
    if (value.length === 0 || posting) return;
    setPosting(true);
    try {
      await add({ annotationId: id, text: value });
      setText("");
    } finally {
      setPosting(false);
    }
  };

  return (
    <section className="mt-8">
      <h2 className="text-lg">Comments</h2>

      {isAuthenticated ? (
        <div className="mt-3 flex flex-col gap-2">
          <textarea
            className="min-h-20 w-full border border-border bg-surface p-3"
            placeholder="Add a comment…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div>
            <Button
              size="sm"
              isDisabled={text.trim().length === 0 || posting}
              onPress={() => void onPost()}
            >
              {posting ? "Posting…" : "Post"}
            </Button>
          </div>
        </div>
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
        {comments?.map((c) => (
          <li key={c._id} className="border-l-2 border-border pl-3">
            <p className="text-sm">
              <span className="text-muted">
                {c.author?.displayName ?? "Unknown"} @{c.author?.username ?? "?"}
              </span>
            </p>
            <p>{c.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
