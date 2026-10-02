#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { dirname, extname, isAbsolute, join, resolve } from 'node:path';

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

async function readJsonOrNull(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return null;
  }
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
    .brand-mark img, .hub-inner img, .three-core img { width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }
    .brand h1 { margin: 0; font-size: 20px; line-height: 1; letter-spacing: 0; }
    .brand p, .top-meta { margin: 6px 0 0; color: #8aa097; font-size: 14px; }
    .top-actions { display: flex; align-items: center; gap: 12px; color: #8da59a; font-size: 14px; white-space: nowrap; }
    .add-service-button { min-height: 40px; border: 0; border-radius: 10px; background: #287a5a; color: #effbf5; padding: 0 14px; cursor: pointer; font: inherit; font-weight: 800; box-shadow: 0 10px 28px rgba(54,180,126,0.16); }
    .center-button { width: 48px; height: 48px; border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; background: #0b130f; color: #b4c9bf; display: grid; place-items: center; cursor: pointer; box-shadow: 0 0 0 7px rgba(47,128,91,.16); }
    .center-button:hover { border-color: rgba(101,240,173,.42); color: #d9f8e8; box-shadow: 0 0 0 7px rgba(47,128,91,.2), 0 0 22px rgba(101,240,173,.14); }
    .mode-toggle { display: inline-flex; gap: 4px; padding: 4px; border-radius: 10px; background: #0b130f; }
    .mode-button { min-height: 36px; border: 0; border-radius: 8px; background: transparent; color: #789086; padding: 0 12px; cursor: pointer; font: inherit; font-weight: 800; }
    .mode-button.is-active { background: #276f53; color: #c9f9df; box-shadow: 0 0 18px rgba(101,240,173,0.16); }
    .map { position: relative; height: calc(100vh - 88px); min-height: 760px; background: radial-gradient(circle at 50% 52%, rgba(41, 96, 69, 0.22), transparent 24%), radial-gradient(circle at 1px 1px, rgba(88, 160, 120, 0.2) 1px, transparent 1px), #020806; background-size: auto, 28px 28px, auto; }
    .map.is-panning { cursor: grabbing; user-select: none; }
    .map-plane { position: absolute; inset: 0; z-index: 20; transform: translate3d(var(--pan-x, 0px), var(--pan-y, 0px), 0) scale(var(--zoom, 1)); transform-origin: 50% 50%; transition: transform 160ms ease; }
    .map.is-panning .map-plane { transition: none; }
    .intro { position: absolute; left: 32px; top: 32px; z-index: 20; }
    .intro strong { display: block; color: #779286; font-size: 12px; letter-spacing: 0.22em; text-transform: uppercase; }
    .intro span { display: block; margin-top: 8px; color: #53665d; font-size: 14px; }
    .edges { position: absolute; inset: 0; z-index: 26; width: 100%; height: 100%; pointer-events: none; }
    .edge-line { transition: opacity 180ms ease, stroke 180ms ease; }
    .edge-line.is-active { stroke: #7ee2b8; stroke-width: 2.4px; stroke-dasharray: 1 9; stroke-linecap: round; animation: servicemapDash 640ms linear infinite; filter: drop-shadow(0 0 5px rgba(126,226,184,.9)) drop-shadow(0 0 16px rgba(93,224,165,.42)); opacity: 1; }
    .edge-line.is-muted { opacity: 0.12; }
    .hub { position: absolute; left: 50%; top: 50%; z-index: 20; width: 132px; height: 132px; transform: translate(-50%, -50%); border-radius: 24px; border: 1px solid #315c47; background: #09120d; display: grid; place-items: center; box-shadow: 0 0 0 9px rgba(79,183,128,0.12), 0 0 42px rgba(100,255,174,0.16); }
    button.hub { cursor: pointer; }
    .hub.is-selected, button.hub:hover { border-color: #66efae; box-shadow: 0 0 0 9px rgba(79,183,128,0.12), 0 0 0 2px rgba(101,240,173,0.42), 0 0 52px rgba(100,255,174,0.24); }
    .hub-inner { width: 92px; height: 92px; border-radius: 18px; background: #fbfbf7; color: #111612; display: grid; place-items: center; font-size: 40px; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.08); }
    .service-node { position: absolute; z-index: 10; width: 250px; height: 74px; transform: translate(-50%, -50%); display: flex; align-items: center; gap: 16px; padding: 0 16px; border-radius: 8px; border: 1px solid #274036; background: rgba(16,24,19,0.95); box-shadow: 0 0 0 1px rgba(140,255,190,0.05), 0 18px 44px rgba(0,0,0,0.38); }
    button.service-node { cursor: grab; touch-action: none; user-select: none; color: inherit; font: inherit; text-align: left; }
    button.service-node:active { cursor: grabbing; }
    .service-node img { pointer-events: none; }
    .service-node:hover, .service-node.is-selected, .service-node.is-highlighted-child { border-color: #66efae; box-shadow: 0 0 0 2px rgba(101,240,173,0.42), 0 18px 44px rgba(0,0,0,0.38); }
    .service-node.is-highlighted-child { box-shadow: 0 0 0 1px rgba(126,226,184,.36), 0 18px 44px rgba(0,0,0,0.38), 0 0 34px rgba(126,226,184,.18); }
    .map.has-selection .service-node { opacity: 0.16; }
    .map.has-selection .service-node.is-related { opacity: 0.48; }
    .map.has-selection .service-node.is-selected, .map.has-selection .service-node.is-highlighted-child { opacity: 1; }
    .service-node.is-selected { z-index: 27; }
    .logo { width: 48px; height: 48px; flex: 0 0 auto; border-radius: 8px; display: grid; place-items: center; overflow: hidden; color: #fff; font-weight: 700; }
    .logo img { width: 28px; height: 28px; object-fit: contain; filter: invert(1); }
    .service-copy { min-width: 0; }
    .service-copy strong { display: block; color: #f2faf5; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .service-copy span { display: block; margin-top: 5px; color: #7f9188; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .status-dot { margin-left: auto; width: 8px; height: 8px; flex: 0 0 auto; border-radius: 999px; box-shadow: 0 0 14px currentColor; }
    .status-high { color: #65f0ad; background: #65f0ad; }
    .status-medium, .status-low, .status-manual { color: #f1c85b; background: #f1c85b; }
    .legend { position: absolute; left: 50%; bottom: 32px; z-index: 20; transform: translateX(-50%); display: flex; align-items: center; gap: 20px; border: 1px solid rgba(255,255,255,0.1); border-radius: 999px; background: rgba(11,20,15,0.9); color: #789086; padding: 8px 20px; font-size: 12px; }
    .legend i { display: inline-block; width: 8px; height: 8px; margin-right: 8px; border-radius: 999px; }
    .zoom-controls { position: absolute; left: 28px; bottom: 26px; z-index: 29; display: grid; overflow: hidden; border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; background: rgba(7,14,10,0.9); box-shadow: 0 12px 32px rgba(0,0,0,0.34); }
    .zoom-button { width: 38px; height: 36px; border: 0; border-bottom: 1px solid rgba(255,255,255,0.1); background: transparent; color: #a8bbb2; cursor: pointer; font: inherit; font-size: 22px; line-height: 1; }
    .zoom-button:last-child { border-bottom: 0; font-size: 18px; }
    .zoom-button:hover { background: rgba(101,240,173,0.1); color: #d8f8e8; }
    .fit-icon { display: inline-block; width: 15px; height: 15px; border: 2px solid currentColor; border-radius: 3px; }
    .center-icon { position: relative; width: 21px; height: 21px; border: 2px solid currentColor; border-radius: 999px; }
    .center-icon::before, .center-icon::after { content: ''; position: absolute; background: currentColor; }
    .center-icon::before { left: 50%; top: -5px; bottom: -5px; width: 2px; transform: translateX(-50%); }
    .center-icon::after { top: 50%; left: -5px; right: -5px; height: 2px; transform: translateY(-50%); }
    .scan-foot { position: absolute; right: 32px; bottom: 32px; z-index: 20; color: #53665d; text-align: right; font-size: 12px; line-height: 1.6; }
    .access-warning { position: absolute; left: 32px; right: 32px; bottom: 88px; z-index: 25; max-width: 720px; border: 1px solid rgba(241,200,91,0.42); border-radius: 8px; background: rgba(31,27,12,0.92); color: #f7daa0; padding: 12px 14px; font-size: 14px; line-height: 1.45; }
    .drawer-scrim { position: absolute; inset: 0; z-index: 18; background: rgba(0,0,0,0.58); pointer-events: none; }
    .details-panel { position: absolute; right: 22px; top: 64px; bottom: 26px; z-index: 30; width: min(492px, calc(100vw - 44px)); overflow: hidden; border: 1px solid #294034; border-radius: 24px; background: linear-gradient(180deg, rgba(21,31,25,0.98), rgba(8,17,12,0.98)); box-shadow: 0 24px 80px rgba(0,0,0,0.52); }
    .details-head { display: flex; align-items: center; gap: 16px; padding: 26px 26px 22px; border-bottom: 1px solid rgba(255,255,255,0.08); }
    .details-title { min-width: 0; flex: 1; }
    .details-title span { display: block; color: #83978d; font-size: 13px; }
    .details-title strong { display: block; margin-top: 6px; color: #f4fbf6; font-size: 28px; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .close-button, .link-button, .delete-button, .save-button { border: 0; cursor: pointer; font: inherit; }
    .close-button { width: 36px; height: 36px; border-radius: 999px; background: transparent; color: #91a59b; font-size: 26px; }
    .details-body { height: calc(100% - 100px); overflow: auto; padding: 26px; }
    .details-section { padding: 0 0 28px; margin: 0 0 28px; border-bottom: 1px solid rgba(255,255,255,0.08); }
    .details-section:last-child { border-bottom: 0; margin-bottom: 0; }
    .section-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; color: #91a59b; font-size: 13px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; }
    .field-label { display: block; margin: 16px 0 8px; color: #83978d; font-size: 13px; }
    .details-input, .details-textarea { width: 100%; border: 1px solid #2a3c33; border-radius: 10px; background: rgba(255,255,255,0.04); color: #e9f5ee; font: inherit; padding: 13px 14px; outline: none; }
    .details-textarea { min-height: 96px; resize: vertical; line-height: 1.45; }
    .details-input:focus, .details-textarea:focus { border-color: #65f0ad; box-shadow: 0 0 0 2px rgba(101,240,173,0.16); }
    .links-list { display: grid; gap: 12px; }
    .link-card { display: grid; grid-template-columns: 1fr auto; gap: 8px 10px; align-items: center; border: 1px solid #26382f; border-radius: 10px; background: rgba(255,255,255,0.035); padding: 14px; }
    .link-card strong { color: #eef7f2; font-size: 14px; }
    .link-card span { grid-column: 1 / -1; color: #74867d; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .link-button { color: #8dc9ae; background: transparent; padding: 4px; }
    .details-actions { position: absolute; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 26px; border-top: 1px solid rgba(255,255,255,0.08); background: rgba(8,17,12,0.98); }
    .delete-button { color: #ff6b57; background: transparent; font-weight: 800; }
    .save-button { min-height: 48px; border-radius: 10px; background: #287a5a; color: #effbf5; padding: 0 18px; font-weight: 800; box-shadow: 0 10px 30px rgba(54,180,126,0.18); }
    .helper-text { margin: 10px 0 0; color: #687c72; font-size: 12px; line-height: 1.45; }
    .modal-card { position: absolute; left: 50%; top: 50%; z-index: 31; width: min(440px, calc(100vw - 44px)); transform: translate(-50%, -50%); border: 1px solid #294034; border-radius: 20px; background: linear-gradient(180deg, rgba(21,31,25,0.99), rgba(8,17,12,0.99)); box-shadow: 0 24px 80px rgba(0,0,0,0.56); overflow: hidden; }
    .modal-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 22px 24px; border-bottom: 1px solid rgba(255,255,255,0.08); }
    .modal-head h2 { margin: 0; color: #f4fbf6; font-size: 20px; letter-spacing: 0; }
    .modal-body { padding: 22px 24px 24px; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 22px; }
    .secondary-button { min-height: 44px; border: 1px solid #2a3c33; border-radius: 10px; background: rgba(255,255,255,0.04); color: #c8d8d0; padding: 0 16px; cursor: pointer; font: inherit; font-weight: 800; }
    .graph-3d { position: absolute; inset: 0; overflow: hidden; }
    .graph-3d::before { content: ''; position: absolute; z-index: 1; inset: 0; pointer-events: none; background: radial-gradient(circle at 50% 50%, transparent 38%, rgba(2,5,4,.46) 100%); }
    .graph-3d canvas { display: block; cursor: grab; }
    .graph-3d canvas:active { cursor: grabbing; }
    .graph-3d__help, .graph-3d__focus { position: absolute; z-index: 3; bottom: 20px; border: 1px solid rgba(255,255,255,.07); background: rgba(9,14,11,.74); color: #718078; font-size: 8px; backdrop-filter: blur(14px); pointer-events: none; }
    .graph-3d__help { left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 999px; white-space: nowrap; }
    .graph-3d__help span { width: 3px; height: 3px; border-radius: 50%; background: #4a5a52; }
    .graph-3d__focus { left: 22px; padding: 8px 10px; border-radius: 8px; color: #91bba7; }
    .graph-3d__zoom { position: absolute; z-index: 4; right: 22px; bottom: 20px; display: flex; flex-direction: column; overflow: hidden; border: 1px solid rgba(255,255,255,.1); border-radius: 10px; background: rgba(9,14,11,.82); box-shadow: 0 10px 28px rgba(0,0,0,.3); backdrop-filter: blur(14px); }
    .graph-3d__zoom button { width: 36px; height: 34px; padding: 0; border: 0; display: grid; place-items: center; background: transparent; color: #aebbb4; cursor: pointer; transition: color .18s ease, background .18s ease; font-size: 20px; }
    .graph-3d__zoom button + button { border-top: 1px solid rgba(255,255,255,.08); }
    .graph-3d__zoom button:hover { color: #fff; background: rgba(255,255,255,.08); }
    .graph-3d__loading { position: absolute; inset: 0; display: grid; place-items: center; color: #75857c; font-size: 9px; }
    @keyframes servicemapDash { to { stroke-dashoffset: -10; } }
    @media (prefers-reduced-motion: reduce) { .edge-line.is-active { animation: none; } }
    @keyframes servicemapLinkFlow { to { background-position: 22px 0; } }
    @media (max-width: 920px) {
      .map { min-height: 1120px; }
      .service-node { width: 220px; }
      .servicemap-topbar { height: auto; min-height: 88px; flex-wrap: wrap; padding: 14px; }
      .top-actions { display: flex; flex-wrap: wrap; gap: 8px; }
      .top-actions > span { display: none; }
      .details-panel { position: fixed; inset: auto 12px 12px; top: 110px; width: auto; }
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

function projectMarkHtml(graph) {
  const logoUrl = graph.project?.logoUrl;
  return logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(graph.project?.name ?? 'Project')} logo">` : '⌘';
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
  const projectMark = projectMarkHtml(graph);
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
          <div class="brand-mark">${projectMark}</div>
          <div>
            <h1>servicemap</h1>
            <p>${escapeHtml(graph.project?.name ?? 'Project')} command center</p>
          </div>
        </div>
        <div class="top-actions">
          <span>${services.length} services</span>
          <span class="mode-toggle" aria-label="View mode">
            <span class="mode-button is-active">2D</span>
            <span class="mode-button">3D</span>
          </span>
        </div>
      </header>
      <section class="map">
        <div class="intro">
          <strong>${escapeHtml(graph.project?.name ?? 'Project')} infrastructure</strong>
          <span>Select a service to trace its dependencies</span>
        </div>
        <svg class="edges" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${edges}</svg>
        <div class="hub"><div class="hub-inner">${projectMark}</div></div>
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

export function interactiveTsxPage(graph, { desktop = false } = {}) {
  return `'use client';

${desktop ? "import ForceGraph3D from 'react-force-graph-3d';" : "import dynamic from 'next/dynamic';"}
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import type { ForceGraphMethods, NodeObject } from 'react-force-graph-3d';
import * as THREE from 'three';
import SpriteText from 'three-spritetext';

const css = ${JSON.stringify(pageCss())};
type Evidence = { type?: string; value?: string; confidence?: string };
type RawService = { id: string; name: string; key?: string; category?: string; confidence?: string; evidence?: Evidence[]; iconUrl?: string | null; parentId?: string | null };
type ServiceNode = RawService & { color: string; x: number; y: number };
type DraftDetails = { subtitle: string; use: string; account: string; passwordLocation: string };
type NewServiceDraft = { name: string; category: string; parentId: string };
type ServiceLink = { label: string; url: string };
type GraphNode3D = { id: string; name: string; category: string; color: string; iconUrl?: string | null; monogram: string; isProduct: boolean; x?: number; y?: number; z?: number };
type GraphLink3D = { id: string; source: string | GraphNode3D; target: string | GraphNode3D; label: string };
type AdjustableForce = { strength?: (value: number) => unknown; distance?: (value: number) => unknown };
type OrbitControlsLike = { target?: THREE.Vector3 };

const graph = ${JSON.stringify(graph)} as { generatedAt: string; project?: { name?: string; logoUrl?: string }; services?: RawService[] };
const palette = ${JSON.stringify(palette)} as string[];
const layout = ${JSON.stringify(layout)} as Array<{ x: number; y: number }>;
${desktop ? '' : "const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), { ssr: false });"}

function categoryLabel(value?: string | null) {
  return String(value ?? 'service').replace(/-/g, ' ');
}

function initials(name: string) {
  return name.split(/\\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function collectDescendantIds(nodes: ServiceNode[], selectedId: string | null) {
  const ids = new Set<string>();
  if (!selectedId) return ids;
  const childrenByParent = new Map<string, ServiceNode[]>();
  nodes.forEach((node) => {
    const parentId = node.parentId ?? 'project';
    const siblings = childrenByParent.get(parentId) ?? [];
    siblings.push(node);
    childrenByParent.set(parentId, siblings);
  });
  const queue = [...(childrenByParent.get(selectedId) ?? [])];
  while (queue.length) {
    const node = queue.shift()!;
    if (ids.has(node.id)) continue;
    ids.add(node.id);
    queue.push(...(childrenByParent.get(node.id) ?? []));
  }
  return ids;
}

function collectParentIds(nodes: ServiceNode[], selectedId: string | null) {
  const ids = new Set<string>();
  if (!selectedId) return ids;
  nodes.forEach((node) => {
    const parentId = node.parentId ?? 'project';
    if (node.id === selectedId) ids.add(parentId);
  });
  return ids;
}

function isActiveTreeEdge(sourceId: string, targetId: string, selectedId: string | null, parentIds: Set<string>, descendantIds: Set<string>) {
  if (!selectedId) return false;
  if (sourceId === selectedId && descendantIds.has(targetId)) return true;
  if (descendantIds.has(sourceId) && descendantIds.has(targetId)) return true;
  return parentIds.has(sourceId) && targetId === selectedId;
}

function Connections({ nodes, selectedId }: { nodes: ServiceNode[]; selectedId: string | null }) {
  const ref = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0, nodeHalfWidth: 125 });
  const parentIds = useMemo(() => collectParentIds(nodes, selectedId), [nodes, selectedId]);
  const descendantIds = useMemo(() => collectDescendantIds(nodes, selectedId), [nodes, selectedId]);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) => {
      const node = ref.current?.parentElement?.querySelector('.service-node');
      const nodeHalfWidth = node ? parseFloat(getComputedStyle(node).width) / 2 : 125;
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height, nodeHalfWidth });
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return <svg ref={ref} className="edges" aria-hidden="true">
    {size.width > 0 && nodes.map((node) => {
      const parent = nodes.find((candidate) => candidate.id === node.parentId);
      const direction = node.x < (parent?.x ?? 50) ? -1 : 1;
      const x1 = (parent?.x ?? 50) * size.width / 100 + direction * (parent ? size.nodeHalfWidth : 66);
      const y1 = (parent?.y ?? 50) * size.height / 100;
      const x2 = node.x * size.width / 100 - direction * size.nodeHalfWidth;
      const y2 = node.y * size.height / 100;
      const middle = (x1 + x2) / 2;
      const dx = Math.sign(x2 - x1);
      const dy = Math.sign(y2 - y1);
      const radius = Math.min(5, Math.abs(x2 - x1) / 4, Math.abs(y2 - y1) / 2);
      const path = \`M \${x1} \${y1} H \${middle - dx * radius} Q \${middle} \${y1} \${middle} \${y1 + dy * radius} V \${y2 - dy * radius} Q \${middle} \${y2} \${middle + dx * radius} \${y2} H \${x2}\`;
      const active = isActiveTreeEdge(node.parentId ?? 'project', node.id, selectedId, parentIds, descendantIds);
      return <path key={node.id} d={path} fill="none" stroke="rgba(103,130,118,.48)" strokeWidth="1.2" className={\`edge-line \${active ? 'is-active' : selectedId ? 'is-muted' : ''}\`} />;
    })}
  </svg>;
}

function primaryEvidence(service: RawService) {
  const evidence = service.evidence?.[0];
  return evidence ? \`\${evidence.type}: \${evidence.value}\` : 'No evidence captured yet.';
}

function endpointId(endpoint: string | number | GraphNode3D) {
  return typeof endpoint === 'object' ? endpoint.id : String(endpoint);
}

function graphNode(node: NodeObject) {
  return node as GraphNode3D;
}

function graphLink(link: GraphLink3D) {
  return link;
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'service';
}

function servicePosition(index: number) {
  const point = layout[index];
  if (point) return point;
  const angle = (index - layout.length) * 2.399963229728653;
  const radius = 34 + ((index - layout.length) % 4) * 4;
  return {
    x: 50 + Math.cos(angle) * radius,
    y: 50 + Math.sin(angle) * radius * 0.72,
  };
}

function relationshipLabel(parentId?: string | null) {
  return parentId ? 'depends on' : 'uses';
}

function iconObject(node: GraphNode3D, selected: boolean) {
  const group = new THREE.Group();
  const radius = node.isProduct ? 10 : 7;
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 32, 32),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(node.color),
      emissive: new THREE.Color(node.color),
      emissiveIntensity: selected ? 0.65 : 0.23,
      metalness: 0.18,
      roughness: 0.48,
    }),
  );
  group.add(shell);

  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(radius + (selected ? 2.2 : 1.25), 24, 24),
    new THREE.MeshBasicMaterial({ color: selected ? '#9ff0cb' : node.color, transparent: true, opacity: selected ? 0.18 : 0.07, side: THREE.BackSide }),
  );
  group.add(halo);

  const fallback = new SpriteText(node.monogram.slice(0, 3));
  fallback.color = '#ffffff';
  fallback.textHeight = node.isProduct ? 4.2 : 3.2;
  fallback.fontSize = 180;
  fallback.fontWeight = '700';
  fallback.renderOrder = 10;
  fallback.material.depthTest = false;
  fallback.material.depthWrite = false;
  group.add(fallback);

  if (node.iconUrl) {
    new THREE.TextureLoader().load(node.iconUrl, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 16;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = true;
      texture.needsUpdate = true;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, alphaTest: 0.015 }));
      const size = node.isProduct ? 12 : 8.5;
      sprite.scale.set(size, size, 1);
      sprite.renderOrder = 10;
      group.add(sprite);
      fallback.visible = false;
    });
  }

  const label = new SpriteText(node.name);
  label.color = selected ? '#b9f6da' : '#dfeae4';
  label.textHeight = selected ? 4.1 : 3.2;
  label.fontSize = 220;
  label.fontWeight = selected ? '700' : '600';
  label.backgroundColor = 'rgba(5, 8, 7, .72)';
  label.padding = 1.5;
  label.borderRadius = 2;
  label.position.y = -(radius + 6.8);
  label.renderOrder = 11;
  label.material.depthTest = false;
  label.material.depthWrite = false;
  group.add(label);
  return group;
}

function serviceLinks(service: RawService): ServiceLink[] {
  const lower = service.name.toLowerCase();
  const links: ServiceLink[] = [];
  if (service.iconUrl) links.push({ label: \`\${service.name} docs\`, url: service.iconUrl.replace('/icons/', '/') });
  if (lower.includes('firebase')) links.push({ label: 'Firebase console', url: 'https://console.firebase.google.com/' });
  if (lower.includes('google')) links.push({ label: 'Google Cloud console', url: 'https://console.cloud.google.com/' });
  if (lower.includes('cloudflare')) links.push({ label: 'Cloudflare dashboard', url: 'https://dash.cloudflare.com/' });
  if (lower.includes('github')) links.push({ label: 'GitHub', url: 'https://github.com/' });
  if (lower.includes('stripe')) links.push({ label: 'Stripe dashboard', url: 'https://dashboard.stripe.com/' });
  if (lower.includes('vercel')) links.push({ label: 'Vercel dashboard', url: 'https://vercel.com/dashboard' });
  if (lower.includes('microsoft')) links.push({ label: 'Microsoft Azure portal', url: 'https://portal.azure.com/' });
  if (links.length === 0) links.push({ label: \`\${service.name} website\`, url: \`https://www.google.com/search?q=\${encodeURIComponent(service.name)}\` });
  return links.slice(0, 4);
}

function ServiceLogo({ service }: { service: RawService & { color: string } }) {
  return (
    <div className="logo" style={{ background: service.color }}>
      {service.iconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={service.iconUrl} alt="" />
      ) : (
        <span>{initials(service.name)}</span>
      )}
    </div>
  );
}

function ProjectMark() {
  return graph.project?.logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={graph.project.logoUrl} alt={\`\${graph.project?.name ?? 'Project'} logo\`} />
  ) : (
    <>⌘</>
  );
}

function DetailsPanel({
  service,
  details,
  onChange,
  onClose,
}: {
  service: ServiceNode;
  details: DraftDetails;
  onChange: (details: DraftDetails) => void;
  onClose: () => void;
}) {
  const links = serviceLinks(service);
  return (
    <>
      <div className="drawer-scrim" />
      <aside className="details-panel" aria-label={\`\${service.name} details\`}>
        <div className="details-head">
          <ServiceLogo service={service} />
          <div className="details-title">
            <span>{categoryLabel(service.category)}</span>
            <strong>{service.name}</strong>
          </div>
          <button type="button" className="close-button" onClick={onClose} aria-label="Close details">×</button>
        </div>

        <div className="details-body">
          <section className="details-section">
            <div className="section-heading">Service details</div>
            <label className="field-label" htmlFor="service-subtitle">Service subtitle</label>
            <input
              id="service-subtitle"
              className="details-input"
              value={details.subtitle}
              onChange={(event) => onChange({ ...details, subtitle: event.target.value })}
            />

            <label className="field-label" htmlFor="service-use">How it is used</label>
            <textarea
              id="service-use"
              className="details-textarea"
              value={details.use}
              onChange={(event) => onChange({ ...details, use: event.target.value })}
            />
          </section>

          <section className="details-section">
            <div className="section-heading">
              <span>Relevant links</span>
              <span>+ Add</span>
            </div>
            <div className="links-list">
              {links.map((link) => (
                <div className="link-card" key={link.label}>
                  <strong>{link.label}</strong>
                  <a className="link-button" href={link.url} target="_blank" rel="noreferrer">Open</a>
                  <span>{link.url}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="details-section">
            <div className="section-heading">Account</div>
            <label className="field-label" htmlFor="account-owner">Account owner or email</label>
            <input
              id="account-owner"
              className="details-input"
              value={details.account}
              onChange={(event) => onChange({ ...details, account: event.target.value })}
              placeholder="owner@example.com"
            />

            <label className="field-label" htmlFor="password-location">Password / vault item</label>
            <input
              id="password-location"
              className="details-input"
              value={details.passwordLocation}
              onChange={(event) => onChange({ ...details, passwordLocation: event.target.value })}
              placeholder="1Password item, vault record, or SSO note"
            />
            <p className="helper-text">Keep actual passwords in your password manager. Store only the vault item or access note here.</p>
          </section>
        </div>

        <div className="details-actions">
          <button type="button" className="delete-button">Delete</button>
          <button type="button" className="save-button">Save changes</button>
        </div>
      </aside>
    </>
  );
}

function AddServiceModal({
  draft,
  nodes,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: NewServiceDraft;
  nodes: ServiceNode[];
  onChange: (draft: NewServiceDraft) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <>
      <div className="drawer-scrim" />
      <section className="modal-card" aria-label="Add service">
        <div className="modal-head">
          <h2>Add service</h2>
          <button type="button" className="close-button" onClick={onClose} aria-label="Close add service">×</button>
        </div>
        <div className="modal-body">
          <label className="field-label" htmlFor="new-service-name">Service name</label>
          <input
            id="new-service-name"
            className="details-input"
            value={draft.name}
            onChange={(event) => onChange({ ...draft, name: event.target.value })}
            placeholder="Stripe, Vercel, Google Cloud"
            autoFocus
          />

          <label className="field-label" htmlFor="new-service-category">Use</label>
          <input
            id="new-service-category"
            className="details-input"
            value={draft.category}
            onChange={(event) => onChange({ ...draft, category: event.target.value })}
            placeholder="billing, hosting, analytics"
          />

          <label className="field-label" htmlFor="new-service-parent">Parent service</label>
          <select
            id="new-service-parent"
            className="details-input"
            value={draft.parentId}
            onChange={(event) => onChange({ ...draft, parentId: event.target.value })}
          >
            <option value="product">{graph.project?.name ?? 'Product'}</option>
            {nodes.map((node) => (
              <option key={node.id} value={node.id}>{node.name}</option>
            ))}
          </select>

          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
            <button type="button" className="save-button" onClick={onSubmit}>Add service</button>
          </div>
        </div>
      </section>
    </>
  );
}

function ServiceGraph3D({
  nodes,
  selectedId,
  resetKey,
  onSelect,
}: {
  nodes: ServiceNode[];
  selectedId: string | null;
  resetKey: number;
  onSelect: (id: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphMethods<GraphNode3D, GraphLink3D> | undefined>(undefined);
  const [size, setSize] = useState({ width: 900, height: 700 });
  const hasFramed = useRef(false);
  const hasConfiguredForces = useRef(false);
  const graphData = useMemo(() => ({
    nodes: [{
      id: 'project',
      name: graph.project?.name ?? 'Project',
      category: 'product',
      color: '#8be4b2',
      iconUrl: graph.project?.logoUrl,
      monogram: initials(graph.project?.name ?? 'Project'),
      isProduct: true,
    }, ...nodes.map((node): GraphNode3D => ({
      id: node.id,
      name: node.name,
      category: categoryLabel(node.category),
      color: node.color,
      iconUrl: node.iconUrl,
      monogram: initials(node.name),
      isProduct: node.category === 'product',
    }))],
    links: nodes.map((node): GraphLink3D => ({
      id: \`\${node.parentId ?? 'project'}-\${node.id}\`,
      source: node.parentId ?? 'project',
      target: node.id,
      label: node.confidence === 'high' ? relationshipLabel(node.parentId) : \`may \${relationshipLabel(node.parentId)}\`,
    })),
  }), [nodes]);
  const parentIds = useMemo(() => collectParentIds(nodes, selectedId), [nodes, selectedId]);
  const descendantIds = useMemo(() => collectDescendantIds(nodes, selectedId), [nodes, selectedId]);
  const activeTreeLinkIds = useMemo(() => {
    const ids = new Set<string>();
    graphData.links.forEach((link) => {
      const source = endpointId(link.source);
      const target = endpointId(link.target);
      if (isActiveTreeEdge(source, target, selectedId, parentIds, descendantIds)) ids.add(link.id);
    });
    return ids;
  }, [descendantIds, graphData.links, parentIds, selectedId]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: Math.max(1, entry.contentRect.width), height: Math.max(1, entry.contentRect.height) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const configureForces = useCallback(() => {
    const graphInstance = graphRef.current;
    if (!graphInstance || hasConfiguredForces.current) return;
    const charge = graphInstance.d3Force('charge') as AdjustableForce | undefined;
    const link = graphInstance.d3Force('link') as AdjustableForce | undefined;
    graphInstance.renderer().setPixelRatio(Math.min(window.devicePixelRatio * 1.5, 3));
    charge?.strength?.(-720);
    link?.distance?.(210);
    graphInstance.d3ReheatSimulation();
    hasConfiguredForces.current = true;
  }, []);

  useEffect(() => {
    hasFramed.current = false;
    hasConfiguredForces.current = false;
    const frame = window.requestAnimationFrame(configureForces);
    const initialFit = window.setTimeout(() => graphRef.current?.zoomToFit(400, 100), 350);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(initialFit);
    };
  }, [configureForces, graphData.nodes.length, graphData.links.length]);

  useEffect(() => {
    if (!resetKey) return;
    graphRef.current?.zoomToFit(700, 130);
  }, [resetKey]);

  const focusNode = useCallback((node: NodeObject) => {
    const serviceNode = graphNode(node);
    onSelect(serviceNode.id);
    if (serviceNode.x === undefined || serviceNode.y === undefined || serviceNode.z === undefined) return;
    const distance = Math.hypot(serviceNode.x, serviceNode.y, serviceNode.z) || 1;
    const ratio = 1 + 105 / distance;
    graphRef.current?.cameraPosition(
      { x: serviceNode.x * ratio, y: serviceNode.y * ratio, z: serviceNode.z * ratio },
      { x: serviceNode.x, y: serviceNode.y, z: serviceNode.z },
      850,
    );
  }, [onSelect]);

  const zoom = useCallback((factor: number) => {
    const graphInstance = graphRef.current;
    if (!graphInstance) return;
    const camera = graphInstance.camera();
    const controls = graphInstance.controls() as OrbitControlsLike;
    const target = controls.target?.clone() ?? new THREE.Vector3();
    const offset = camera.position.clone().sub(target);
    const currentDistance = offset.length();
    if (currentDistance === 0) return;
    const nextDistance = Math.max(35, currentDistance * factor);
    if (camera instanceof THREE.PerspectiveCamera && nextDistance * 4 > camera.far) {
      camera.far = nextDistance * 4;
      camera.updateProjectionMatrix();
    }
    const nextPosition = target.clone().add(offset.multiplyScalar(nextDistance / currentDistance));
    graphInstance.cameraPosition(nextPosition, target, 240);
  }, []);

  return (
    <div className="graph-3d" ref={containerRef}>
      <ForceGraph3D
        ref={graphRef as never}
        width={size.width}
        height={size.height}
        graphData={graphData}
        backgroundColor="rgba(0,0,0,0)"
        showNavInfo={false}
        nodeThreeObject={(node) => {
          const serviceNode = graphNode(node);
          return iconObject(serviceNode, serviceNode.id === selectedId);
        }}
        nodeLabel={(node) => {
          const serviceNode = graphNode(node);
          return \`\${serviceNode.name} · \${serviceNode.category}\`;
        }}
        linkLabel={(link) => graphLink(link as GraphLink3D).label}
        linkColor={(link) => {
          const serviceLink = graphLink(link as GraphLink3D);
          if (!selectedId) return '#415149';
          return activeTreeLinkIds.has(serviceLink.id) ? '#7ee2b8' : '#17211c';
        }}
        linkWidth={(link) => {
          const serviceLink = graphLink(link as GraphLink3D);
          return activeTreeLinkIds.has(serviceLink.id) ? 2.2 : selectedId ? 0.35 : 0.8;
        }}
        linkOpacity={0.8}
        linkDirectionalArrowLength={3.5}
        linkDirectionalArrowRelPos={0.8}
        linkDirectionalArrowColor={(link) => {
          const serviceLink = graphLink(link as GraphLink3D);
          return activeTreeLinkIds.has(serviceLink.id) ? '#9ff0cb' : '#506158';
        }}
        linkDirectionalParticles={(link) => {
          const serviceLink = graphLink(link as GraphLink3D);
          return activeTreeLinkIds.has(serviceLink.id) ? 3 : 0;
        }}
        linkDirectionalParticleWidth={1.8}
        linkDirectionalParticleSpeed={0.006}
        linkDirectionalParticleColor={() => '#b9f6da'}
        d3AlphaDecay={0.026}
        d3VelocityDecay={0.18}
        warmupTicks={90}
        cooldownTicks={260}
        onNodeClick={focusNode}
        onBackgroundClick={() => onSelect(null)}
        onEngineTick={configureForces}
        onEngineStop={() => {
          if (hasFramed.current) return;
          hasFramed.current = true;
          graphRef.current?.zoomToFit(700, 130);
        }}
      />
      <div className="graph-3d__zoom" aria-label="3D zoom controls">
        <button type="button" onClick={() => zoom(1 / 1.5)} title="Zoom in" aria-label="Zoom in">+</button>
        <button type="button" onClick={() => zoom(1.5)} title="Zoom out" aria-label="Zoom out">−</button>
      </div>
      <div className="graph-3d__help" aria-hidden="true">Drag to rotate <span /> Scroll to zoom <span /> Click a service</div>
      {selectedId && <div className="graph-3d__focus" aria-hidden="true">{activeTreeLinkIds.size} connections highlighted</div>}
    </div>
  );
}

export default function InternalServiceMapPage() {
  const [services, setServices] = useState<RawService[]>(() => graph.services ?? []);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const positionsRef = useRef(positions);
  const layoutKey = 'servicemap:positions:' + (graph.project?.name ?? 'project');
  const nodeDrag = useRef<{ id: string; pointerId: number; clientX: number; clientY: number; x: number; y: number; width: number; height: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(layoutKey) ?? '{}');
      const valid = Object.fromEntries(Object.entries(stored).filter(([, value]) => {
        const point = value as { x?: number; y?: number } | null;
        return point && Number.isFinite(point.x) && Number.isFinite(point.y);
      })) as Record<string, { x: number; y: number }>;
      positionsRef.current = valid;
      setPositions(valid);
    } catch { /* Layout remains usable when storage is unavailable. */ }
  }, [layoutKey]);
  const nodes = useMemo<ServiceNode[]>(() => services.map((service, index) => ({
    ...service,
    ...servicePosition(index),
    ...positions[service.id],
    color: palette[index % palette.length],
  })), [services, positions]);
  const [mode, setMode] = useState<'2d' | '3d'>('2d');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState<{ pointerId: number; x: number; y: number; panX: number; panY: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reset3DKey, setReset3DKey] = useState(0);
  const startNodeDrag = (event: PointerEvent<HTMLButtonElement>, node: ServiceNode) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    const plane = event.currentTarget.parentElement!.getBoundingClientRect();
    event.currentTarget.setPointerCapture(event.pointerId);
    suppressClick.current = false;
    nodeDrag.current = { id: node.id, pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, x: node.x, y: node.y, width: plane.width, height: plane.height, moved: false };
  };
  const moveNodeDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = nodeDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.stopPropagation();
    const dx = event.clientX - drag.clientX;
    const dy = event.clientY - drag.clientY;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    drag.moved = true;
    suppressClick.current = true;
    const next = { ...positionsRef.current, [drag.id]: { x: drag.x + dx / drag.width * 100, y: drag.y + dy / drag.height * 100 } };
    positionsRef.current = next;
    setPositions(next);
  };
  const stopNodeDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = nodeDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.stopPropagation();
    nodeDrag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (drag.moved) {
      try { localStorage.setItem(layoutKey, JSON.stringify(positionsRef.current)); } catch { /* Keep the current layout in memory. */ }
    }
  };
  const [isAddingService, setIsAddingService] = useState(false);
  const [newService, setNewService] = useState<NewServiceDraft>({ name: '', category: '', parentId: 'product' });
  const [drafts, setDrafts] = useState<Record<string, DraftDetails>>(() => Object.fromEntries(nodes.map((service) => [
    service.id,
    {
      subtitle: categoryLabel(service.category),
      use: primaryEvidence(service),
      account: '',
      passwordLocation: '',
    },
  ])));
  const selected = nodes.find((service) => service.id === selectedId) ?? null;
  const descendantIds = useMemo(() => collectDescendantIds(nodes, selectedId), [nodes, selectedId]);
  const highlightedChildIds = useMemo(() => selectedId === 'project' ? descendantIds : new Set<string>(), [descendantIds, selectedId]);
  const zoomIn = () => setZoom((current) => Math.min(1.45, current * 1.5));
  const zoomOut = () => setZoom((current) => current / 1.5);
  const resetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };
  const centerMap = () => {
    if (mode === '3d') {
      setReset3DKey((current) => current + 1);
      return;
    }
    resetZoom();
  };
  const startPan = (event: PointerEvent<HTMLElement>) => {
    if (mode !== '2d' || event.button !== 0 || (event.target as HTMLElement).closest('button, a, input, textarea, select')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setPanStart({ pointerId: event.pointerId, x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y });
  };
  const movePan = (event: PointerEvent<HTMLElement>) => {
    if (!panStart || panStart.pointerId !== event.pointerId) return;
    setPan({
      x: panStart.panX + event.clientX - panStart.x,
      y: panStart.panY + event.clientY - panStart.y,
    });
  };
  const stopPan = (event: PointerEvent<HTMLElement>) => {
    if (panStart?.pointerId !== event.pointerId) return;
    setPanStart(null);
  };
  const addService = () => {
    const name = newService.name.trim();
    if (!name) return;
    const baseId = slugify(name);
    const existingIds = new Set(services.map((service) => service.id));
    let id = baseId;
    let suffix = 2;
    while (existingIds.has(id)) {
      id = \`\${baseId}-\${suffix}\`;
      suffix += 1;
    }
    const service: RawService = {
      id,
      key: id,
      name,
      category: newService.category.trim() || 'service',
      confidence: 'manual',
      evidence: [{ type: 'manual', value: 'Added in servicemap UI.', confidence: 'manual' }],
      iconUrl: null,
      parentId: newService.parentId === 'product' ? null : newService.parentId,
    };
    setServices((current) => [...current, service]);
    setDrafts((current) => ({
      ...current,
      [id]: {
        subtitle: categoryLabel(service.category),
        use: primaryEvidence(service),
        account: '',
        passwordLocation: '',
      },
    }));
    setSelectedId(id);
    setNewService({ name: '', category: '', parentId: 'product' });
    setIsAddingService(false);
  };

  return (
    <main className="servicemap-shell">
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <header className="servicemap-topbar">
        <div className="brand">
          <div className="brand-mark"><ProjectMark /></div>
          <div>
            <h1>servicemap</h1>
            <p>{graph.project?.name ?? 'Project'} command center</p>
          </div>
        </div>
        <div className="top-actions">
          <span>{nodes.length} services</span>
          <div className="mode-toggle" aria-label="View mode">
            <button type="button" className={\`mode-button \${mode === '2d' ? 'is-active' : ''}\`} onClick={() => setMode('2d')}>2D</button>
            <button type="button" className={\`mode-button \${mode === '3d' ? 'is-active' : ''}\`} onClick={() => setMode('3d')}>3D</button>
          </div>
          <button type="button" className="center-button" onClick={centerMap} aria-label="Center graph" title="Center graph"><span className="center-icon" aria-hidden="true" /></button>
          <button type="button" className="add-service-button" onClick={() => {
            setNewService((current) => ({ ...current, parentId: selectedId && selectedId !== 'project' ? selectedId : 'product' }));
            setIsAddingService(true);
          }}>+ Add service</button>
        </div>
      </header>

      <section
        className={\`map \${panStart ? 'is-panning' : ''} \${selectedId ? 'has-selection' : ''}\`}
        onPointerDown={startPan}
        onPointerMove={movePan}
        onPointerUp={stopPan}
        onPointerCancel={stopPan}
      >
        <div className="intro">
          <strong>{graph.project?.name ?? 'Project'} infrastructure</strong>
          <span>{selected ? \`Tracing \${selected.name}\` : selectedId === 'project' ? \`Tracing \${graph.project?.name ?? 'Project'}\` : mode === '3d' ? 'Rotate and explore your service relationships' : 'Select a service to trace its dependencies'}</span>
        </div>
        {mode === '2d' ? (
          <>
            <div className="map-plane" style={{ '--zoom': zoom, '--pan-x': \`\${pan.x}px\`, '--pan-y': \`\${pan.y}px\` } as CSSProperties}>
              <Connections nodes={nodes} selectedId={selectedId} />
              <button type="button" className={\`hub \${selectedId === 'project' ? 'is-selected' : ''}\`} onClick={() => setSelectedId('project')} aria-label={\`Trace \${graph.project?.name ?? 'Project'} child services\`}><div className="hub-inner"><ProjectMark /></div></button>
              {nodes.map((service) => {
                const isHighlightedChild = highlightedChildIds.has(service.id);
                const isRelated = descendantIds.has(service.id) || selected?.parentId === service.id || isHighlightedChild;
                return (
                <button
                  type="button"
                  key={service.id}
                  className={\`service-node \${selectedId === service.id ? 'is-selected' : ''} \${isRelated ? 'is-related' : ''} \${isHighlightedChild ? 'is-highlighted-child' : ''}\`}
                  style={{ left: \`\${service.x}%\`, top: \`\${service.y}%\` }}
                  onPointerDown={(event) => startNodeDrag(event, service)}
                  onPointerMove={moveNodeDrag}
                  onPointerUp={stopNodeDrag}
                  onPointerCancel={stopNodeDrag}
                  onLostPointerCapture={stopNodeDrag}
                  onClick={(event) => {
                    if (event.detail !== 0 && suppressClick.current) { suppressClick.current = false; return; }
                    setSelectedId(service.id);
                  }}
                >
                  <ServiceLogo service={service} />
                  <div className="service-copy">
                    <strong>{service.name}</strong>
                    <span>{categoryLabel(service.category)}</span>
                  </div>
                  <i className={\`status-dot status-\${service.confidence}\`} />
                </button>
                );
              })}
            </div>
            <div className="legend">
              <span><i style={{ background: '#4a7cff' }} />Cloud</span>
              <span><i style={{ background: '#8be4b2' }} />Product</span>
              <span><i style={{ background: '#65f0ad' }} />Active path</span>
            </div>
          </>
        ) : (
          <ServiceGraph3D nodes={nodes} selectedId={selectedId} resetKey={reset3DKey} onSelect={setSelectedId} />
        )}
        <div className="zoom-controls" aria-label="Map zoom controls">
          <button type="button" className="zoom-button" onClick={zoomIn} aria-label="Zoom in">+</button>
          <button type="button" className="zoom-button" onClick={zoomOut} aria-label="Zoom out">−</button>
          <button type="button" className="zoom-button" onClick={resetZoom} aria-label="Reset zoom"><span className="fit-icon" aria-hidden="true" /></button>
        </div>
        <footer className="scan-foot">
          <div>Generated {new Date(graph.generatedAt).toLocaleString()}</div>
          <div>{nodes.length} services detected</div>
        </footer>
        {selected && drafts[selected.id] ? (
          <DetailsPanel
            service={selected}
            details={drafts[selected.id]}
            onClose={() => setSelectedId(null)}
            onChange={(nextDetails) => setDrafts((current) => ({ ...current, [selected.id]: nextDetails }))}
          />
        ) : null}
        {isAddingService ? (
          <AddServiceModal
            draft={newService}
            nodes={nodes}
            onChange={setNewService}
            onClose={() => setIsAddingService(false)}
            onSubmit={addService}
          />
        ) : null}
      </section>
    </main>
  );
}
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

  return interactiveTsxPage(graph);
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

export async function prepareProjectLogo(graph, outputRoot) {
  const logoPath = graph.project?.logo?.path;
  if (!logoPath) return;

  const sourceRoot = graph.project?.root ? resolve(graph.project.root) : outputRoot;
  const sourcePath = isAbsolute(logoPath) ? logoPath : resolve(sourceRoot, logoPath);
  if (!existsSync(sourcePath)) return;

  const extension = extname(sourcePath) || '.png';
  const assetDir = join(outputRoot, 'public', 'internalservicemap-assets');
  const assetPath = join(assetDir, `project-logo${extension}`);
  await mkdir(assetDir, { recursive: true });
  await copyFile(sourcePath, assetPath);

  graph.project.logoUrl = `/internalservicemap-assets/project-logo${extension}`;
}

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', ...options });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

async function ensureInteractivePageDependencies(root, routeKind) {
  if (routeKind === 'static' || routeKind === 'astro') return;
  const packageJsonPath = join(root, 'package.json');
  const packageJson = await readJsonOrNull(packageJsonPath);
  if (!packageJson) return;

  const dependencies = {
    'react-force-graph-3d': '^1.29.1',
    three: '^0.185.1',
    'three-spritetext': '^1.10.0',
  };
  const devDependencies = {
    '@types/three': '^0.185.4',
  };
  let changed = false;

  packageJson.dependencies ??= {};
  for (const [name, version] of Object.entries(dependencies)) {
    if (packageJson.dependencies[name] || packageJson.devDependencies?.[name]) continue;
    packageJson.dependencies[name] = version;
    changed = true;
  }

  packageJson.devDependencies ??= {};
  for (const [name, version] of Object.entries(devDependencies)) {
    if (packageJson.dependencies?.[name] || packageJson.devDependencies[name]) continue;
    packageJson.devDependencies[name] = version;
    changed = true;
  }

  if (!changed) return;
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
  if (existsSync(join(root, 'package-lock.json'))) {
    await run('npm', ['install'], { cwd: root });
  }
}

async function main() {
  const options = parseArgs();
  const graph = await readJson(options.input);
  await prepareProjectLogo(graph, options.root);
  const route = routeFor(options.root, graph.project?.framework);
  const contents = route.kind === 'astro' ? astroPage(graph) : route.kind === 'static' ? staticHtml(graph) : tsxPage(graph);

  await mkdir(dirname(route.path), { recursive: true });
  await writeFile(route.path, contents);
  await ensureInteractivePageDependencies(options.root, route.kind);
  console.log(`Wrote /internalservicemap page to ${route.path}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch((error) => {
  console.error(error);
  process.exit(1);
});
