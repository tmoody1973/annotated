import { createClient, type SyncPrerecordedResponse } from "@deepgram/sdk";

/** Deepgram model for pre-recorded podcast transcription (word times + diarization). */
const MODEL = "nova-3";

export interface DeepgramClient {
  transcribeUrl(mp3Url: string): Promise<SyncPrerecordedResponse>;
  /** Transcribes local audio bytes (recorded voice commentary) to plain text. */
  transcribeFile(audio: Buffer, mimetype: string): Promise<string>;
}

/**
 * Wraps the Deepgram SDK with a single synchronous transcribe-from-URL call.
 * Diarization is on so each word carries a speaker; smart formatting yields
 * readable punctuated words. Throws on Deepgram error or empty result.
 */
export function createDeepgramClient(apiKey: string): DeepgramClient {
  const deepgram = createClient(apiKey);

  return {
    async transcribeUrl(mp3Url: string): Promise<SyncPrerecordedResponse> {
      const { result, error } = await deepgram.listen.prerecorded.transcribeUrl(
        { url: mp3Url },
        { model: MODEL, diarize: true, smart_format: true }
      );

      if (error) {
        const message = error instanceof Error ? error.message : JSON.stringify(error);
        throw new Error(`Deepgram transcription failed: ${message}`);
      }
      if (!result) {
        throw new Error("Deepgram returned no result");
      }

      return result;
    },

    async transcribeFile(audio: Buffer, mimetype: string): Promise<string> {
      const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
        audio,
        { model: MODEL, smart_format: true, mimetype }
      );
      if (error) {
        const message = error instanceof Error ? error.message : JSON.stringify(error);
        throw new Error(`Deepgram transcription failed: ${message}`);
      }
      return (
        result?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? ""
      );
    },
  };
}
