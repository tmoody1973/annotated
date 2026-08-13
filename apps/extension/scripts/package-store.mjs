/**
 * Builds the Chrome Web Store package: the normal production build with the
 * `key` field stripped from its manifest.
 *
 * The two distribution routes want opposite things here. The sideloaded build
 * needs `key` so it gets a *stable* extension id — that id is registered in
 * Clerk's allowed origins, and without the key Chrome derives an id from the
 * folder path and it changes. The store refuses the same field outright:
 *
 *   "key field is not allowed in manifest."
 *
 * Google assigns the id itself, so it rejects any package that tries to pin
 * one. Hence two zips from one build.
 *
 * Usage: pnpm package:store   →   build/chrome-mv3-store.zip
 */
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const buildDir = resolve(import.meta.dirname, "..", "build");
const source = join(buildDir, "chrome-mv3-prod");
const output = join(buildDir, "chrome-mv3-store.zip");

const staging = mkdtempSync(join(tmpdir(), "annotated-store-"));
const packageDir = join(staging, "package");

try {
  cpSync(source, packageDir, { recursive: true });

  const manifestPath = join(packageDir, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (!("key" in manifest)) {
    console.warn("note: no `key` in the built manifest — nothing to strip.");
  }
  delete manifest.key;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  rmSync(output, { force: true });
  // Zip the *contents*, not the folder — the store wants the manifest at the root.
  execFileSync("zip", ["-qr", output, "."], { cwd: packageDir });

  const verify = execFileSync("unzip", ["-p", output, "manifest.json"], { encoding: "utf8" });
  const packaged = JSON.parse(verify);
  if ("key" in packaged) throw new Error("`key` survived into the store package");

  console.log(`store package: ${output}`);
  console.log(`  version ${packaged.version} · permissions ${packaged.permissions.join(", ")}`);
  console.log("  key: absent (required — the store rejects the field)");
} finally {
  rmSync(staging, { recursive: true, force: true });
}
