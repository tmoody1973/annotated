import { useState } from "react";
import { useMutation } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { getWorkerToken } from "./worker-client";

const startThreadDev = makeFunctionReference<
  "mutation",
  { annotationId: string; workerToken: string },
  string
>("testing:startThreadDev");

export interface ThreadState {
  /** The active thread id, or null when the next publish is a standalone clip. */
  threadId: string | null;
  /**
   * "Add another clip to this thread" (§1 Phase B): ensures a thread exists for
   * the just-published clip and adopts its id, so the next publish from the same
   * source appends in order. Idempotent once a thread is active.
   */
  continueThread: (annotationId: string) => Promise<void>;
  /** Clears the active thread — the next publish starts standalone again. */
  reset: () => void;
}

/**
 * Manages the "thread follow-ons" state shared by every clip composer. The first
 * clip publishes standalone; clicking "Add another clip to this thread" lazily
 * creates the thread (attaching that first clip as order 0) and remembers its id
 * so subsequent publishes from the same source thread together — the 30s-target
 * follow-on flow (no re-auth, no re-detect; the source is already resolved).
 */
export function useThread(): ThreadState {
  const startThread = useMutation(startThreadDev);
  const [threadId, setThreadId] = useState<string | null>(null);

  const continueThread = async (annotationId: string): Promise<void> => {
    const id =
      threadId ??
      (await startThread({ annotationId, workerToken: getWorkerToken() }));
    setThreadId(id);
  };

  const reset = (): void => setThreadId(null);

  return { threadId, continueThread, reset };
}
