import { readFile, writeFile, mkdir, rename, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { prepareServiceLogos, reportMissingLogos } from './service-logos.mjs';
import { scanProject } from './scan-project.mjs';
import { routeFor, htmlBody } from './generate-page.mjs';

const dataFile = '.servicemap/internal-servicemap.json';
const stateFile = '.servicemap/refresh-state.json';
const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const packageCommand = `npx --yes servicemap@${version}`;
const same = isDeepStrictEqual;
const json = value => JSON.stringify(value, null, 2) + '\n';
async function readJSON(path) { return JSON.parse(await readFile(path, 'utf8')); }

// Ignore scan time, checkout location, and unrelated file-count changes in CI.
function detection(graph) {
  const copy = structuredClone(graph);
  delete copy.generatedAt;
  delete copy.project.root;
  delete copy.summary.scannedFileCount;
  delete copy.access;
  return copy;
}

function mergeFields(previous = {}, current = {}, fresh = {}) {
  const result = { ...current };
  for (const key of new Set([...Object.keys(previous), ...Object.keys(fresh)])) {
    if (!(key in current) || same(current[key], previous[key])) {
      if (key in fresh) result[key] = fresh[key];
      else delete result[key];
    }
  }
  return result;
}

export function mergeGraph(previous, current, fresh) {
  const old = new Map(previous.services.map(s => [s.id, s]));
  const live = new Map(current.services.map(s => [s.id, s]));
  const services = fresh.services.map(service => {
    const merged = mergeFields(old.get(service.id), live.get(service.id), service);
    // Evidence always represents the current codebase, even when labels are customized.
    merged.evidence = service.evidence;
    merged.confidence = service.confidence;
    delete merged.detected;
    return merged;
  });
  const detectedIds = new Set(services.map(s => s.id));
  for (const service of current.services) {
    if (detectedIds.has(service.id)) continue;
    if (!old.has(service.id) || service.manual === true) services.push(service);
    else if (!same(service, old.get(service.id))) {
      services.push({ ...service, evidence: [], confidence: 'low', detected: false });
    }
  }
  const ids = new Set(services.map(s => s.id));
  const customEdges = (current.edges ?? []).filter(edge =>
    !(previous.edges ?? []).some(prior => same(prior, edge)) &&
    (edge.source === 'project' || ids.has(edge.source)) && ids.has(edge.target));
  const edges = [...fresh.edges, ...customEdges].filter((edge, i, all) => all.findIndex(other => same(other, edge)) === i);
  const project = mergeFields(previous.project, current.project, fresh.project);
  project.root = current.project.root; // Keep checked-in data portable across CI checkouts.
  return {
    ...current, project, services, edges,
    summary: { ...current.summary, serviceCount: services.length,
      highConfidenceCount: services.filter(s => s.confidence === 'high').length },
  };
}

function fragment(source) {
  const graph = /^const graph = (.+) as \{/m.exec(source);
  if (graph) {
    JSON.parse(graph[1]);
    return { kind: 'graph', value: graph[1], start: graph.index + 'const graph = '.length };
  }
  const html = /^const html = (.+);$/m.exec(source);
  if (html) {
    JSON.parse(html[1]);
    return { kind: 'html', value: html[1], start: html.index + 'const html = '.length };
  }
  const body = /<body>\n([\s\S]*?)\n<\/body>/.exec(source);
  if (body) return { kind: 'body', value: body[1], start: body.index + '<body>\n'.length };
  throw new Error('Cannot locate generated map data. Keep the generated graph/html declaration or restore it before refreshing.');
}


function renderData(graph, kind) {
  const rendered = structuredClone(graph);
  if (rendered.project?.logo?.path && !rendered.project.logoUrl) {
    rendered.project.logoUrl = `/internalservicemap-assets/project-logo${extname(rendered.project.logo.path) || '.png'}`;
  }
  if (kind !== 'graph' && rendered.access?.allowedEmails?.length &&
      rendered.project.framework === 'next-app-router' && rendered.services.some(s => s.key === 'clerk')) {
    rendered.access.enforced = true;
  }
  return kind === 'graph' ? JSON.stringify(rendered)
    : kind === 'html' ? JSON.stringify(htmlBody(rendered)) : htmlBody(rendered);
}

function safePath(root, path) {
  const full = resolve(root, path);
  if (!full.startsWith(resolve(root) + sep)) throw new Error(`Map output is outside the project: ${path}`);
  return full;
}

async function discoverSurfaces(root, graph) {
  const candidates = [routeFor(root, graph.project.framework).path, join(root, 'servicemap-desktop/src/ServiceMap.tsx')];
  const surfaces = [];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    const source = await readFile(path, 'utf8');
    const part = fragment(source);
    surfaces.push({ path: relative(root, path), kind: part.kind, value: part.value });
  }
  if (!surfaces.length) throw new Error('No existing map output found. Run servicemap generate first.');
  return surfaces;
}

export async function registerRefresh(root) {
  const graph = await readJSON(join(root, dataFile));
  const surfaces = await discoverSurfaces(root, graph);
  await writeFile(join(root, stateFile), json({ version: 1, detected: graph, surfaces }));
  await installMaintenance(root);
}

async function writeChanged(path, content) {
  if (existsSync(path) && await readFile(path, 'utf8') === content) return;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

export async function installMaintenance(root) {
  const start = '<!-- servicemap:maintenance:start -->';
  const end = '<!-- servicemap:maintenance:end -->';
  const instruction = `${start}\n## ServiceMap maintenance\n\nWhen adding, removing, or changing a third-party integration in this repository, invoke the servicemap skill if available and run \`${packageCommand} refresh\` before finishing.\nRun \`${packageCommand} refresh --check\` to confirm the existing map is current.\nPreserve custom UI, annotations, manual services, and access settings; resolve reported conflicts instead of regenerating over customized files.\nInclude the updated map data, output, and refresh state with the integration change.\n${end}`;
  for (const file of ['AGENTS.md', 'CLAUDE.md', '.github/copilot-instructions.md']) {
    const path = join(root, file);
    const current = existsSync(path) ? await readFile(path, 'utf8') : '';
    const begin = current.indexOf(start);
    const finish = current.indexOf(end);
    if ((begin < 0) !== (finish < 0) || (begin >= 0 && finish < begin)) throw new Error(`Incomplete ServiceMap instruction block in ${file}`);
    const content = begin < 0 ? `${current}${current && !current.endsWith('\n') ? '\n' : ''}\n${instruction}\n`
      : current.slice(0, begin) + instruction + current.slice(finish + end.length);
    await writeChanged(path, content);
  }
  const workflow = join(root, '.github/workflows/servicemap-freshness.yml');
  // Never overwrite a user-owned workflow.
  if (!existsSync(workflow)) await writeChanged(workflow, `name: ServiceMap freshness
on: [pull_request, push]
permissions:
  contents: read
jobs:
  freshness:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - name: Check map freshness
        run: ${packageCommand} refresh --check
`);
}

export async function refresh(root, { check = false } = {}) {
  root = resolve(root);
  const path = join(root, dataFile);
  if (!existsSync(path)) throw new Error('No ServiceMap data found. Run servicemap generate first.');
  const current = await readJSON(path);
  const hasState = existsSync(join(root, stateFile));
  const state = hasState ? await readJSON(join(root, stateFile))
    : { version: 1, detected: current, surfaces: await discoverSurfaces(root, current) };
  if (!hasState) {
    for (const surface of state.surfaces) {
      const rendered = structuredClone(current);
      const outputRoot = surface.path === 'servicemap-desktop/src/ServiceMap.tsx' ? join(root, 'servicemap-desktop') : root;
      await prepareServiceLogos(rendered, outputRoot, { cacheRoot: root, check: true });
      if (surface.value !== renderData(current, surface.kind) && surface.value !== renderData(rendered, surface.kind)) {
        throw new Error(`Legacy map data differs from canonical data in ${surface.path}. Reconcile customizations into ${dataFile} before adopting refresh; no files were changed.`);
      }
    }
  }
  if (state.version !== 1 || !state.surfaces?.length) throw new Error('Unsupported or incomplete ServiceMap refresh state.');
  const fresh = await scanProject(root, current.access?.allowedEmails ?? [], { check, previous: state.detected.services });
  const next = mergeGraph(state.detected, current, fresh);
  const dataChanged = !same(next, current);
  const detectionChanged = !same(detection(state.detected), detection(fresh));
  if (dataChanged || detectionChanged) next.generatedAt = fresh.generatedAt;
  const writes = [];
  const surfaces = [];
  const validated = [];
  for (const surface of state.surfaces) {
    const output = safePath(root, surface.path);
    const source = await readFile(output, 'utf8');
    const part = fragment(source);
    if (part.kind !== surface.kind || part.value !== surface.value) {
      throw new Error(`Map data was customized directly in ${surface.path}. Move those data edits into ${dataFile} before refreshing; no files were changed.`);
    }
    validated.push({ surface, output, source, part });
  }
  for (const { surface, output, source, part } of validated) {
    const rendered = structuredClone(next);
    const outputRoot = surface.path === 'servicemap-desktop/src/ServiceMap.tsx' ? join(root, 'servicemap-desktop') : root;
    const logos = await prepareServiceLogos(rendered, outputRoot, { cacheRoot: root, check });
    if (check && logos.missingAssets.length) throw new Error('ServiceMap is stale: logo assets are missing. Run npx servicemap refresh.');
    if (!check) reportMissingLogos(logos);
    const value = renderData(rendered, part.kind);
    const content = source.slice(0, part.start) + value + source.slice(part.start + part.value.length);
    if (content !== source) writes.push([output, content]);
    surfaces.push({ ...surface, value });
    if (surface.path === 'servicemap-desktop/src/ServiceMap.tsx') {
      const mirror = join(root, 'servicemap-desktop/src/servicemap-data.json');
      const content = json(rendered);
      if (!existsSync(mirror) || await readFile(mirror, 'utf8') !== content) writes.push([mirror, content]);
    }
  }
  if (dataChanged || detectionChanged) writes.push([path, json(next)]);
  const stale = !hasState || detectionChanged || writes.length > 0;
  if (check) {
    if (stale) throw new Error('ServiceMap is stale. Run npx servicemap refresh and commit the updated map files.');
    console.log('ServiceMap is current.');
    return;
  }
  if (stale) {
    writes.push([join(root, stateFile), json({ version: 1, detected: fresh, surfaces })]);
    // Validate every surface before touching files; stage each replacement on the same filesystem.
    const staged = [];
    try {
      for (const [file, content] of writes) {
        const temporary = `${file}.servicemap-${process.pid}.tmp`;
        await writeFile(temporary, content);
        staged.push([temporary, file]);
      }
      for (const [temporary, file] of staged) await rename(temporary, file);
    } finally {
      await Promise.all(staged.map(([temporary]) => unlink(temporary).catch(() => {})));
    }
  }
  await installMaintenance(root);
  console.log(stale ? `Updated existing ServiceMap (${next.services.length} services).` : 'ServiceMap is current.');
}
