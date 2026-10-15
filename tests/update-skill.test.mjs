import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { updateSkill } from '../scripts/update-skill.mjs';
async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'servicemap-update-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const root = join(dir, 'servicemap');
  await mkdir(root);
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'servicemap', version: '0.1.1' }));
  await writeFile(join(root, 'SKILL.md'), 'old');
  return { dir, root };
}
async function registry(args) {
  if (args[0] === 'view') return JSON.stringify('0.1.2');
  assert.ok(args.includes('--ignore-scripts'));
  const pkg = join(args[args.indexOf('--prefix') + 1], 'node_modules', 'servicemap');
  await mkdir(join(pkg, 'bin'), { recursive: true });
  await mkdir(join(pkg, 'scripts'));
  await writeFile(join(pkg, 'package.json'), JSON.stringify({ name: 'servicemap', version: '0.1.2' }));
  for (const file of ['SKILL.md', 'bin/servicemap.mjs', 'scripts/update-skill.mjs']) await writeFile(join(pkg, file), 'new');
}
test('updates a non-Git install through its existing symlink', async t => {
  const { dir, root } = await fixture(t);
  const link = join(dir, 'agent-skill');
  await symlink(root, link, 'dir');
  assert.match(await updateSkill(link, { runNpm: registry }), /Updated/);
  assert.equal(await readFile(join(link, 'SKILL.md'), 'utf8'), 'new');
});
test('failed download preserves installed skill and permits retry', async t => {
  const { root } = await fixture(t);
  await assert.rejects(updateSkill(root, { runNpm: async args => {
    if (args[0] === 'view') return '"0.1.2"';
    throw new Error('offline');
  } }), /offline/);
  assert.equal(await readFile(join(root, 'SKILL.md'), 'utf8'), 'old');
  assert.match(await updateSkill(root, { runNpm: registry }), /Updated/);
});
test('skips development checkouts', async t => {
  const { root } = await fixture(t);
  await mkdir(join(root, '.git'));
  assert.match(await updateSkill(root, { runNpm: () => { throw Error('must not fetch'); } }), /Skipped/);
});
test('does not downgrade a newer installed release', async t => {
  const { root } = await fixture(t);
  assert.match(await updateSkill(root, { runNpm: async () => '"0.1.0"' }), /current/);
  assert.equal(await readFile(join(root, 'SKILL.md'), 'utf8'), 'old');
});
test('incomplete package cannot replace working installation', async t => {
  const { root } = await fixture(t);
  await assert.rejects(updateSkill(root, { runNpm: async args => {
    const result = await registry(args);
    if (args[0] === 'install') await rm(join(args[args.indexOf('--prefix') + 1], 'node_modules/servicemap/SKILL.md'));
    return result;
  } }), /missing/);
  assert.equal(await readFile(join(root, 'SKILL.md'), 'utf8'), 'old');
});
