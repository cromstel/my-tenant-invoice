import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const FONT_DIR = path.join(process.cwd(), 'src', 'app', 'fonts');
const LAYOUT = path.join(process.cwd(), 'src', 'app', 'layout.tsx');

const WOFF2_FONTS = ['inter-latin-variable.woff2', 'jetbrains-mono-latin-variable.woff2'] as const;

const WOFF2_MAGIC = 'wOF2';

describe('self-hosted fonts', () => {
  it.each(WOFF2_FONTS)('ships %s as a real woff2 file', (name) => {
    const file = path.join(FONT_DIR, name);

    expect(statSync(file).size).toBeGreaterThan(1000);

    const header = readFileSync(file).subarray(0, 4).toString('ascii');

    expect(header).toBe(WOFF2_MAGIC);
  });

  it('keeps the font licenses beside the files', () => {
    for (const license of ['LICENSE-Inter.txt', 'LICENSE-JetBrainsMono.txt']) {
      expect(statSync(path.join(FONT_DIR, license)).size).toBeGreaterThan(500);
    }
  });

  it('does not download fonts from Google at build time', () => {
    // A regression guard: next/font/google turns every build into a network
    // request, and an offline build fails outright.
    const source = readFileSync(LAYOUT, 'utf8');

    expect(source).not.toContain('next/font/google');
    expect(source).toContain("from 'next/font/local'");
  });

  it('points the layout at the committed font files', () => {
    const source = readFileSync(LAYOUT, 'utf8');

    for (const font of WOFF2_FONTS) {
      expect(source).toContain(font);
    }
  });

  it('keeps the CSS variables the theme tokens depend on', () => {
    const source = readFileSync(LAYOUT, 'utf8');

    expect(source).toContain('--font-inter');
    expect(source).toContain('--font-jetbrains-mono');
  });
});
