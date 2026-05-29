"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NAV_ITEMS } from "./left-nav";
import { ThemeToggle } from "../ThemeToggle";

/** Mobile-only (`lg:hidden`) hamburger that opens a brutalist left drawer with
 *  the section nav + theme toggle. On desktop the LeftNav rail covers this, so
 *  it's hidden. Closes on link tap, outside click, or Escape. */
export function MobileNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="border-2 border-[color:var(--b-acid)] px-2.5 py-1.5 text-[16px] font-black leading-none text-[color:var(--b-acid)] hover:bg-[color:var(--b-acid)] hover:text-[color:var(--b-acid-ink)]"
      >
        ☰
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] bg-black/60"
          onClick={() => setOpen(false)}
        >
          <nav
            className="flex h-full w-72 max-w-[80%] flex-col border-r-[3px] border-[color:var(--b-line)] bg-[color:var(--b-card)] text-[color:var(--b-ink)] shadow-[8px_0_0_0_var(--b-shadow)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b-[3px] border-[color:var(--b-line)] bg-[color:var(--b-chrome)] px-4 py-3 text-[color:var(--b-card)]">
              <span className="font-display text-lg tracking-tight">MENU</span>
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="text-xl font-black">
                ×
              </button>
            </div>

            {NAV_ITEMS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 border-b-2 border-[color:var(--b-line)] px-4 py-3.5 text-[15px] font-extrabold hover:bg-[color:var(--b-acid)]"
              >
                <span className="w-5 text-center">{item.glyph}</span>
                {item.label}
              </Link>
            ))}

            <div className="mt-auto border-t-[3px] border-[color:var(--b-line)] p-4">
              <ThemeToggle />
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
