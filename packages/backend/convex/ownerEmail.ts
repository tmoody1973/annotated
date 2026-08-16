/**
 * One way to email the site owner. Used by the two public, unauthenticated
 * write surfaces — fair-use claims and conduct reports — so their delivery
 * behaviour cannot drift apart.
 *
 * Recipient and site base URL are env-overridable because the Resend test
 * sender (`onboarding@resend.dev`) only reaches the Resend account's own
 * address until a domain is verified.
 */
const OWNER_EMAIL_FALLBACK = "tarik@radiomilwaukee.org";
const OWNER_EMAIL_SENDER = "Annotated <onboarding@resend.dev>";
const SITE_BASE_URL_FALLBACK = "http://localhost:3000";

export function siteBaseUrl(): string {
  return process.env.SITE_BASE_URL ?? SITE_BASE_URL_FALLBACK;
}

export function ownerRecipient(): string {
  return process.env.CLAIM_NOTIFY_TO ?? OWNER_EMAIL_FALLBACK;
}

export async function sendOwnerEmail(options: {
  subject: string;
  text: string;
  replyTo?: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured on Convex.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: OWNER_EMAIL_SENDER,
      to: [ownerRecipient()],
      ...(options.replyTo ? { reply_to: options.replyTo } : {}),
      subject: options.subject,
      text: options.text,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resend rejected the email (${response.status}): ${detail}`);
  }
}
