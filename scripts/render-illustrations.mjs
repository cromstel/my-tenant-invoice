/**
 * Rasterises the SVG illustration masters into the PNG files the site serves.
 *
 * The SVGs under `design/illustrations/` are the editable source of truth.
 * This script renders each one in Chromium, then lossily compresses the PNG
 * (palette quantisation) before writing it into the public directory that
 * serves it, keeping every asset inside the size budget documented in
 * `docs/06-ui-ux/image-guidelines.md`. Next.js re-optimises into WebP or AVIF
 * on the way to the browser.
 *
 * Two groups are rendered. Page illustrations are served from
 * `public/illustrations/`. Team portraits are served from `public/team/`,
 * because they are consumed separately and are easier to find there; their
 * masters keep a `team-` prefix that the served filename drops.
 *
 * Usage: npm run render:illustrations
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { chromium } from '@playwright/test';
import sharp from 'sharp';

const SOURCE_DIR = path.join('design', 'illustrations');

/** Palette-quantisation settings; empirically q90 is both smaller and more
 * faithful than lower tiers (sharp's palette mode is not monotonic). */
const PNG_OPTIONS = { palette: true, quality: 90, effort: 10 };

/** Lossily compresses a rendered PNG buffer in place of a lossless write. */
async function optimise(buffer) {
  return sharp(buffer).png(PNG_OPTIONS).toBuffer();
}

const GROUPS = [
  {
    outputDir: path.join('public', 'illustrations'),
    illustrations: [
      'services-hero',
      'services-property-portfolio',
      'services-lease-management',
      'services-meter-consumption',
      'services-tariff-engine',
      'services-invoicing',
      'services-payments',
      'about-hero',
      'about-auditor',
    ],
  },
  {
    outputDir: path.join('public', 'team'),
    sourcePrefix: 'team-',
    illustrations: [
      'platform-engineering',
      'product-design',
      'security-compliance',
      'billing-engineering',
      'integrations',
      'customer-success',
    ],
  },
];

/** Reads the canvas size from the SVG viewBox, which is the authoritative one. */
function readCanvas(svg) {
  const match = svg.match(/viewBox\s*=\s*"[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)"/);

  if (!match) {
    throw new Error('SVG has no parseable viewBox');
  }

  return { width: Math.round(Number(match[1])), height: Math.round(Number(match[2])) };
}

async function main() {
  if (!existsSync(SOURCE_DIR)) {
    throw new Error(`Missing source directory: ${SOURCE_DIR}`);
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });

  try {
    for (const group of GROUPS) {
      await mkdir(group.outputDir, { recursive: true });

      for (const name of group.illustrations) {
        const source = path.join(SOURCE_DIR, `${group.sourcePrefix ?? ''}${name}.svg`);

        if (!existsSync(source)) {
          throw new Error(`Missing illustration source: ${source}`);
        }

        const svg = await readFile(source, 'utf8');
        const { width, height } = readCanvas(svg);

        await page.setViewportSize({ width, height });
        await page.setContent(
          `<!doctype html><html><body style="margin:0;padding:0;overflow:hidden">${svg}</body></html>`,
          { waitUntil: 'load' },
        );

        const target = path.join(group.outputDir, `${name}.png`);
        const rendered = await page.locator('svg').first().screenshot();
        const optimised = await optimise(rendered);
        await writeFile(target, optimised);

        console.log(`${target}  ${width}x${height}  ${(optimised.length / 1024).toFixed(1)} KiB`);
      }
    }
  } finally {
    await browser.close();
  }
}

await main();
