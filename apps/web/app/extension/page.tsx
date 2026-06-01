import type { Metadata } from "next";
import { SiteHeader } from "../_components/site-header";
import { SiteFooter } from "../_components/site-footer";
import { ExtensionHeroCta, InstallDownloadButton } from "./install-ctas";

export const metadata: Metadata = {
  title: "Extension — Annotated",
  description:
    "Clip any page without leaving it. Highlight text on any site, add your take, and publish the receipt — straight from a dock beside the page. Free for Chrome.",
};

const STEPS = [
  {
    no: "01",
    title: "Highlight on any page",
    body: "Select the text that matters — an article, a PDF, a thread. The Annotated dock catches it.",
    demo: "“Birmingham boasts an average monthly rent of $1,182…”",
  },
  {
    no: "02",
    title: "Add your take",
    body: "Say why it matters. Your annotation is the point — the clip is just the evidence.",
    demo: "This is the relocation story nobody's telling.",
  },
  {
    no: "03",
    title: "Publish the receipt",
    body: "One click posts the clip, your take, and the source link to your Annotated feed.",
    demo: "▸ Published · 4 notes · 31 ▲",
  },
];

const sectionLabel =
  "flex items-center gap-3 font-mono text-[12px] font-bold uppercase tracking-[0.18em] text-[color:var(--b-dim-onbg)] before:h-px before:w-7 before:bg-[color:var(--b-acid)] before:content-['']";

