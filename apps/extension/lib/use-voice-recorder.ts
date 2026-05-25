import { useCallback, useEffect, useRef, useState } from "react";

/** SPEC caps clips at 90s; voice commentary follows the same ceiling. */
export const MAX_RECORDING_MS = 90_000;

export type RecorderState = "idle" | "recording" | "recorded" | "denied";

export interface VoiceRecorder {
  state: RecorderState;
  blob: Blob | null;
  previewUrl: string | null;
  elapsedMs: number;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  clear: () => void;
}

/**
 * MediaRecorder wrapper for recorded voice commentary: requests the mic on a user
 * gesture, records to a webm blob, exposes a preview URL, auto-stops at the 90s
 * cap, and surfaces a permission-denied state. Streams and object URLs are torn
 * down on stop/clear/unmount so the mic indicator clears and memory is reclaimed.
 */
export function useVoiceRecorder(): VoiceRecorder {
  const [state, setState] = useState<RecorderState>("idle");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAtRef = useRef(0);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    timerRef.current = null;
    autoStopRef.current = null;
  }, []);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setPreviewUrl((url) => {
      if (url) URL.revokeObjectURL(url);
      return null;
    });
    setBlob(null);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const recorded = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        releaseStream();
        // A stop before any audio chunk arrives yields a 0-byte blob; treat it
        // as no recording rather than a publishable (and un-transcodable) note.
        if (recorded.size === 0) {
          setState("idle");
          return;
        }
        setBlob(recorded);
        setPreviewUrl(URL.createObjectURL(recorded));
        setState("recorded");
      };

      recorder.start();
      startedAtRef.current = Date.now();
      setElapsedMs(0);
      setState("recording");
      timerRef.current = setInterval(
        () => setElapsedMs(Date.now() - startedAtRef.current),
        200
      );
      autoStopRef.current = setTimeout(stop, MAX_RECORDING_MS);
    } catch {
      setState("denied");
      setError("Microphone access was blocked. Allow the mic to record commentary.");
      releaseStream();
    }
  }, [releaseStream, stop]);

  const clear = useCallback(() => {
    setPreviewUrl((url) => {
      if (url) URL.revokeObjectURL(url);
      return null;
    });
    setBlob(null);
    setElapsedMs(0);
    setError(null);
    setState("idle");
  }, []);

  useEffect(
    () => () => {
      // Detach onstop first: releaseStream() stops the tracks, which would
      // otherwise fire a late onstop that creates an object URL on an unmounted
      // hook (leaked, never revoked).
      if (recorderRef.current) recorderRef.current.onstop = null;
      releaseStream();
      setPreviewUrl((url) => {
        if (url) URL.revokeObjectURL(url);
        return null;
      });
    },
    [releaseStream]
  );

  return { state, blob, previewUrl, elapsedMs, error, start, stop, clear };
}
