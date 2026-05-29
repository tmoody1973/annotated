"use client";

import Link from "next/link";
import type { ReactNode } from "react";

/** A single install-CTA anchor that picks the right link semantics: an external
 *  store URL opens in a new tab; the internal /extension fallback uses Next
 *  routing. Every extension touchpoint (nav, modal, page) renders through this
 *  so the target/rel handling lives in exactly one place. */
export function ExtensionCta({
  href,
  className,
  children,
  ariaLabel,
}: {
  href: string;
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
}) {
  const isExternal = /^https?:\/\//.test(href);

  if (isExternal) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        aria-label={ariaLabel}
      >
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={className} aria-label={ariaLabel}>
      {children}
    </Link>
  );
}
