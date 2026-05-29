import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "../_components/site-header";
import { SiteFooter } from "../_components/site-footer";

export const metadata: Metadata = {
  title: "About — Annotated",
  description:
    "Annotated is where you clip the web, add your take, and publish the receipt. Every clip links back to its source, and fair use cuts both ways. Here's the whole idea.",
};

const PRINCIPLES = [
  {
    no: "01",
    title: "The take is the point",
    body: "A clip on its own is just a quote. The annotation — why it matters, what's wrong with it, what everyone missed — is the thing worth reading. The clip is the evidence, your take is the argument.",
  },
  {
    no: "02",
    title: "Always link the source",
    body: "Every annotation carries a visible link back to where it came from. Annotated sends readers to the original instead of replacing it. Show your work; cite your receipts.",
  },
  {
    no: "03",
    title: "Fair use cuts both ways",
    body: "Clips stay short and link out, so quoting is fair game. Publishers can dispute genuine breaches — over-length clips, missing links, full reposts — but nobody gets to make a fair argument vanish because it stings.",
  },
];

const sectionLabel =
  "flex items-center gap-3 font-mono text-[12px] font-bold uppercase tracking-[0.18em] text-[color:var(--b-dim-onbg)] before:h-px before:w-7 before:bg-[color:var(--b-acid)] before:content-['']";

export default function AboutPage() {
  return (
    <main className="flex min-h-screen flex-col bg-[color:var(--b-bg)] text-[color:var(--b-onbg)]">
      <SiteHeader />

      {/* HERO */}
      <section className="border-b-[3px] border-[color:var(--b-line)]">
        <div className="mx-auto max-w-[1080px] px-6 py-16">
          <span className="mb-4 inline-block border-2 border-[color:var(--b-line)] px-2.5 py-1 font-mono text-[12px] font-bold uppercase tracking-wide">
            ⊕ What is Annotated
          </span>
          <h1 className="font-display text-[clamp(34px,5.5vw,62px)] leading-[0.95] tracking-tight">
            Clip the web.
            <br />
            Add your take.
            <br />
            Publish the receipt.
          </h1>
          <p className="mt-6 max-w-[54ch] text-[18px] leading-relaxed">
            Annotated turns the things you read, watch, and listen to into something you can argue
            with in public. Grab a 90-second clip from an article, a podcast, or a YouTube video,
            say what you actually think, and post it — with the source link attached. No screenshots
            ripped out of context, no &ldquo;trust me.&rdquo; Just the receipt and your read on it.
          </p>
        </div>
      </section>

      {/* PRINCIPLES */}
      <section className="border-b-[3px] border-[color:var(--b-line)]">
        <div className="mx-auto max-w-[1080px] px-6 py-14">
          <p className={sectionLabel}>What we believe</p>
          <h2 className="mt-3 font-display text-[30px] tracking-tight">The whole idea, in three lines</h2>
          <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-3">
            {PRINCIPLES.map((item) => (
              <div
                key={item.no}
                className="border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-card)] p-5 text-[color:var(--b-ink)] shadow-[6px_6px_0_0_var(--b-shadow)]"
              >
                <span className="mb-3 inline-block bg-[color:var(--b-chrome)] px-2 py-1 font-mono text-[11px] font-bold text-[color:var(--b-acid)]">
                  {item.no}
                </span>
                <h3 className="font-display text-lg tracking-tight">{item.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section>
        <div className="mx-auto flex max-w-[1080px] flex-col items-start gap-5 px-6 py-16">
          <h2 className="font-display text-[28px] tracking-tight">Start clipping</h2>
          <p className="max-w-[48ch] text-[16px] leading-relaxed">
            Browse the feed without an account, or sign in and publish your first clip in under a
            minute. Want it built into your browser? Grab the extension.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-acid)] px-6 py-3 font-display text-[15px] uppercase tracking-wide text-[color:var(--b-acid-ink)] shadow-[6px_6px_0_0_var(--b-shadow)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-[3px_3px_0_0_var(--b-shadow)]"
            >
              Browse the feed →
            </Link>
            <Link
              href="/extension"
              className="border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-card)] px-6 py-3 font-display text-[15px] uppercase tracking-wide text-[color:var(--b-ink)] shadow-[6px_6px_0_0_var(--b-shadow)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-[3px_3px_0_0_var(--b-shadow)]"
            >
              ⊕ Get the extension
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
