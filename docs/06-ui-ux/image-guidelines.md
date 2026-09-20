# Image Guidelines

> Mandatory `.webp` format · responsive `srcset` · lazy-load below the fold · alt text requirements.

---

## 1. Format & Encoding

**Only `.webp` is allowed** in user-facing production bundles (marketing, portal, dashboard). Exceptions:

- Favicons / PWA icons may ship `.ico` + multi-res PNG as required by spec.
- Customer-uploaded logos accept `.png`, `.jpg`, `.svg` on upload but are **transcoded to `.webp` server-side** before delivery.

### 1.1 Encoding Profile

Use `sharp` for all server-side transcoding. Encode at quality 80 with effort 6 (balance) for photographic content, lossless for UI illustrations.

```ts
// scripts/encode-images.mjs
import sharp from "sharp";
import { glob } from "glob";

for (const f of await glob("public/images/raw/*.{png,jpg,jpeg}")) {
  const out = f.replace("/raw/", "/").replace(/\.(png|jpe?g)$/, ".webp");
  await sharp(f)
    .webp({ quality: 80, effort: 6, smartSubsample: true })
    .toFile(out);
  console.log("✓", out);
}

// Customer upload — next.js server action
"use server";
import sharp from "sharp";

export async function uploadLogo(form: FormData) {
  const file = form.get("file") as File;
  if (!file.type.startsWith("image/")) throw new Error("Not an image");
  const buffer = Buffer.from(await file.arrayBuffer());
  const converted = await sharp(buffer)
    .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ lossless: true })
    .toBuffer();
  await storage.put(`orgs/${orgId}/logo.webp`, converted, { contentType: "image/webp" });
}
```

### 1.2 Lighthouse Targets

- Largest Contentful Paint image (hero) should be served in `<100KB` at `xl` breakpoint.
- All marketing illustrations ≤ 150KB per image.
- Customer logos ≤ 32KB.

---

## 2. Dimensions — Canonical Sizes

### 2.1 Marketing

| Slot                 | Base (1x)       | 2x retina       | Aspect  | Usage                                    |
|----------------------|-----------------|-----------------|---------|------------------------------------------|
| Hero background      | 2400 × 1350     | 4800 × 2700     | 16:9    | `/` landing page gradient + shape overlay |
| Feature illustration | 1200 × 900      | 2400 × 1800     | 4:3     | `/features` card art                     |
| Pricing iconography  | 640 × 480       | 1280 × 960      | 4:3     | Decorative per-tier                      |
| Team headshot        | 480 × 480       | 960 × 960       | 1:1     | `/about` team grid                       |
| Customer logo        | 320 × 120       | 640 × 240       | ~8:3    | Social proof strip, grayscale            |
| Open Graph / social  | 1200 × 630      | —               | 1.91:1  | `og:image`, Twitter card                 |

### 2.2 Platform / Portal

| Slot                 | Max rendered size | 2x asset size  | Aspect |
|----------------------|-------------------|----------------|--------|
| Org sidebar logo     | 160 × 40          | 320 × 80       | 4:1    |
| Customer portal logo | 200 × 60          | 400 × 120      | ~3.3:1 |
| Avatar (profile)     | 40 / 96 px circle | 192 × 192      | 1:1    |
| Empty state art      | 256 × 256         | 512 × 512      | 1:1    |
| Invoice PDF watermark| 180 × 36          | 360 × 72       | 5:1    |

---

## 3. HTML Patterns

### 3.1 Marketing Hero (LCP, priority, no lazy-load)

Use `next/image` with `priority` + `quality=90` to optimize LCP:

```tsx
import Image from "next/image";
import heroWebp from "@/public/images/hero.webp";

export function Hero() {
  return (
    <div className="relative">
      <Image
        src={heroWebp}
        alt=""
        aria-hidden
        priority
        quality={90}
        sizes="100vw"
        fill
        className="object-cover object-center opacity-60"
      />
      <div className="relative container ...">
        {/* Hero copy */}
      </div>
    </div>
  );
}
```

