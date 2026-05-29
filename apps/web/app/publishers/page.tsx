import type { Metadata } from "next";
import { SiteHeader } from "../_components/site-header";
import { SiteFooter } from "../_components/site-footer";
import { WaitlistForm } from "./waitlist-form";

export const metadata: Metadata = {
  title: "Publishers — Annotated",
  description:
    "People are already clipping, quoting, and arguing with your work on Annotated. Publisher accounts put you back in the room — answer in your own voice, claim your content, and see how far it travels.",
};

const FEATURES = [
  {
    no: "01",
    title: "Right of Reply",
    promise: "Answer where the argument is happening.",
    why: "When someone clips you and calls it BS, your verified response pins to the top of the thread — in your voice, right next to the receipt. Criticism stops standing unanswered, and you never have to chase it across X to set the record straight.",
  },
  {
    no: "02",
    title: "Verified Badge",
    promise: "Be the real you, officially.",
    why: "A checkmark turns “some account claiming to be the newsroom” into a trusted source. Readers instantly know when the actual byline, show, or channel is weighing in — and your claims route straight to you, not a stranger.",
  },
  {
    no: "03",
    title: "The Clip Desk",
    promise: "Every clip of your work, one queue.",
    why: "Stop hunting annotations one at a time. See everything clipped from your domain or channel on a single board — reply, add context, or dispute genuine fair-use breaches in bulk. Claims become a workflow, not a fire drill.",
  },
  {
    no: "04",
    title: "Signal",
    promise: "See how far your work travels.",
    why: "Clip volume, the BS-vs-brilliant split, your most-argued passages — and the number that matters most: how many readers Annotated sent back to your source. It's media monitoring that pays you in traffic instead of an invoice.",
  },
  {
    no: "05",
    title: "Self-Annotation",
    promise: "Show your own work.",
    why: "Annotate your own pieces. Add the context a clip left out, footnote your sourcing, correct the record — all linked to the original. The “show your work” ethos, now from your side of the byline, before anyone else frames it for you.",
  },
  {
    no: "06",
    title: "⚖ Standing, Not Veto",
    promise: "Fair use cuts both ways.",
    why: "You can dispute the real breaches — over-length clips, missing source links, full-article reposts. You can't make a fair argument vanish because it stings. That line is exactly what keeps Annotated a place worth being on — and worth replying on.",
    guard: true,
  },
];

const sectionLabel =
  "flex items-center gap-3 font-mono text-[12px] font-bold uppercase tracking-[0.18em] text-[color:var(--b-dim-onbg)] before:h-px before:w-7 before:bg-[color:var(--b-acid)] before:content-['']";

