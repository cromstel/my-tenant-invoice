/**
 * Rasterises the SVG illustration masters into the PNG files the site serves.
 *
 * The SVGs under `design/illustrations/` are the editable source of truth.
 * This script renders each one in Chromium and writes a lossless PNG to
 * `public/illustrations/`, where Next.js optimises it into WebP or AVIF on
 * the way to the browser.
 *
 * Usage: npm run render:illustrations
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { chromium } from '@playwright/test';

const SOURCE_DIR = path.join('design', 'illustrations');
const OUTPUT_DIR = path.join('public', 'illustrations');

const ILLUSTRATIONS = [
  'services-hero',
  'services-property-portfolio',
  'services-lease-management',
  'services-meter-consumption',
  'services-tariff-engine',
  'services-invoicing',
  'services-payments',
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

  await mkdir(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });

  try {
    for (const name of ILLUSTRATIONS) {
      const source = path.join(SOURCE_DIR, `${name}.svg`);

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

      const target = path.join(OUTPUT_DIR, `${name}.png`);
      await page.locator('svg').first().screenshot({ path: target });

      console.log(`${name}.png  ${width}x${height}`);
    }
  } finally {
    await browser.close();
  }
}

await main();
