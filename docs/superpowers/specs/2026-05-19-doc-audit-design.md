# Doc Audit Design

**Date:** 2026-05-19
**Scope:** ARCHITECTURE.md, BUILD-INTENT.md, SETUP.md, CLAUDE.md
**Approach:** Goal-driven — every finding must answer "does this block or mislead someone building the product?"

---

## Audit Dimensions

Seven dimensions, applied across all four docs:

1. **Missing files** — SPEC.md and schema.ts are referenced in CLAUDE.md but do not exist. Must be created.
2. **Broken internal cross-references** — links or references between docs that point to nonexistent sections or files.
3. **Cross-doc contradictions** — stack, env var names, service names, or behavior described differently across docs.
4. **Step 1 blockers** — is the first thing someone needs to do clear and achievable? No chicken-and-egg dependencies in the build order.
5. **Stack inconsistency** — CLAUDE.md, ARCHITECTURE.md, and SETUP.md all describe the stack; they must agree.
6. **Scope drift** — anything described in the docs that was cut as a non-goal, or a non-goal that got back into the design.
7. **Spec coverage** — does the existing docs cover all hard requirements from the bounty spec? Flag anything not addressed.

---

## Output Format

Findings are written to `docs/audit/2026-05-19-doc-audit.md`.

Each finding:

```
### [BLOCKER|WARNING|MINOR] <short title>
Doc: <filename>, <section>
Issue: <what is wrong>
Fix: <what to do>
```

**Severity definitions:**
- **BLOCKER** — someone cannot build without this resolved. Fix immediately.
- **WARNING** — produces confusion or wasted work; not immediately fatal. Apply after review.
- **MINOR** — clarity or polish. Apply after review.

---

## Fix Strategy

- **Blockers:** Fixed inline in the relevant doc as part of the audit run. Net-new files (SPEC.md, schema.ts) drafted in full — not just noted as missing.
- **Warnings and Minors:** Listed in the audit doc. Applied only after Tarik has reviewed and approved each one.
- **No docs deleted or renamed.** All fixes are edits to existing files or additions of new files.

---

## Definition of Done

1. All seven dimensions checked across all four docs.
2. Audit findings written to `docs/audit/2026-05-19-doc-audit.md` with every finding classified.
3. All Blockers resolved — doc edits applied, missing files created.
4. Tarik has reviewed the Warning/Minor list and approved or dismissed each item.
5. All applied fixes committed to git.

**Outcome:** Docs are in a state where Step 1 of the build (Convex schema deployed) can begin without ambiguity.