export default function PublishersPage() {
  return (
    <main className="flex min-h-screen flex-col bg-[color:var(--b-bg)] text-[color:var(--b-onbg)]">
      <SiteHeader />

      {/* HERO */}
      <section className="mx-auto grid w-full max-w-[1100px] grid-cols-1 items-center gap-12 px-6 py-16 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="inline-flex items-center gap-2.5 font-mono text-[12px] font-bold uppercase tracking-[0.16em] text-[color:var(--b-dim-onbg)]">
            <span className="size-2 bg-[color:var(--b-acid)]" />
            Publisher accounts · Coming soon
          </p>
          <h1 className="mt-6 font-display text-[clamp(40px,7vw,76px)] uppercase leading-[0.95] tracking-tight">
            Get standing in{" "}
            <span className="bg-[color:var(--b-acid)] px-1.5 text-[color:var(--b-acid-ink)]">
              your own story.
            </span>
          </h1>
          <p className="mt-7 max-w-[54ch] text-[18px] leading-relaxed text-[color:var(--b-dim-onbg)]">
            People are already clipping, quoting, and arguing with your work on Annotated.{" "}
            <strong className="font-bold text-[color:var(--b-onbg)]">
              Publisher accounts put you back in the room
            </strong>{" "}
            — to answer in your own voice, claim your content, and see exactly how far it
            travels.
          </p>
          <div className="mt-8">
            <WaitlistForm />
            <p className="mt-4 font-mono text-[11.5px] text-[color:var(--b-dim-onbg)]">
              Verify with X or Google at launch. No new password, no setup fee.
            </p>
          </div>
        </div>

        {/* Mock annotation card — what a publisher reply looks like */}
        <div className="border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-card)] p-5 text-[color:var(--b-ink)] shadow-[8px_8px_0_0_var(--b-shadow)]">
          <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-[color:var(--b-dim)]">
            Annotation · 4 clips threaded
          </p>
          <span className="mt-3 inline-block border-2 border-[#ff5a47] px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-wide text-[#ff5a47]">
            ✗ That&rsquo;s BS
          </span>
          <blockquote className="mt-3 border-l-[4px] border-[#ff5a47] bg-[color:var(--b-bg)] py-2.5 pl-3 pr-3 text-[14px] text-[color:var(--b-dim)]">
            “…the policy will cost taxpayers nothing in its first decade…”
            <span className="mt-2 block font-mono text-[11px] text-[color:var(--b-dim)]">
              ↳ clip from yourpublication.com · 0:00–0:12
            </span>
          </blockquote>
          <p className="mt-3 text-[13.5px] text-[color:var(--b-dim)]">
            A reader clipped your line and argued the CBO score says otherwise.
          </p>
          <div className="mt-4 border-[2px] border-[color:var(--b-acid)] bg-[color:var(--b-bg)] p-3.5">
            <div className="flex items-center gap-2">
              <span className="grid size-[22px] place-items-center bg-[color:var(--b-acid)] font-display text-[12px] text-[color:var(--b-acid-ink)]">
                P
              </span>
              <span className="text-[13px] font-extrabold">Your Publication</span>
              <span className="text-[13px] text-[color:var(--b-acid)]">✔</span>
              <span className="ml-auto font-mono text-[9.5px] uppercase tracking-[0.08em] text-[color:var(--b-dim)]">
                Pinned · Author reply
              </span>
            </div>
            <p className="mt-2 text-[13.5px] leading-snug">
              Here&rsquo;s the context that clip cut: the figure refers to net cost after
              offsets. Full methodology in paragraph 9 →
            </p>
          </div>
        </div>
      </section>

      {/* THE CASE */}
      <section className="border-y-[3px] border-[color:var(--b-line)]">
        <div className="mx-auto grid w-full max-w-[1100px] grid-cols-1 gap-10 px-6 py-16 md:grid-cols-2">
          <div>
            <p className={sectionLabel}>The case</p>
            <h2 className="mt-4 max-w-[18ch] font-display text-[clamp(28px,4vw,44px)] uppercase leading-[1.04] tracking-tight">
              Right now, you&rsquo;re being talked about. Not talked with.
            </h2>
          </div>
          <div className="flex flex-col gap-5 text-[18px] leading-relaxed text-[color:var(--b-dim-onbg)]">
            <p>
              Annotated is built on a simple act: someone clips a sentence, a soundbite, or a
              90-second segment, links back to your source, and makes their case in public.
              Half of those cases are{" "}
              <strong className="font-bold text-[color:var(--b-onbg)]">“that's brilliant.”</strong>{" "}
              The other half are{" "}
              <strong className="font-bold text-[color:var(--b-onbg)]">“that's BS.”</strong>
            </p>
            <p>
              Either way, it's happening with or without you. The clip exists. The argument is
              live. The only question is whether the actual creator is in the thread — or
              absent from it.
            </p>
            <p className="text-[color:var(--b-onbg)]">
              A publisher account is how you stop being a quote and start being a{" "}
              <span className="bg-[color:var(--b-acid)] px-1 font-bold text-[color:var(--b-acid-ink)]">
                voice.
              </span>
            </p>
          </div>
        </div>
      </section>

      {/* SIX FEATURES */}
      <section className="mx-auto w-full max-w-[1100px] px-6 py-16">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className={sectionLabel}>What you get</p>
            <h2 className="mt-4 font-display text-[clamp(28px,4vw,44px)] uppercase leading-tight tracking-tight">
              Six things a publisher account unlocks.
            </h2>
          </div>
          <p className="max-w-[26ch] text-right font-mono text-[12px] text-[color:var(--b-dim-onbg)]">
            Free to claim. Built on the same fair-use rails as everything else on Annotated.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2">
          {FEATURES.map((f) => (
            <div
              key={f.no}
              className={`border-[3px] bg-[color:var(--b-card)] p-7 text-[color:var(--b-ink)] shadow-[6px_6px_0_0_var(--b-shadow)] ${
                f.guard ? "border-[#ff5a47]" : "border-[color:var(--b-line)]"
              }`}
            >
              <span className="font-mono text-[12px] tracking-[0.05em] text-[color:var(--b-dim)]">
                {f.no}
              </span>
              <h3 className="mt-3 font-display text-[24px] uppercase leading-none tracking-tight">
                {f.title}
              </h3>
              <p
                className={`mt-2 text-[15px] font-bold ${
                  f.guard ? "text-[#ff5a47]" : "text-[color:var(--b-ink)]"
                }`}
              >
                {f.promise}
              </p>
              <p className="mt-3 text-[14.5px] leading-relaxed text-[color:var(--b-dim)]">
                <strong className="font-bold text-[color:var(--b-ink)]">Why:</strong> {f.why}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW YOU GET PULLED IN */}
      <section className="mx-auto w-full max-w-[1100px] px-6 pb-16">
        <div className="flex flex-wrap items-center justify-between gap-8 border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-card)] p-10 text-[color:var(--b-ink)] shadow-[8px_8px_0_0_var(--b-shadow)]">
          <div className="max-w-[30ch]">
            <p className={sectionLabel}>How you'll get pulled in</p>
            <p className="mt-4 font-display text-[clamp(22px,2.6vw,30px)] uppercase leading-[1.1] tracking-tight">
              The moment your work gets clipped,{" "}
              <span className="text-[color:var(--b-acid-ink)]">we'll tell you.</span> Claiming
              your account takes one click and your X or Google login.
            </p>
            <p className="mt-4 font-mono text-[12px] tracking-[0.05em] text-[color:var(--b-dim)]">
              CLIPPED → NOTIFIED → CLAIM IN ONE CLICK → REPLY, CONTEXT &amp; ANALYTICS
            </p>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="border-t-[3px] border-[color:var(--b-line)]">
        <div className="mx-auto w-full max-w-[1100px] px-6 py-20 text-center">
          <p className={`${sectionLabel} justify-center`}>Coming soon</p>
          <h2 className="mx-auto mt-5 max-w-[20ch] font-display text-[clamp(28px,4.5vw,48px)] uppercase leading-tight tracking-tight">
            Your work is already on Annotated. Be in the room when it launches.
          </h2>
          <div className="mt-9">
            <WaitlistForm submitLabel="Join the waitlist" align="center" />
            <p className="mt-4 font-mono text-[11.5px] text-[color:var(--b-dim-onbg)]">
              For newsrooms, podcasters, creators &amp; channels. Verify with X or Google.
            </p>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
