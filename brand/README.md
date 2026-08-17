# Brand

The identity was never designed in a document — it grew in `globals.css` and the
site header. This folder writes it down and makes the assets reproducible.

| File | What it is |
|---|---|
| `brand-kit.html` | The kit. Open it in a browser; it is rendered in the system it documents. |
| `mark.html` | The mark's source — real Archivo Black, real tokens. |
| `render.mjs` | Screenshots `mark.html` headlessly. |
| `mark-1024.png` | The master export. |

## The mark

The wordmark is `ANNOTATED` with an acid block struck over the `A`. That block is
a highlighter stroke, which is the product, so the icon is the block on its own.
The keyline is part of the mark: without it the acid square vanishes into a light
browser tab strip.

## Regenerating

```bash
node brand/render.mjs "$PWD/brand/mark.html" brand/mark-1024.png 1024
```

Then resize into `apps/web/app/{favicon.ico,icon.png,apple-icon.png}` and
`apps/extension/assets/icon.png`. The font paths inside `mark.html` point at
`apps/web/.next/static/media/*.woff2`, so run a web build first if they are stale.

## What was replaced

Both icons were placeholders that had shipped: the favicon was a default black
circle with a white triangle, and the extension icon was Plasmo's purple gradient
blob — which was live in the Chrome Web Store.
