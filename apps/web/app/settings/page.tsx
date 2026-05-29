import type { Metadata } from "next";
import { SiteHeader } from "../_components/site-header";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Edit profile — Annotated" };

export default function SettingsPage() {
  return (
    <main className="flex min-h-screen flex-1 flex-col bg-[color:var(--b-bg)] text-[color:var(--b-onbg)]">
      <SiteHeader />
      <section className="mx-auto w-full max-w-xl p-6">
        <h1 className="font-display text-3xl leading-none tracking-tight">Edit profile</h1>
        <p className="mt-2 font-mono text-[12px] uppercase tracking-[0.14em] text-[color:var(--b-dim-onbg)]">
          Name, photo & email live in your account menu
        </p>
        <SettingsForm />
      </section>
    </main>
  );
}
