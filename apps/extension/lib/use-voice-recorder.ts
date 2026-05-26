import { useCallback, useEffect, useRef, useState } from "react";

/** SPEC caps clips at 90s; voice commentary follows the same ceiling. */
export const MAX_RECORDING_MS = 90_000;

export type RecorderState = "idle" | "recording" | "recorded" | "denied";

export interface VoiceRecorder {
  state: RecorderState;
  blob: Blob | null;
  previewUrl: string | null;
  elapsedMs: number;
  /** How many takes have been recorded this session (he redoes 2–3×). */
  takeCount: number;
  error: string | null;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  clear: () => void;
}

const DENIED_MESSAGE =
  "Microphone access was blocked. Allow the mic on this page to record commentary.";

async function getActiveTabId(): Promise<number | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id ?? null;
}

/**
 * MediaRecorder wrapper for recorded voice commentary. The mic is captured in
 * the ACTIVE TAB's page context via `chrome.scripting.executeScript` — not in
 * the side panel — because a `chrome-extension://` panel page has no surface for
 * Chrome to show the mic permission prompt (getUserMedia silently fails there).
 * Recorder state lives on the page between start/stop; the recorded blob comes
 * back as base64. Auto-stops at the 90s cap; surfaces a permission-denied state.
 */
export function useVoiceRecorder(): VoiceRecorder {
  const [state, setState] = useState<RecorderState>("idle");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [takeCount, setTakeCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAtRef = useRef(0);
  const stopRef = useRef<() => Promise<void>>(async () => {});

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    timerRef.current = null;
    autoStopRef.current = null;
  }, []);

  const stop = useCallback(async (): Promise<void> => {
    clearTimers();
    const tabId = await getActiveTabId();
    if (tabId === null) {
      setState((s) => (s === "recording" ? "idle" : s));
      return;
    }
    try {
      const [injection] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const holder = window as unknown as {
            __annotatedMic?: {
              rec: MediaRecorder;
              chunks: Blob[];
              stream: MediaStream;
            };
          };
          const mic = holder.__annotatedMic;
          if (!mic) return Promise.resolve(null);
          return new Promise<{ base64: string; mimeType: string } | null>(
            (resolve) => {
              mic.rec.onstop = () => {
                const recorded = new Blob(mic.chunks, {
                  type: mic.rec.mimeType || "audio/webm",
                });
                mic.stream.getTracks().forEach((track) => track.stop());
                delete holder.__annotatedMic;
                const reader = new FileReader();
                reader.onloadend = () => {
                  const dataUrl = String(reader.result || "");
                  resolve({
                    base64: dataUrl.slice(dataUrl.indexOf(",") + 1),
                    mimeType: recorded.type,
                  });
                };
                reader.readAsDataURL(recorded);
              };
              if (mic.rec.state !== "inactive") mic.rec.stop();
              else resolve(null);
            }
          );
        },
      });

      const result = injection?.result as
        | { base64: string; mimeType: string }
        | null
        | undefined;
      if (result && result.base64) {
        const bytes = Uint8Array.from(atob(result.base64), (c) =>
          c.charCodeAt(0)
        );
        const recorded = new Blob([bytes], {
          type: result.mimeType || "audio/webm",
        });
        setPreviewUrl((url) => {
          if (url) URL.revokeObjectURL(url);
          return URL.createObjectURL(recorded);
        });
        setBlob(recorded);
        setTakeCount((n) => n + 1);
        setState("recorded");
      } else {
        setState("idle");
      }
    } catch {
      setState("idle");
    }
  }, [clearTimers]);

  stopRef.current = stop;

  const start = useCallback(async (): Promise<void> => {
    setError(null);
    setPreviewUrl((url) => {
      if (url) URL.revokeObjectURL(url);
      return null;
    });
    setBlob(null);

    const tabId = await getActiveTabId();
    if (tabId === null) {
      setState("denied");
      setError("No active tab to record from — open the page you're clipping.");
      return;
    }

    try {
      const [injection] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          return navigator.mediaDevices
            .getUserMedia({ audio: true })
            .then((stream) => {
              const rec = new MediaRecorder(stream);
              const chunks: Blob[] = [];
              rec.ondataavailable = (event) => {
                if (event.data.size > 0) chunks.push(event.data);
              };
              rec.start();
              (
                window as unknown as { __annotatedMic?: unknown }
              ).__annotatedMic = { rec, chunks, stream };
              return { ok: true as const };
            })
            .catch(() => ({ ok: false as const }));
        },
      });

      const result = injection?.result as { ok: boolean } | undefined;
      if (!result?.ok) {
        setState("denied");
        setError(DENIED_MESSAGE);
        return;
      }

      startedAtRef.current = Date.now();
      setElapsedMs(0);
      setState("recording");
      timerRef.current = setInterval(
        () => setElapsedMs(Date.now() - startedAtRef.current),
        200
      );
      autoStopRef.current = setTimeout(() => {
        void stopRef.current();
      }, MAX_RECORDING_MS);
    } catch {
      setState("denied");
      setError(DENIED_MESSAGE);
    }
  }, []);

  const clear = useCallback(() => {
    clearTimers();
    setPreviewUrl((url) => {
      if (url) URL.revokeObjectURL(url);
      return null;
    });
    setBlob(null);
    setElapsedMs(0);
    setError(null);
    setState("idle");
  }, [clearTimers]);

  useEffect(
    () => () => {
      clearTimers();
      setPreviewUrl((url) => {
        if (url) URL.revokeObjectURL(url);
        return null;
      });
    },
    [clearTimers]
  );

  return { state, blob, previewUrl, elapsedMs, takeCount, error, start, stop, clear };
}
