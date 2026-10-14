import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, realpath, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const cli = fileURLToPath(new URL('../bin/servicemap.mjs', import.meta.url));
test('desktop generation installs and starts Tauri in the generated directory, reporting launch failures', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'servicemap launch ')));
  try {
    const bin = join(root, 'mock-bin');
    const log = join(root, 'calls.jsonl');
    await mkdir(bin);
    await writeFile(join(bin, 'npm'), `#!${process.execPath}
import { appendFileSync } from 'node:fs';
appendFileSync(process.env.LAUNCH_LOG, JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd() }) + '\\n');
process.exit(process.argv.includes('tauri') ? 23 : 0);
`, { mode: 0o755 });
    const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, LAUNCH_LOG: log };
    const run = (...args) => spawnSync(process.execPath, [cli, 'generate', '--root', root, '--mode', 'desktop', ...args], { env, encoding: 'utf8', timeout: 5000 });
    for (const flag of ['--dry-run', '--no-open']) {
      assert.equal(run(flag).status, 0);
      await assert.rejects(readFile(log), { code: 'ENOENT' });
    }
    const result = run();
    const calls = (await readFile(log, 'utf8')).trim().split('\n').map(JSON.parse);
    assert.deepEqual(calls, [
      { args: ['install'], cwd: join(root, 'servicemap-desktop') },
      { args: ['run', 'tauri', 'dev'], cwd: join(root, 'servicemap-desktop') },
    ]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /23/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
