#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const defaultInput = '.servicemap/internal-servicemap.json';

function parseArgs() {
  const args = process.argv.slice(2);
  const options = { root: process.cwd(), input: defaultInput };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--root') options.root = args[index + 1] ?? options.root;
    if (args[index] === '--input') options.input = args[index + 1] ?? options.input;
  }
  options.root = resolve(options.root);
  options.input = resolve(options.root, options.input);
  return options;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function routeFor(root, framework) {
  if (framework === 'next-app-router') {
    const base = existsSync(join(root, 'src/app')) ? 'src/app' : 'app';
    return { path: join(root, base, 'internalservicemap/page.tsx'), kind: 'next-app-router' };
  }
  if (framework === 'next-pages-router') {
    const base = existsSync(join(root, 'src/pages')) ? 'src/pages' : 'pages';
    return { path: join(root, base, 'internalservicemap.tsx'), kind: 'next-pages-router' };
  }
  if (framework === 'astro') {
    return { path: join(root, 'src/pages/internalservicemap.astro'), kind: 'astro' };
  }
  if (framework === 'remix') {
    return { path: join(root, 'app/routes/internalservicemap.tsx'), kind: 'remix' };
  }
  return { path: join(root, 'public/internalservicemap.html'), kind: 'static' };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pageCss() {
  return `
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #020806; color: #eff8f2; }
    .servicemap-shell { min-height: 100vh; overflow: hidden; background: #030806; }
    .servicemap-topbar { height: 88px; display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 0 28px; border-bottom: 1px solid rgba(255,255,255,0.08); background: #222823; }
    .brand { display: flex; align-items: center; gap: 16px; min-width: 0; }
    .brand-mark { width: 48px; height: 48px; border-radius: 10px; border: 1px solid #2a7958; background: #164d39; color: #7cf1b5; display: grid; place-items: center; box-shadow: 0 0 26px rgba(82,255,166,0.16); font-size: 22px; }
    .brand h1 { margin: 0; font-size: 20px; line-height: 1; letter-spacing: 0; }
    .brand p, .top-meta { margin: 6px 0 0; color: #8aa097; font-size: 14px; }
    .top-actions { display: flex; align-items: center; gap: 12px; color: #8da59a; font-size: 14px; white-space: nowrap; }
    .mode-pill { border-radius: 8px; background: #0b130f; color: #7cf1b5; padding: 8px 12px; }
    .map { position: relative; height: calc(100vh - 88px); min-height: 760px; background: radial-gradient(circle at 50% 52%, rgba(41, 96, 69, 0.22), transparent 24%), radial-gradient(circle at 1px 1px, rgba(88, 160, 120, 0.2) 1px, transparent 1px), #020806; background-size: auto, 28px 28px, auto; }
    .intro { position: absolute; left: 32px; top: 32px; z-index: 20; }
    .intro strong { display: block; color: #779286; font-size: 12px; letter-spacing: 0.22em; text-transform: uppercase; }
    .intro span { display: block; margin-top: 8px; color: #53665d; font-size: 14px; }
    .edges { position: absolute; inset: 0; width: 100%; height: 100%; }
    .hub { position: absolute; left: 50%; top: 50%; z-index: 20; width: 132px; height: 132px; transform: translate(-50%, -50%); border-radius: 24px; border: 1px solid #315c47; background: #09120d; display: grid; place-items: center; box-shadow: 0 0 0 9px rgba(79,183,128,0.12), 0 0 42px rgba(100,255,174,0.16); }
    .hub-inner { width: 92px; height: 92px; border-radius: 18px; background: #fbfbf7; color: #111612; display: grid; place-items: center; font-size: 40px; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.08); }
    .service-node { position: absolute; z-index: 10; width: 250px; height: 74px; transform: translate(-50%, -50%); display: flex; align-items: center; gap: 16px; padding: 0 16px; border-radius: 8px; border: 1px solid #274036; background: rgba(16,24,19,0.95); box-shadow: 0 0 0 1px rgba(140,255,190,0.05), 0 18px 44px rgba(0,0,0,0.38); }
    .logo { width: 48px; height: 48px; flex: 0 0 auto; border-radius: 8px; display: grid; place-items: center; overflow: hidden; color: #fff; font-weight: 700; }
    .logo img { width: 28px; height: 28px; object-fit: contain; filter: invert(1); }
    .service-copy { min-width: 0; }
    .service-copy strong { display: block; color: #f2faf5; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .service-copy span { display: block; margin-top: 5px; color: #7f9188; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .status-dot { margin-left: auto; width: 8px; height: 8px; flex: 0 0 auto; border-radius: 999px; box-shadow: 0 0 14px currentColor; }
    .status-high { color: #65f0ad; background: #65f0ad; }
    .status-medium, .status-low { color: #f1c85b; background: #f1c85b; }
    .legend { position: absolute; left: 50%; bottom: 32px; z-index: 20; transform: translateX(-50%); display: flex; align-items: center; gap: 20px; border: 1px solid rgba(255,255,255,0.1); border-radius: 999px; background: rgba(11,20,15,0.9); color: #789086; padding: 8px 20px; font-size: 12px; }
    .legend i { display: inline-block; width: 8px; height: 8px; margin-right: 8px; border-radius: 999px; }
    .scan-foot { position: absolute; right: 32px; bottom: 32px; z-index: 20; color: #53665d; text-align: right; font-size: 12px; line-height: 1.6; }
    .access-warning { position: absolute; left: 32px; right: 32px; bottom: 88px; z-index: 25; max-width: 720px; border: 1px solid rgba(241,200,91,0.42); border-radius: 8px; background: rgba(31,27,12,0.92); color: #f7daa0; padding: 12px 14px; font-size: 14px; line-height: 1.45; }
    @media (max-width: 920px) {
      .map { min-height: 1120px; }
      .service-node { width: 220px; }
      .top-actions { display: none; }
    }
  `;
}

const palette = ['#ff7a00', '#f48120', '#111827', '#6d5dfc', '#4285f4', '#5e5ce6', '#e5e7eb', '#7c3aed', '#24292f', '#22c55e'];
const layout = [
  { x: 17, y: 30 }, { x: 17, y: 55 }, { x: 35, y: 28 }, { x: 35, y: 72 }, { x: 25, y: 82 },
  { x: 59, y: 34 }, { x: 79, y: 23 }, { x: 79, y: 48 }, { x: 80, y: 64 }, { x: 62, y: 73 },
  { x: 19, y: 18 }, { x: 81, y: 82 }, { x: 41, y: 17 }, { x: 61, y: 18 }, { x: 43, y: 84 }, { x: 57, y: 84 },
];

function edgePath(node) {
  const isLeft = node.x < 50;
  const fromX = isLeft ? node.x + 8 : node.x - 8;
  const endX = isLeft ? 47 : 53;
  const midX = isLeft ? Math.max(fromX + 7, 42) : Math.min(fromX - 7, 58);
  return `M ${fromX} ${node.y} H ${midX} V 50 H ${endX}`;
}

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function htmlBody(graph) {
  const services = graph.services ?? [];
  const access = graph.access ?? {};
  const hasAccessRequest = access.requested && access.allowedEmails?.length;
  const accessNotice = hasAccessRequest && access.enforced !== true
    ? '<div class="access-warning">Email access was requested, but this project does not expose a supported server-side auth guard for generated pages. Put this route behind your app auth before sharing it.</div>'
    : '';
  const nodes = services.slice(0, layout.length).map((service, index) => ({
    ...service,
    ...layout[index],
    color: palette[index % palette.length],
  }));
  const edges = nodes.map((node) => `<path d="${edgePath(node)}" fill="none" stroke="rgba(103, 130, 118, 0.48)" stroke-width="0.16" vector-effect="non-scaling-stroke"></path>`).join('');
  const serviceNodes = nodes.map((service) => `
    <article class="service-node" style="left:${service.x}%;top:${service.y}%">
      <div class="logo" style="background:${service.color}">${service.iconUrl ? `<img src="${escapeHtml(service.iconUrl)}" alt="">` : escapeHtml(initials(service.name))}</div>
      <div class="service-copy">
        <strong>${escapeHtml(service.name)}</strong>
        <span>${escapeHtml(service.category)}</span>
      </div>
      <i class="status-dot status-${escapeHtml(service.confidence)}"></i>
    </article>
  `).join('');

  return `
    <main class="servicemap-shell">
      <header class="servicemap-topbar">
        <div class="brand">
          <div class="brand-mark">⌘</div>
          <div>
            <h1>servicemap</h1>
            <p>${escapeHtml(graph.project?.name ?? 'Project')} command center</p>
          </div>
        </div>
        <div class="top-actions">
          <span>${services.length} services</span>
          <span class="mode-pill">2D</span>
        </div>
      </header>
      <section class="map">
        <div class="intro">
          <strong>${escapeHtml(graph.project?.name ?? 'Project')} infrastructure</strong>
          <span>Select a service to trace its dependencies</span>
        </div>
        <svg class="edges" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${edges}</svg>
        <div class="hub"><div class="hub-inner">⌘</div></div>
        ${serviceNodes || '<div class="intro"><span>No external services were detected yet.</span></div>'}
        ${accessNotice}
        <div class="legend">
          <span><i style="background:#4a7cff"></i>Cloud</span>
          <span><i style="background:#8be4b2"></i>Product</span>
          <span><i style="background:#65f0ad"></i>Active path</span>
        </div>
        <footer class="scan-foot">
          <div>Generated ${escapeHtml(new Date(graph.generatedAt).toLocaleString())}</div>
          <div>${services.length} services detected</div>
        </footer>
      </section>
    </main>
  `;
}

function staticHtml(graph) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Internal Servicemap</title>
  <style>${pageCss()}</style>
</head>
<body>
${htmlBody(graph)}
</body>
</html>
`;
}

function tsxPage(graph) {
  const html = htmlBody(graph);
  const allowedEmails = graph.access?.allowedEmails ?? [];
  const usesClerk = (graph.services ?? []).some((service) => service.key === 'clerk');
  const canEnforce = allowedEmails.length > 0 && usesClerk && graph.project?.framework === 'next-app-router';
  if (canEnforce) {
    graph.access.enforced = true;
    const guardedHtml = htmlBody(graph);
    return `import { currentUser } from '@clerk/nextjs/server';
import { notFound } from 'next/navigation';

const css = ${JSON.stringify(pageCss())};
const html = ${JSON.stringify(guardedHtml)};
const allowedEmails = ${JSON.stringify(allowedEmails)};

export default async function InternalServiceMapPage() {
  const user = await currentUser();
  const userEmails = user?.emailAddresses?.map((email) => email.emailAddress.toLowerCase()) ?? [];
  const canView = userEmails.some((email) => allowedEmails.includes(email));

  if (!canView) notFound();

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}
`;
  }

  return `const css = ${JSON.stringify(pageCss())};
const html = ${JSON.stringify(html)};

export default function InternalServiceMapPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}
`;
}

function astroPage(graph) {
  return `---
const css = ${JSON.stringify(pageCss())};
const html = ${JSON.stringify(htmlBody(graph))};
---
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Internal Servicemap</title>
    <style set:html={css}></style>
  </head>
  <body set:html={html}></body>
</html>
`;
}

async function main() {
  const options = parseArgs();
  const graph = await readJson(options.input);
  const route = routeFor(options.root, graph.project?.framework);
  const contents = route.kind === 'astro' ? astroPage(graph) : route.kind === 'static' ? staticHtml(graph) : tsxPage(graph);

  await mkdir(dirname(route.path), { recursive: true });
  await writeFile(route.path, contents);
  console.log(`Wrote /internalservicemap page to ${route.path}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
