import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

// Resolve the dev server port. An explicit PORT env var wins (CI, containers),
// then .env.local, then the Next.js default.
function getPort() {
  if (process.env.PORT) {
    return process.env.PORT;
  }
  try {
    const envPath = resolve(process.cwd(), '.env.local');
    const content = readFileSync(envPath, 'utf-8');
    const match = content.match(/^PORT\s*=\s*["']?(\d+)["']?/m);
    if (match?.[1]) {
      return match[1];
    }
  } catch {
    // No .env.local - fall through to the default
  }
  return '3000';
}

const port = getPort();
console.log(`[dev] Starting Next.js dev server on port ${port}`);

// Spawn the Next.js CLI through Node directly so the script runs on Windows,
// macOS and Linux alike (no cmd.exe or .cmd shims).
const nextBin = resolve(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');
const child = spawn(process.execPath, [nextBin, 'dev', '-p', port], {
  stdio: 'inherit',
  env: { ...process.env },
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
