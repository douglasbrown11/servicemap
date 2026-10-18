import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const cli = fileURLToPath(new URL('../bin/servicemap.mjs', import.meta.url));
const read = (root, path) => readFile(join(root, path), 'utf8');
const write = (root, path, value) => writeFile(join(root, path), value);
function run(root, ...args) {
  return spawnSync(process.execPath, [cli, ...args, '--root', root], { encoding: 'utf8' });
}
function ok(result) { assert.equal(result.status, 0, result.stdout + result.stderr); }
test('CLI refresh adds services, preserves customizations, and checks freshness without writes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'servicemap-refresh-'));
  try {
    await write(root, 'package.json', JSON.stringify({ name: 'example', dependencies: { stripe: '*' } }));
    await write(root, 'AGENTS.md', '# Existing instructions\nKeep this.\n');
    ok(run(root, 'generate', '--mode', 'desktop', '--no-open', '--no-deploy'));
    const dataPath = '.servicemap/internal-servicemap.json';
    const uiPath = 'servicemap-desktop/src/ServiceMap.tsx';
    const graph = JSON.parse(await read(root, dataPath));
    graph.services.find(s => s.id === 'stripe').notes = 'Keep billing owner';
    graph.access = { allowedEmails: ['owner@example.com'], requested: true };
    await write(root, dataPath, JSON.stringify(graph, null, 2) + '\n');
    const customUI = (await read(root, uiPath)).replace('const css = ', '// Custom UI stays\nconst css = ');
    await write(root, uiPath, customUI);
    await write(root, 'package.json', JSON.stringify({ name: 'example', dependencies: { stripe: '*', resend: '*' } }));
    const before = await read(root, dataPath);
    const stale = run(root, 'refresh', '--check');
    assert.equal(stale.status, 1, stale.stdout + stale.stderr);
    assert.match(stale.stdout + stale.stderr, /stale/i);
    assert.equal(await read(root, dataPath), before);
    assert.equal(await read(root, uiPath), customUI);
    ok(run(root, 'refresh'));
    const updated = JSON.parse(await read(root, dataPath));
    assert.ok(updated.services.some(s => s.id === 'resend'));
    assert.equal(updated.services.find(s => s.id === 'stripe').notes, 'Keep billing owner');
    assert.deepEqual(updated.access, graph.access);
    assert.match(await read(root, uiPath), /Custom UI stays/);
    assert.match(await read(root, uiPath), /"id":"resend"/);
    assert.match(await read(root, 'AGENTS.md'), /Keep this\./);
    assert.match(await read(root, 'AGENTS.md'), /servicemap@[^ ]+ refresh/);
    assert.match(await read(root, '.github/workflows/servicemap-freshness.yml'), /refresh --check/);
    const stable = await read(root, dataPath);
    const stableUI = await read(root, uiPath);
    ok(run(root, 'refresh', '--check'));
    ok(run(root, 'refresh'));
    assert.equal(await read(root, dataPath), stable);
    assert.equal(await read(root, uiPath), stableUI);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('removed integrations disappear without self-detection; annotated/manual services survive', async () => {
  const root = await mkdtemp(join(tmpdir(), 'servicemap-removal-'));
  try {
    await write(root, 'package.json', JSON.stringify({ name: 'example', dependencies: { stripe: '*', resend: '*' } }));
    ok(run(root, 'generate', '--mode', 'page', '--no-open', '--no-deploy'));
    const path = '.servicemap/internal-servicemap.json';
    const graph = JSON.parse(await read(root, path));
    graph.services.find(s => s.id === 'stripe').notes = 'Historical billing owner';
    graph.services.push({ id: 'custom', key: 'custom', name: 'Private API', manual: true, notes: 'Keep me' });
    await write(root, path, JSON.stringify(graph));
    const html = await read(root, 'public/internalservicemap.html');
    await write(root, 'public/internalservicemap.html', html.replace('</head>', '<!-- Custom branding -->\n</head>'));
    await write(root, 'package.json', JSON.stringify({ name: 'example', dependencies: {} }));
    ok(run(root, 'refresh'));
    const next = JSON.parse(await read(root, path));
    assert.ok(!next.services.some(s => s.id === 'resend'));
    assert.equal(next.services.find(s => s.id === 'stripe').detected, false);
    assert.equal(next.services.find(s => s.id === 'custom').notes, 'Keep me');
    assert.match(await read(root, 'public/internalservicemap.html'), /Custom branding/);
    ok(run(root, 'refresh', '--check'));
    ok(run(root, 'refresh'));
    ok(run(root, 'refresh', '--check'));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('conflicting generated data aborts without changing any map file', async () => {
  const root = await mkdtemp(join(tmpdir(), 'servicemap-conflict-'));
  try {
    await write(root, 'package.json', '{"name":"example","dependencies":{"stripe":"*"}}');
    ok(run(root, 'generate', '--mode', 'desktop', '--no-open', '--no-deploy'));
    const path = 'servicemap-desktop/src/ServiceMap.tsx';
    const custom = (await read(root, path)).replace('"name":"Stripe"', '"name":"Custom billing"');
    await write(root, path, custom);
    await write(root, 'package.json', '{"name":"example","dependencies":{"stripe":"*","resend":"*"}}');
    const files = ['.servicemap/internal-servicemap.json', '.servicemap/refresh-state.json', path, 'servicemap-desktop/src/servicemap-data.json'];
    const before = await Promise.all(files.map(file => read(root, file)));
    const result = run(root, 'refresh');
    assert.equal(result.status, 1);
    assert.match(result.stderr, /customized directly/);
    assert.deepEqual(await Promise.all(files.map(file => read(root, file))), before);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('legacy maps adopt refresh state; checks are portable across checkout paths', async () => {
  const { cp } = await import('node:fs/promises');
  const root = await mkdtemp(join(tmpdir(), 'servicemap-legacy-'));
  const other = await mkdtemp(join(tmpdir(), 'servicemap-ci-'));
  try {
    await write(root, 'package.json', '{"name":"example","dependencies":{"stripe":"*"}}');
    ok(run(root, 'generate', '--mode', 'desktop', '--no-open', '--no-deploy'));
    await rm(join(root, '.servicemap/refresh-state.json'));
    await write(root, 'package.json', '{"name":"example","dependencies":{"stripe":"*","resend":"*"}}');
    ok(run(root, 'refresh'));
    assert.ok(JSON.parse(await read(root, '.servicemap/internal-servicemap.json')).services.some(s => s.id === 'resend'));
    await cp(root, other, { recursive: true });
    await write(other, 'unrelated.txt', 'A file unrelated to integrations.');
    ok(run(other, 'refresh', '--check'));
    const before = await read(other, '.servicemap/internal-servicemap.json');
    ok(run(other, 'refresh'));
    assert.equal(await read(other, '.servicemap/internal-servicemap.json'), before);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(other, { recursive: true, force: true });
  }
});

for (const framework of ['next', 'astro', 'clerk']) {
  test(`${framework} web map keeps custom styling and access code when a service is added`, async () => {
    const { mkdir } = await import('node:fs/promises');
    const root = await mkdtemp(join(tmpdir(), `servicemap-${framework}-`));
    try {
      const dependencies = { stripe: '*', ...(framework === 'astro' ? { astro: '*' } : { next: '*' }),
        ...(framework === 'clerk' ? { '@clerk/nextjs': '*' } : {}) };
      if (framework !== 'astro') await mkdir(join(root, 'app'));
      await write(root, 'package.json', JSON.stringify({ name: 'example', dependencies }));
      ok(run(root, 'generate', '--mode', 'page', '--no-open', '--no-deploy', '--allow-email', 'owner@example.com'));
      const ui = framework === 'astro' ? 'src/pages/internalservicemap.astro' : 'app/internalservicemap/page.tsx';
      await write(root, ui, (await read(root, ui)).replace('const css = ', '// Custom styling\nconst css = '));
      const pkg = JSON.parse(await read(root, 'package.json'));
      pkg.dependencies.resend = '*';
      await write(root, 'package.json', JSON.stringify(pkg));
      ok(run(root, 'refresh'));
      const output = await read(root, ui);
      assert.match(output, /Custom styling/);
      assert.match(output, /Resend/);
      if (framework === 'clerk') {
        assert.match(output, /if \(!canView\) notFound\(\)/);
        assert.match(output, /const allowedEmails = \["owner@example.com"\]/);
      }
      ok(run(root, 'refresh', '--check'));
    } finally { await rm(root, { recursive: true, force: true }); }
  });
}

test('legacy inline edits are never silently overwritten', async () => {
  const root = await mkdtemp(join(tmpdir(), 'servicemap-legacy-custom-'));
  try {
    await write(root, 'package.json', '{"name":"example","dependencies":{"stripe":"*"}}');
    ok(run(root, 'generate', '--mode', 'page', '--no-open', '--no-deploy'));
    await rm(join(root, '.servicemap/refresh-state.json'));
    const ui = 'public/internalservicemap.html';
    const customized = (await read(root, ui)).replace('Stripe', 'Our payment provider');
    await write(root, ui, customized);
    const result = run(root, 'refresh');
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Legacy map data differs/);
    assert.equal(await read(root, ui), customized);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('repository setup preserves existing instructions and CI and is idempotent', async () => {
  const { mkdir, stat } = await import('node:fs/promises');
  const root = await mkdtemp(join(tmpdir(), 'servicemap-instructions-'));
  try {
    await write(root, 'package.json', '{"name":"example","dependencies":{"stripe":"*"}}');
    await mkdir(join(root, '.github/workflows'), { recursive: true });
    await write(root, 'CLAUDE.md', '@AGENTS.md\nCustom instructions.\n');
    await write(root, '.github/workflows/servicemap-freshness.yml', '# Existing user workflow\n');
    ok(run(root, 'generate', '--mode', 'desktop', '--no-open', '--no-deploy'));
    assert.match(await read(root, 'CLAUDE.md'), /^@AGENTS.md\nCustom instructions\./);
    assert.equal(await read(root, '.github/workflows/servicemap-freshness.yml'), '# Existing user workflow\n');
    const files = ['AGENTS.md', 'CLAUDE.md', '.github/copilot-instructions.md', '.servicemap/internal-servicemap.json', '.servicemap/refresh-state.json', 'servicemap-desktop/src/ServiceMap.tsx'];
    const times = await Promise.all(files.map(async file => (await stat(join(root, file))).mtimeMs));
    ok(run(root, 'refresh'));
    assert.deepEqual(await Promise.all(files.map(async file => (await stat(join(root, file))).mtimeMs)), times);
    assert.equal((await read(root, 'CLAUDE.md')).match(/servicemap:maintenance:start/g).length, 1);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('CLI refresh stays current when detected packages omit optional website metadata', async () => {
  const root = await mkdtemp(join(tmpdir(), 'servicemap-optional-metadata-'));
  try {
    await write(root, 'package.json', JSON.stringify({ name: 'optional-metadata', dependencies: { react: '*', express: '*' } }));
    ok(run(root, 'generate', '--mode', 'desktop', '--no-open', '--no-deploy'));
    ok(run(root, 'refresh'));
    const before = await read(root, '.servicemap/refresh-state.json');
    ok(run(root, 'refresh', '--check'));
    assert.equal(await read(root, '.servicemap/refresh-state.json'), before);
  } finally { await rm(root, { recursive: true, force: true }); }
});
