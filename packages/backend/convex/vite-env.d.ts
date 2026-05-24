// Types the Vitest-injected `import.meta.glob` used by convex-test files. Declared
// self-contained (rather than referencing vite/client) because vite is only a
// transitive dependency here and isn't resolvable by name under pnpm.
interface ImportMeta {
  glob: (
    pattern: string | string[]
  ) => Record<string, () => Promise<unknown>>;
}
