import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { prepareServiceLogos, validateImage, websiteIcons, findLogoEntry } from '../scripts/service-logos.mjs';
import { publicURL, publicIPv4, fetchLogoResource } from '../scripts/logo-network.mjs';
const cli = fileURLToPath(new URL('../bin/servicemap.mjs', import.meta.url));
const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#45a" d="M0 0h24v24H0z"/></svg>');
const temp = () => mkdtemp(join(tmpdir(), 'servicemap-logo-test-'));
const read = (root, path) => readFile(join(root, path), 'utf8');
function run(root, ...args) {
  const result = spawnSync(process.execPath, [cli, ...args, '--root', root], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  return result;
}
const offline = async () => { throw new Error('Network must not be used'); };

test('every bundled icon validates and expanded catalog resolves aliases', async () => {
  const { icons } = JSON.parse(await readFile(new URL('../assets/service-logo-assets.json', import.meta.url), 'utf8'));
  assert.ok(Object.keys(icons).length > 3400);
  for (const [slug, image] of Object.entries(icons)) assert.ok(validateImage(Buffer.from(image)), slug);
  assert.equal(findLogoEntry({ name: 'AWS' }).key, 'amazonwebservices');
  assert.equal(findLogoEntry({ websiteUrl: 'https://api.linear.app' }).key, 'linear');
});

test('CLI detects scoped SDKs and domain evidence and emits local logos on both surfaces', async () => {
  for (const mode of ['page', 'desktop']) {
    const root = await temp();
    try {
      await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'example', dependencies: { '@linear/sdk': '*', stripe: '*' } }));
      await writeFile(join(root, 'integration.js'), 'const endpoint = "https://api.resend.com/emails";');
      run(root, 'generate', '--mode', mode, '--no-open', '--no-deploy');
      const graph = JSON.parse(await read(root, '.servicemap/internal-servicemap.json'));
      assert.deepEqual(graph.services.map(s => s.key).sort(), ['linear', 'resend', 'stripe']);
      const outputRoot = mode === 'desktop' ? join(root, 'servicemap-desktop') : root;
      const assets = await readdir(join(outputRoot, 'public/internalservicemap-assets/services'));
      assert.equal(assets.length, 3);
      const source = await read(outputRoot, mode === 'desktop' ? 'src/ServiceMap.tsx' : 'public/internalservicemap.html');
      assert.match(source, /\/internalservicemap-assets\/services\//);
      assert.doesNotMatch(source, /cdn\.jsdelivr\.net\/npm\/simple-icons/);
      run(root, 'refresh', '--check');
    } finally { await rm(root, { recursive: true, force: true }); }
  }
});

