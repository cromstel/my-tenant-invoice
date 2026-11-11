# Illustrations

The SVG files in this folder are the editable masters for every illustration on
the marketing site. They are the source of truth; the PNG files the site
actually serves are generated from them.

## Rendering

```bash
npm run render:illustrations
```

The script (`scripts/render-illustrations.mjs`) opens each SVG in Chromium and
writes a lossless PNG to `public/illustrations/`. Next.js then serves those
PNGs as WebP or AVIF, sized to the requesting device.

Re-run the script after editing an SVG, and commit both the master and the
rendered PNG so the diff shows what changed.

## Why raster rather than inline SVG

The illustrations are rendered to PNG so the page pays for them as ordinary
image assets: the browser caches them, they cannot interfere with the page's
own markup, and they can be swapped for artwork produced by a different tool
without touching a single line of page code. Drop a PNG with the same name
into `public/illustrations/` and it will be picked up.

## Rules for editing

- **No text.** No `<text>` elements and no letterforms drawn as paths. Type in
  an illustration cannot be translated, read by assistive technology or
  selected, so it has to stay out.
- **No filters.** `feGaussianBlur` rasterises slowly and inconsistently.
  Suggest depth with flat shapes in a low-opacity dark colour instead.
- **Self-contained.** No external references, no web fonts, no scripts. An
  illustration must render identically wherever it is placed.
- **Keep the palette.** The colours below are the brand palette; the
  illustrations read as one set because they share it.

| Role | Colour |
| --- | --- |
| Primary (navy) | `#143694` |
| Azure | `#3b82f6` |
| Sky | `#93c5fd` |
| Ice | `#dbeafe` |
| Mist / Paper | `#f1f5f9` / `#f8fafc` |
| Slate scale | `#0f172a` `#334155` `#64748b` `#cbd5e1` |
| Amber (single accent only) | `#f59e0b` |

Every illustration sits on a light background, so the page places each one on
a fixed white surface rather than the themed card colour.