### 3.2 Card Art (responsive srcset, lazy-load)

```tsx
<Image
  src="/images/features/automation.webp"
  alt="Software dashboard showing automated invoice batches"
  width={1200}
  height={900}
  quality={80}
  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
  className="rounded-xl border object-cover"
/>
```

### 3.3 Raw `<img>` Fallback (if ever needed outside next/image)

```html
<img
  src="/images/team/priya.webp"
  srcset="/images/team/priya.webp 480w, /images/team/priya@2x.webp 960w"
  sizes="(min-width: 768px) 12rem, 100vw"
  alt="Priya Subramaniam, Head of Finance at CromStel Commercial"
  width="480"
  height="480"
  loading="lazy"
  decoding="async"
/>
```

---

## 4. Lazy-Load Rules

- **Above-the-fold LCP image** → `priority` on `next/image` (no lazy).
- **Everything else** → default `next/image` behavior (`loading="lazy"` + `decoding="async"`).
- **`<iframe>` embeds** (maps, demo videos) → `loading="lazy"` explicitly.
- **Infinite scroll lists** → native `loading="lazy"` + IntersectionObserver prefetch 1 row ahead.

### 4.1 DataTable Avatar Column

```tsx
// Column def in a TanStack table
columnHelper.display({
  id: "avatar",
  cell: ({ row }) => (
    <div className="flex items-center gap-3">
      <Image
        src={row.original.avatarUrl ?? "/images/avatar-default.webp"}
        alt=""
        width={40}
        height={40}
        className="rounded-full object-cover"
        loading="lazy"
      />
      <span className="font-medium">{row.original.name}</span>
    </div>
  ),
});
```

---

## 5. Alt Text Rules

### 5.1 When `alt=""` (empty, decorative)

Mark explicitly when the image is pure decoration:

- Gradient blobs / abstract shapes
- CSS-accompanying dividers
- Icon-only treatments already paired with a text label

```tsx
<Image src="/shapes/blob.webp" alt="" aria-hidden className="..." />
```

### 5.2 When to write descriptive alt

- Marketing illustrations — describe action/outcome, not visuals.
  - Good: "Platform dashboard showing 30-day revenue chart and paid invoices"
  - Bad: "Purple and blue graphic with bars"
- Product screenshots — include the UI state being shown.
- Team photos — use the person's full name and job title.
- Customer logos — use the company name (no "logo of X"; "CromStel IT Group").

### 5.3 No Images of Text

Per WCAG 1.4.5 (AA). Promotional banners must use HTML text + CSS gradients over a background image.

```tsx
<div className="relative rounded-2xl border bg-primary/5 p-8 sm:p-12">
  <Image src="/images/mesh.webp" alt="" aria-hidden fill className="object-cover opacity-70 mix-blend-multiply" />
  <div className="relative max-w-xl">
    <h2 className="text-fluid-h2 font-bold">Reconcile rent in 3 minutes, not 3 days.</h2>
    <p className="mt-3 text-lg text-muted-foreground">...</p>
  </div>
</div>
```

---

## 6. Asset CDN & Cache Headers

Static assets under `/public/*` are served by Next.js with immutable headers. Customer uploads (org logos, attachments) go through `/api/media/*` route with:

```
Cache-Control: public, max-age=31536000, immutable
CDN-Cache-Control: public, max-age=31536000
ETag: {xxhash of bytes}
Vary: Accept
```

Request flow adds `?v={hash}` URL param whenever a user re-uploads a replacement logo, to bust cache instantly.

---

## 7. Pre-commit Lint

A repo-level check blocks commits of non-webp images into `public/images/`:

```bash
# .husky/pre-commit
npx --yes lint-staged
```

```jsonc
// lint-staged.config.js
module.exports = {
  "public/images/**/*.{png,jpg,jpeg}": () => {
    throw new Error("Commit only .webp into public/images. Run `pnpm images:encode` first.");
  },
};
```
