"use client";

import { useEffect, useState } from "react";
import {
  browserLabel,
  classifyBrowser,
  type BrowserKind,
  type DetectedBrowser,
} from "@annotated/shared";

/** Real store listing once published; until then every install CTA routes to
 *  the /extension page, which explains install + the manual paste fallback. */
const STORE_URL = process.env.NEXT_PUBLIC_EXTENSION_URL || "/extension";

export interface BrowserInfo extends DetectedBrowser {
  /** Where the install CTA points (real store link or the /extension page). */
  storeUrl: string;
  /** False until the client has read the real user agent (SSR-safe). */
  detected: boolean;
}

// Server and first client render share this neutral value so hydration matches;
// the real UA is read in an effect right after mount.
const SSR_DEFAULT: BrowserInfo = {
  ...classifyBrowser(""),
  storeUrl: STORE_URL,
  detected: false,
};

type BraveNavigator = Navigator & { brave?: { isBrave?: () => Promise<boolean> } };

/** Reads the current browser and returns the matching install CTA. Renders a
 *  neutral default during SSR, then upgrades to the detected browser on mount
 *  (including Brave, which is indistinguishable from Chrome by UA alone). */
export function useBrowserInfo(): BrowserInfo {
  const [info, setInfo] = useState<BrowserInfo>(SSR_DEFAULT);

  useEffect(() => {
    let active = true;
    const base = classifyBrowser(navigator.userAgent);
    const commit = (kind: BrowserKind = base.kind) => {
      if (active) {
        setInfo({ ...base, kind, label: browserLabel(kind), storeUrl: STORE_URL, detected: true });
      }
    };

    const brave = (navigator as BraveNavigator).brave;
    if (base.kind === "chrome" && typeof brave?.isBrave === "function") {
      brave
        .isBrave()
        .then((isBrave) => commit(isBrave ? "brave" : "chrome"))
        .catch(() => commit());
    } else {
      commit();
    }

    return () => {
      active = false;
    };
  }, []);

  return info;
}
