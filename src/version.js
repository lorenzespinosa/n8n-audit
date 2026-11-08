import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

let cached = null;

/**
 * Read the version from package.json. Falls back to the shipped constant
 * when the file is not reachable (for example when bundled elsewhere).
 */
export function getVersion() {
  if (cached) return cached;
  try {
    const pkgPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
    cached = String(JSON.parse(readFileSync(pkgPath, 'utf8')).version || '0.1.0');
  } catch {
    cached = '0.1.0';
  }
  return cached;
}