export default function ExtensionPage() {
  return (
    <main className="flex min-h-screen flex-col bg-[color:var(--b-bg)] text-[color:var(--b-onbg)]">
      <SiteHeader />

      {/* HERO */}
      <section className="border-b-[3px] border-[color:var(--b-line)]">
        <div className="mx-auto grid max-w-[1080px] items-center gap-10 px-6 py-14 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <span className="mb-4 inline-block border-2 border-[color:var(--b-line)] px-2.5 py-1 font-mono text-[12px] font-bold uppercase tracking-wide">
              ⊕ Annotated for your browser
            </span>
            <h1 className="font-display text-[clamp(34px,5vw,58px)] leading-[0.96] tracking-tight">
              Clip any page
              <br />
              without leaving it.
            </h1>
            <p className="mt-5 max-w-[46ch] text-[18px] leading-relaxed text-[color:var(--b-onbg)]">
              Highlight text on any site, add your take, and publish the receipt — straight from a
              dock beside the page. No copy-paste, no tab-juggling.
            </p>
            <div className="mt-7">
              <ExtensionHeroCta />
            </div>
          </div>

          {/* Faux-browser clipper visual */}
          <div
            aria-hidden="true"
            className="border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-card)] shadow-[9px_9px_0_0_var(--b-shadow)]"
          >
            <div className="flex items-center gap-1.5 bg-[color:var(--b-chrome)] px-3 py-2.5">
              <span className="block h-2.5 w-2.5 rounded-full bg-[#5a5a52]" />
              <span className="block h-2.5 w-2.5 rounded-full bg-[#5a5a52]" />
              <span className="block h-2.5 w-2.5 rounded-full bg-[#5a5a52]" />
              <span className="ml-2 flex-1 rounded-full bg-[#2a2a26] px-2.5 py-1 font-mono text-[10px] text-[#b9b8ad]">
                npr.org/podcasts
              </span>
            </div>
            <div className="grid min-h-[230px] grid-cols-[1fr_150px] text-[color:var(--b-ink)]">
              <div className="border-r-[3px] border-[color:var(--b-line)] p-4 text-[11px] leading-relaxed text-[#56564f]">
                <span className="mb-2 block font-display text-[15px] text-[color:var(--b-ink)]">
                  NPR Podcasts &amp; Shows
                </span>
                Over at Pop Culture Happy Hour,{" "}
                <span className="bg-[color:var(--b-acid)] px-0.5 text-[color:var(--b-acid-ink)]">
                  we break down what&apos;s actually worth watching, listening to, and pretending you
                  already knew about.
                </span>{" "}
                So the team digs into the week&apos;s releases…
              </div>
              <div className="flex flex-col gap-2.5 bg-[color:var(--b-bg)] p-3">
                <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold">
                  <span className="bg-[color:var(--b-acid)] px-1 text-[color:var(--b-acid-ink)]">
                    A
                  </span>{" "}
                  NEW CLIP
                </div>
                <div className="border-l-[3px] border-[color:var(--b-acid)] pl-2 text-[10px] leading-snug text-[#26261f]">
                  &ldquo;we break down what&apos;s actually worth watching…&rdquo;
                </div>
                <div className="border-2 border-[color:var(--b-line)] bg-[color:var(--b-card)] p-1.5 font-mono text-[9px] text-[#56564f]">
                  Required listening if you cover culture.
                </div>
                <div className="bg-[color:var(--b-chrome)] p-1.5 text-center font-mono text-[10px] font-bold text-[color:var(--b-acid)]">
                  PUBLISH ▸
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="border-b-[3px] border-[color:var(--b-line)]">
        <div className="mx-auto max-w-[1080px] px-6 py-14">
          <p className={sectionLabel}>Three steps · no account needed to try</p>
          <h2 className="mt-3 font-display text-[30px] tracking-tight">How it works</h2>
          <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-3">
            {STEPS.map((step) => (
              <div
                key={step.no}
                className="border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-card)] p-5 text-[color:var(--b-ink)] shadow-[6px_6px_0_0_var(--b-shadow)]"
              >
                <span className="mb-3 inline-block bg-[color:var(--b-chrome)] px-2 py-1 font-mono text-[11px] font-bold text-[color:var(--b-acid)]">
                  {step.no}
                </span>
                <h3 className="font-display text-lg tracking-tight">{step.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-[color:var(--b-ink)]">
                  {step.body}
                </p>
                <p className="mt-3 border-l-4 border-[color:var(--b-acid)] pl-2.5 text-[13px] leading-relaxed text-[#26261f]">
                  {step.demo}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* INSTALL — manual sideload until Chrome Web Store approval */}
      <section id="install" className="border-b-[3px] border-[color:var(--b-line)] scroll-mt-20">
        <div className="mx-auto max-w-[1080px] px-6 py-14">
          <p className={sectionLabel}>Install in Chrome · about a minute</p>
          <h2 className="mt-3 font-display text-[30px] tracking-tight">Add it to Chrome yourself</h2>
          <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-[color:var(--b-onbg)]">
            Annotated is in Chrome Web Store review. Until it&apos;s approved you can add it directly
            — same extension, about a minute. Works in Chrome and other Chromium browsers (Edge,
            Brave).
          </p>

          <ol className="mt-8 grid grid-cols-1 gap-4">
            {[
              {
                no: "01",
                title: "Download & unzip",
                body: (
                  <>
                    Download the package and unzip it — you&apos;ll get a folder named{" "}
                    <code className="bg-[color:var(--b-chrome)] px-1 py-0.5 font-mono text-[12px] text-[color:var(--b-acid)]">
                      annotated-extension
                    </code>
                    .
                    <span className="mt-3 block">
                      <InstallDownloadButton />
                    </span>
                  </>
                ),
              },
              {
                no: "02",
                title: "Open Chrome's extensions page",
                body: (
                  <>
                    Paste this into your address bar and press Enter:{" "}
                    <code className="bg-[color:var(--b-chrome)] px-1 py-0.5 font-mono text-[12px] text-[color:var(--b-acid)]">
                      chrome://extensions
                    </code>
                    <span className="mt-1 block font-mono text-[11px] text-[color:var(--b-dim)]">
                      (Chrome blocks links to that page, so it has to be pasted.)
                    </span>
                  </>
                ),
              },
              {
                no: "03",
                title: "Turn on Developer mode",
                body: <>Flip the <strong>Developer mode</strong> toggle in the top-right corner.</>,
              },
              {
                no: "04",
                title: "Load unpacked",
                body: (
                  <>
                    Click <strong>Load unpacked</strong> and select the{" "}
                    <code className="bg-[color:var(--b-chrome)] px-1 py-0.5 font-mono text-[12px] text-[color:var(--b-acid)]">
                      annotated-extension
                    </code>{" "}
                    folder you unzipped.
                  </>
                ),
              },
              {
                no: "05",
                title: "Pin it & sign in",
                body: (
                  <>
                    Click the puzzle-piece icon, pin <strong>Annotated</strong>, then click it on any
                    page and sign in with Google or X. You&apos;re clipping.
                  </>
                ),
              },
            ].map((step) => (
              <li
                key={step.no}
                className="flex gap-4 border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-card)] p-5 text-[color:var(--b-ink)] shadow-[6px_6px_0_0_var(--b-shadow)]"
              >
                <span className="h-fit shrink-0 bg-[color:var(--b-chrome)] px-2 py-1 font-mono text-[11px] font-bold text-[color:var(--b-acid)]">
                  {step.no}
                </span>
                <div>
                  <h3 className="font-display text-lg tracking-tight">{step.title}</h3>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-[color:var(--b-ink)]">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <p className="mt-6 border-l-4 border-[color:var(--b-acid)] pl-3 font-mono text-[12px] leading-relaxed text-[color:var(--b-dim-onbg)]">
            Once it clears Chrome Web Store review, this becomes a one-click install — no download,
            no Developer mode.
          </p>
        </div>
      </section>

      {/* PRIVACY + MOBILE */}
      <section>
        <div className="mx-auto grid max-w-[1080px] grid-cols-1 gap-6 px-6 py-14 lg:grid-cols-2">
          <div className="border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-card)] p-6 text-[color:var(--b-ink)] shadow-[6px_6px_0_0_var(--b-shadow)]">
            <h3 className="font-display text-lg tracking-tight">What it can access — and why</h3>
            <ul className="mt-4 space-y-2.5 text-[13px] leading-relaxed">
              {[
                "Reads the page you're actively clipping, only when you open the dock. Nothing in the background.",
                "Stores your draft take locally until you publish.",
                "Sends a clip to Annotated only when you hit Publish.",
                "No browsing history, no tracking across sites, no selling data.",
              ].map((item) => (
                <li key={item} className="relative pl-5 before:absolute before:left-0 before:font-bold before:text-[color:var(--b-ink)] before:content-['›']">
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-4 border-l-4 border-[color:var(--b-acid)] pl-2.5 font-mono text-[11px] leading-relaxed text-[#26261f]">
              Plain version: it does nothing until you ask it to, and it only ever sees the page
              you&apos;re clipping.
            </p>
          </div>

          <div className="border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-card)] p-6 text-[color:var(--b-ink)] shadow-[6px_6px_0_0_var(--b-shadow)]">
            <h3 className="font-display text-lg tracking-tight">On mobile, Safari, or Firefox?</h3>
            <ul className="mt-4 space-y-2.5 text-[13px] leading-relaxed">
              {[
                "The extension isn't available there yet — but you don't need it to use Annotated.",
                "Tap + New clip anywhere and paste a link.",
                "We'll pull the page so you can highlight and add your take right in the app.",
              ].map((item) => (
                <li key={item} className="relative pl-5 before:absolute before:left-0 before:font-bold before:text-[color:var(--b-ink)] before:content-['›']">
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-4 border-l-4 border-[color:var(--b-acid)] pl-2.5 font-mono text-[11px] leading-relaxed text-[#26261f]">
              Same clip, same receipt — just one extra tap without the dock.
            </p>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