test('unknown service uses declared website icon, caches it, and works offline', async () => {
  const root = await temp();
  try {
    const original = { services: [{ name: 'Unlisted Company', websiteUrl: 'https://vendor.example/settings?token=must-not-send' }] };
    const requests = [];
    const fetchResource = async url => {
      requests.push(url);
      return url === 'https://vendor.example/'
        ? { type: 'text/html', body: Buffer.from('<link rel="apple-touch-icon" href="/brand.svg">'), url }
        : { type: 'image/svg+xml', body: svg, url };
    };
    const graph = structuredClone(original);
    assert.deepEqual(await prepareServiceLogos(graph, root, { fetchResource }), { unresolved: [], missingAssets: [] });
    assert.deepEqual(requests, ['https://vendor.example/', 'https://vendor.example/brand.svg']);
    assert.equal(await read(root, 'public' + graph.services[0].iconUrl), validateImage(svg).body.toString());
    const again = structuredClone(original);
    await prepareServiceLogos(again, root, { fetchResource: offline });
    assert.deepEqual(again, graph);
    const cache = await readdir(join(root, '.servicemap/logo-cache'));
    assert.equal(cache.length, 1);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('fallback rejects HTML masquerading as an icon and tries conventional favicon', async () => {
  const root = await temp();
  try {
    const calls = [];
    const graph = { services: [{ name: 'Unknown', websiteUrl: 'https://vendor.example' }] };
    await prepareServiceLogos(graph, root, { fetchResource: async url => {
      calls.push(url);
      if (url.endsWith('/favicon.ico')) return { type: 'image/svg+xml', body: svg };
      if (url.endsWith('/bad.svg')) return { type: 'image/svg+xml', body: Buffer.from('<html>Sign in</html>') };
      return { type: 'text/html', body: Buffer.from('<link href="/bad.svg" rel="icon">'), url };
    } });
    assert.match(graph.services[0].iconUrl, /^\/internalservicemap-assets/);
    assert.equal(calls.at(-1), 'https://vendor.example/favicon.ico');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('unavailable logos degrade to initials, cache misses, and checks never fetch or write', async () => {
  const root = await temp();
  try {
    const original = { services: [{ name: 'Offline', websiteUrl: 'https://vendor.example' }] };
    let requests = 0;
    const fetchResource = async () => { requests++; throw new Error('Offline'); };
    const graph = structuredClone(original);
    assert.deepEqual((await prepareServiceLogos(graph, root, { fetchResource })).unresolved, ['Offline']);
    assert.equal(graph.services[0].iconUrl, null);
    assert.equal(requests, 2);
    const cache = await readdir(join(root, '.servicemap/logo-cache'));
    const before = await read(root, '.servicemap/logo-cache/' + cache[0]);
    await prepareServiceLogos(structuredClone(original), root, { fetchResource });
    await prepareServiceLogos(structuredClone(original), root, { check: true, fetchResource });
    assert.equal(requests, 2);
    assert.equal(await read(root, '.servicemap/logo-cache/' + cache[0]), before);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('freshness checks report missing bundled files without creating them', async () => {
  const root = await temp();
  try {
    const graph = { services: [{ name: 'Stripe' }] };
    const result = await prepareServiceLogos(graph, root, { check: true, fetchResource: offline });
    assert.equal(result.missingAssets.length, 1);
    assert.deepEqual(await readdir(root), []);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('custom local and remote logos take precedence over bundled brands', async () => {
  const root = await temp();
  try {
    const graph = { services: [
      { name: 'Stripe', iconUrl: '/my-brand.png' },
      { name: 'Linear', iconUrl: 'https://vendor.example/custom.svg' },
    ] };
    const calls = [];
    await prepareServiceLogos(graph, root, { fetchResource: async url => {
      calls.push(url); return { type: 'image/svg+xml', body: svg };
    } });
    assert.equal(graph.services[0].iconUrl, '/my-brand.png');
    assert.deepEqual(calls, ['https://vendor.example/custom.svg']);
    assert.equal(await read(root, 'public' + graph.services[1].iconUrl), validateImage(svg).body.toString());
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('remote content cannot load private resources or executable SVG', async () => {
  for (const url of ['http://example.com', 'https://127.0.0.1', 'https://169.254.169.254/latest', 'https://10.0.0.1', 'https://[::1]', 'https://user:password@example.com', 'https://example.com:8443', 'file:///tmp/icon.svg', 'https://thing.local']) {
    assert.throws(() => publicURL(url), url);
    await assert.rejects(fetchLogoResource(url));
  }
  for (const address of ['10.0.0.1','100.64.0.1','127.0.0.1','172.16.0.1','192.168.1.1','198.18.0.1','224.0.0.1','::ffff:127.0.0.1']) assert.equal(publicIPv4(address), false, address);
  assert.equal(publicIPv4('1.1.1.1'), true);
  for (const content of [
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    '<svg onload="alert(1)"></svg>',
    '<svg><use href="https://evil.example/a.svg"/></svg>',
    '<svg><path fill="url(https://evil.example/x)"/></svg>',
    '<svg><foreignObject><iframe src="https://evil.example"/></foreignObject></svg>',
    '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg>&x;</svg>',
    '<svg><use href="&#x23;external"/></svg>',
  ]) assert.equal(validateImage(Buffer.from(content)), null);
  assert.deepEqual(websiteIcons('<link rel="icon" href="http://localhost/x"><link rel="icon" href="/good.svg">', 'https://vendor.example/'), ['https://vendor.example/good.svg']);
});

test('refresh resolves manually added services through cached website fallback and stays stable', async () => {
  const root = await temp();
  try {
    await writeFile(join(root, 'package.json'), '{"name":"example","dependencies":{"stripe":"*"}}');
    run(root, 'generate', '--mode', 'desktop', '--no-open', '--no-deploy');
    const path = join(root, '.servicemap/internal-servicemap.json');
    const graph = JSON.parse(await readFile(path, 'utf8'));
    graph.services.push({ id: 'unlisted', name: 'Unlisted Company', websiteUrl: 'https://vendor.example', manual: true });
    await writeFile(path, JSON.stringify(graph));
    await prepareServiceLogos(structuredClone(graph), join(root, 'servicemap-desktop'), {
      cacheRoot: root, fetchResource: async url => ({ type: 'image/svg+xml', body: svg, url }),
    });
    run(root, 'refresh');
    const rendered = JSON.parse(await read(root, 'servicemap-desktop/src/servicemap-data.json'));
    assert.match(rendered.services.find(s => s.id === 'unlisted').iconUrl, /^\/internalservicemap-assets\/services/);
    const before = await read(root, 'servicemap-desktop/src/ServiceMap.tsx');
    run(root, 'refresh', '--check');
    run(root, 'refresh');
    assert.equal(await read(root, 'servicemap-desktop/src/ServiceMap.tsx'), before);
    const canonical = JSON.parse(await readFile(path, 'utf8'));
    assert.equal(canonical.services.find(s => s.id === 'unlisted').websiteUrl, 'https://vendor.example');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('viewBox-only SVGs receive intrinsic dimensions for WebGL textures', () => {
  const normalized = validateImage(svg).body.toString();
  assert.match(normalized, /<svg width="256" height="256"/);
  assert.match(normalized, /viewBox="0 0 24 24"/);
  assert.equal(validateImage(Buffer.from(normalized)).body.toString(), normalized);
});

test('a failed custom remote logo falls back to the bundled brand', async () => {
  const root = await temp();
  try {
    const graph = { services: [{ name: 'Stripe', iconUrl: 'https://vendor.example/broken.svg' }] };
    const requests = [];
    const result = await prepareServiceLogos(graph, root, { fetchResource: async url => {
      requests.push(url); throw new Error('Not found');
    } });
    assert.deepEqual(result.unresolved, []);
    assert.deepEqual(requests, ['https://vendor.example/broken.svg']);
    assert.match(await read(root, 'public' + graph.services[0].iconUrl), /Stripe/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('custom inline images are preserved as validated local assets', async () => {
  const root = await temp();
  try {
    const graph = { services: [{ name: 'Stripe', iconUrl: 'data:image/svg+xml,' + encodeURIComponent(svg.toString()) }] };
    const result = await prepareServiceLogos(graph, root, { fetchResource: offline });
    assert.deepEqual(result.unresolved, []);
    assert.equal(await read(root, 'public' + graph.services[0].iconUrl), validateImage(svg).body.toString());
  } finally { await rm(root, { recursive: true, force: true }); }
});
