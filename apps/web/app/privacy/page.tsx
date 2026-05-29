import type { Metadata } from "next";
import { SiteHeader } from "../_components/site-header";

export const metadata: Metadata = { title: "Privacy Policy — Annotated" };

const UPDATED = "May 28, 2026";

export default function PrivacyPage() {
  return (
    <main className="flex min-h-screen flex-1 flex-col">
      <SiteHeader />
      <div className="mx-auto w-full max-w-[760px] px-6 py-10 text-[color:var(--b-onbg)]">
        <h1 className="font-display text-3xl tracking-tight">PRIVACY POLICY</h1>
        <p className="mt-1 font-mono text-[12px] uppercase tracking-[0.14em] text-[color:var(--b-dim-onbg)]">
          Last updated {UPDATED}
        </p>

        <div className="mt-7 space-y-6 text-[15px] leading-relaxed [&_h2]:font-display [&_h2]:text-xl [&_h2]:tracking-tight [&_h2]:mt-7 [&_h2]:mb-2">
          <p>
            Annotated lets you clip and annotate media — YouTube videos, podcasts, and
            articles — from the web and publish it to a source-linked page. This policy
            explains what the Annotated web app and Chrome extension collect and how it is
            used.
          </p>

          <h2>What we collect</h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong>Account information</strong> — when you sign in with X or Google
              through our authentication provider (Clerk), we receive your name, username,
              email, and avatar.
            </li>
            <li>
              <strong>Content you choose to clip</strong> — the URL of the page, the time
              range or text selection you pick, and (for articles) an optional screenshot
              of the page, captured only when you take a clip.
            </li>
            <li>
              <strong>Your commentary</strong> — the text or recorded-audio note you add to
              a clip, and the topics you assign.
            </li>
          </ul>

          <h2>How we use it</h2>
          <p>
            Solely to create, transcribe, and publish the annotations you make, attribute
            them to your account, and display them in the public feed and on topic pages.
            The Chrome extension only reads the active tab&apos;s content when you take a
            clip; it does not track your browsing.
          </p>

          <h2>Who it&apos;s shared with</h2>
          <p>
            We use service providers strictly to operate the product: <strong>Convex</strong>{" "}
            (database + file storage), a clip-processing <strong>worker</strong> (audio/video
            and article extraction), <strong>Deepgram</strong> (transcription), and{" "}
            <strong>Resend</strong> (emailing fair-use dispute notices). We do not sell your
            data, and we do not use it for advertising or third-party tracking.
          </p>

          <h2>Fair use &amp; source attribution</h2>
          <p>
            Clips are short, source-linked excerpts intended for commentary and criticism —
            we point at the original, we don&apos;t replace it. Every annotation shows a
            visible link to the source and a &quot;File a claim&quot; option for rights
            holders to dispute use.
          </p>

          <h2>Your choices</h2>
          <p>
            You can sign out at any time, and you control what you clip and publish. To
            request deletion of your account or content, contact us at the address below.
          </p>

          <h2>Contact</h2>
          <p>
            Questions or requests:{" "}
            <a className="font-bold underline" href="mailto:tarik@radiomilwaukee.org">
              tarik@radiomilwaukee.org
            </a>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
