"use client";

import { useState } from "react";

type Format = "story" | "grid";

/** "Save as image" — opens a brutalist dialog with a Story/Grid toggle, a live
 *  preview of the share card, and a Download button (an <a download> hitting the
 *  /card route with &dl=1, which sets Content-Disposition: attachment). */
export function SaveImageDialog({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<Format>("grid");

  const cardUrl = `/a/${slug}/card?format=${format}`;
  const downloadUrl = `${cardUrl}&dl=1`;

  const triggerClass =
    "border-2 border-[color:var(--b-line)] bg-[color:var(--b-card)] px-3 py-1.5 text-[13px] font-black uppercase tracking-wide text-[color:var(--b-ink)] hover:bg-[color:var(--b-acid)]";

  return (
    <>
      <button className={triggerClass} onClick={() => setOpen(true)}>
        Save as image
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:p-8"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-card)] text-[color:var(--b-ink)] shadow-[8px_8px_0_0_var(--b-shadow)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b-[3px] border-[color:var(--b-line)] bg-[color:var(--b-chrome)] px-4 py-3 text-[color:var(--b-card)]">
              <span className="font-display text-lg tracking-tight">SAVE AS IMAGE</span>
              <button onClick={() => setOpen(false)} aria-label="Close" className="text-xl font-black">×</button>
            </div>
            <div className="flex flex-col gap-4 p-4">
              <div className="flex gap-2">
                {(["story", "grid"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    className={`border-2 border-[color:var(--b-line)] px-3 py-1.5 font-mono text-[12px] font-bold uppercase tracking-wide ${
                      format === f
                        ? "bg-[color:var(--b-acid)] text-[color:var(--b-acid-ink)]"
                        : "bg-[color:var(--b-card)] text-[color:var(--b-ink)]"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <div className="flex justify-center border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-bg)] p-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- dynamic PNG from our own route */}
                <img
                  key={format}
                  src={cardUrl}
                  alt="Share card preview"
                  className={format === "story" ? "max-h-[50vh] w-auto" : "w-full"}
                />
              </div>
              <a
                href={downloadUrl}
                download
                className="border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-acid)] px-4 py-2 text-center font-black uppercase tracking-wide text-[color:var(--b-acid-ink)] shadow-[4px_4px_0_0_var(--b-shadow)]"
              >
                Download PNG
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
