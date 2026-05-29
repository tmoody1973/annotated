import type { Metadata } from "next";
import { AppShell } from "../_components/app-shell";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Edit profile — Annotated" };

export default function SettingsPage() {
  return (
    <AppShell narrow>
      <h1 className="font-display text-3xl leading-none tracking-tight">Edit profile</h1>
      <p className="mt-2 font-mono text-[12px] uppercase tracking-[0.14em] text-[color:var(--b-dim-onbg)]">
        Name, photo & email live in your account menu
      </p>
      <SettingsForm />
    </AppShell>
  );
}
