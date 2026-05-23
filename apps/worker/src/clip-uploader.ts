import { readFile } from "node:fs/promises";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

const generateUploadUrlRef = makeFunctionReference<
  "mutation",
  { workerToken: string },
  string
>("files:generateUploadUrl");

export interface ClipUploader {
  upload(filePath: string): Promise<string>;
}

/**
 * Uploads a local clip file to Convex file storage using the standard
 * generate-upload-url → POST flow, presenting the shared worker token to the
 * token-guarded mutation. Returns the resulting storage ID.
 */
export function createClipUploader(
  convexUrl: string,
  workerToken: string
): ClipUploader {
  const client = new ConvexHttpClient(convexUrl);

  return {
    async upload(filePath: string): Promise<string> {
      const uploadUrl = await client.mutation(generateUploadUrlRef, { workerToken });
      const bytes = await readFile(filePath);

      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "video/mp4" },
        body: bytes,
      });
      if (!response.ok) {
        throw new Error(`Convex upload failed: ${response.status}`);
      }

      const { storageId } = (await response.json()) as { storageId: string };
      return storageId;
    },
  };
}
