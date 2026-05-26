import { makeFunctionReference } from "convex/server";

/** Token-guarded mutation that mints a short-lived Convex storage upload URL. */
export const generateUploadUrlRef = makeFunctionReference<
  "mutation",
  { workerToken: string },
  string
>("files:generateUploadUrl");

/**
 * Captures the visible area of the active tab as a JPEG blob — the article page
 * the clipper is looking at — so the landing can show it as a citation visual
 * (gap §4). Returns null when capture isn't permitted (a restricted page, a
 * revoked tab), so the caller publishes without a screenshot rather than failing.
 */
export async function captureVisibleArticle(): Promise<Blob | null> {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(
      chrome.windows.WINDOW_ID_CURRENT,
      { format: "jpeg", quality: 80 }
    );
    return dataUrlToBlob(dataUrl);
  } catch {
    return null;
  }
}

/** Decodes a `data:image/...;base64,...` URL into a Blob for upload. */
function dataUrlToBlob(dataUrl: string): Blob {
  const commaIndex = dataUrl.indexOf(",");
  const meta = dataUrl.slice(0, commaIndex);
  const base64 = dataUrl.slice(commaIndex + 1);
  const mimeType = meta.match(/data:(.*?);/)?.[1] ?? "image/jpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

/**
 * Uploads a blob to Convex file storage using a pre-minted upload URL and returns
 * the resulting storageId. The URL is minted by `files.generateUploadUrl` (the
 * caller owns the Convex client binding and passes the minted URL in).
 */
export async function uploadToConvexStorage(
  uploadUrl: string,
  blob: Blob
): Promise<string> {
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": blob.type },
    body: blob,
  });
  if (!response.ok) {
    throw new Error(`Storage upload failed (${response.status})`);
  }
  const body = (await response.json()) as { storageId?: string };
  if (typeof body.storageId !== "string") {
    throw new Error("Storage upload returned no storageId");
  }
  return body.storageId;
}
