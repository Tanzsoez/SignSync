import assert from 'node:assert/strict';
import { readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

const DIST_ROOT = 'dist';
const TOTAL_BUDGET_BYTES = 4_500_000;
const JAVASCRIPT_CHUNK_BUDGET_BYTES = 1_200_000;

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  }));
  return nested.flat();
}

const files = await listFiles(DIST_ROOT);
const sizes = await Promise.all(files.map(async (path) => ({
  path: relative(DIST_ROOT, path),
  bytes: (await stat(path)).size,
})));
const totalBytes = sizes.reduce((sum, file) => sum + file.bytes, 0);
const oversizedChunks = sizes.filter((file) => (
  file.path.endsWith('.js') && file.bytes > JAVASCRIPT_CHUNK_BUDGET_BYTES
));

assert.ok(
  totalBytes <= TOTAL_BUDGET_BYTES,
  `Production bundle is ${totalBytes} bytes; budget is ${TOTAL_BUDGET_BYTES}`,
);
assert.deepEqual(
  oversizedChunks,
  [],
  `JavaScript chunk budget exceeded: ${JSON.stringify(oversizedChunks)}`,
);

console.log(`Bundle budget passed: ${totalBytes} / ${TOTAL_BUDGET_BYTES} bytes`);
