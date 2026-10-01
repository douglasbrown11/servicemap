#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
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
    .mode-toggle { display: inline-flex; gap: 4px; padding: 4px; border-radius: 10px; background: #0b130f; }
    .mode-button { min-height: 36px; border: 0; border-radius: 8px; background: transparent; color: #789086; padding: 0 12px; cursor: pointer; font: inherit; font-weight: 800; }
    .mode-button.is-active { background: #276f53; color: #c9f9df; box-shadow: 0 0 18px rgba(101,240,173,0.16); }
    .map { position: relative; height: calc(100vh - 88px); min-height: 760px; background: radial-gradient(circle at 50% 52%, rgba(41, 96, 69, 0.22), transparent 24%), radial-gradient(circle at 1px 1px, rgba(88, 160, 120, 0.2) 1px, transparent 1px), #020806; background-size: auto, 28px 28px, auto; }
    .intro { position: absolute; left: 32px; top: 32px; z-index: 20; }
    .intro strong { display: block; color: #779286; font-size: 12px; letter-spacing: 0.22em; text-transform: uppercase; }
    .intro span { display: block; margin-top: 8px; color: #53665d; font-size: 14px; }
    .edges { position: absolute; inset: 0; z-index: 26; width: 100%; height: 100%; pointer-events: none; }
    .edge-line { transition: opacity 180ms ease, stroke 180ms ease; }
    .edge-line.is-active { stroke: #65f0ad !important; stroke-width: 0.28; stroke-linecap: round; stroke-dasharray: 0.72 0.58; animation: servicemapDash 1.1s linear infinite; filter: drop-shadow(0 0 6px rgba(101,240,173,0.72)); opacity: 1; }
    .edge-line.is-muted { opacity: 0.24; }
    .hub { position: absolute; left: 50%; top: 50%; z-index: 20; width: 132px; height: 132px; transform: translate(-50%, -50%); border-radius: 24px; border: 1px solid #315c47; background: #09120d; display: grid; place-items: center; box-shadow: 0 0 0 9px rgba(79,183,128,0.12), 0 0 42px rgba(100,255,174,0.16); }
    .hub-inner { width: 92px; height: 92px; border-radius: 18px; background: #fbfbf7; color: #111612; display: grid; place-items: center; font-size: 40px; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.08); }
    .service-node { position: absolute; z-index: 10; width: 250px; height: 74px; transform: translate(-50%, -50%); display: flex; align-items: center; gap: 16px; padding: 0 16px; border-radius: 8px; border: 1px solid #274036; background: rgba(16,24,19,0.95); box-shadow: 0 0 0 1px rgba(140,255,190,0.05), 0 18px 44px rgba(0,0,0,0.38); }
    button.service-node { cursor: pointer; color: inherit; font: inherit; text-align: left; }
    .service-node:hover, .service-node.is-selected { border-color: #66efae; box-shadow: 0 0 0 2px rgba(101,240,173,0.42), 0 18px 44px rgba(0,0,0,0.38); }
    .service-node.is-selected { z-index: 27; }
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
    .drawer-scrim { position: absolute; inset: 0; z-index: 24; background: rgba(0,0,0,0.58); pointer-events: none; }
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
    .three-scene { position: absolute; inset: 0; perspective: 920px; overflow: hidden; cursor: grab; touch-action: none; }
    .three-scene:active { cursor: grabbing; }
    .three-space { position: absolute; left: 50%; top: 50%; width: 620px; height: 620px; transform-style: preserve-3d; transform: translate(-50%, -50%) rotateX(var(--rx, 58deg)) rotateZ(var(--rz, -28deg)); transition: transform 140ms ease; pointer-events: none; }
    .three-link { position: absolute; left: 50%; top: 50%; width: var(--length); height: 1px; transform-origin: 0 0; transform: translate3d(0, 0, 0) rotateZ(var(--angle)) translateY(var(--z)); background: linear-gradient(90deg, rgba(101,240,173,0.42), rgba(101,240,173,0.05)); }
    .three-link.is-active { height: 2px; background: repeating-linear-gradient(90deg, #65f0ad 0 8px, transparent 8px 14px); box-shadow: 0 0 14px rgba(101,240,173,0.68); animation: servicemapLinkFlow 1s linear infinite; }
    .three-node { position: absolute; left: 50%; top: 50%; width: 82px; height: 82px; transform: translate3d(var(--x), var(--y), var(--z)) translate(-50%, -50%) rotateZ(28deg) rotateX(-58deg); border: 0; border-radius: 999px; background: transparent; color: #eaf8f1; cursor: pointer; font: inherit; text-align: center; pointer-events: auto; }
    .three-orb { display: grid; place-items: center; width: 38px; height: 38px; margin: 0 auto 7px; border-radius: 999px; background: var(--color); color: #fff; box-shadow: 0 0 28px color-mix(in srgb, var(--color), transparent 44%); font-size: 12px; font-weight: 900; }
    .three-node span { display: block; font-size: 10px; line-height: 1.15; text-shadow: 0 2px 8px #000; }
    .three-node.is-selected .three-orb { outline: 2px solid #65f0ad; outline-offset: 4px; }
    .three-core { position: absolute; left: 50%; top: 50%; display: grid; place-items: center; width: 72px; height: 72px; transform: translate(-50%, -50%); border-radius: 999px; background: #f7faf7; color: #101611; font-size: 30px; box-shadow: 0 0 0 10px rgba(101,240,173,0.14), 0 0 46px rgba(101,240,173,0.22); }
    .three-hint { position: absolute; left: 50%; bottom: 30px; z-index: 21; transform: translateX(-50%); border: 1px solid rgba(255,255,255,0.1); border-radius: 999px; background: rgba(11,20,15,0.9); color: #789086; padding: 10px 18px; font-size: 12px; }
    @keyframes servicemapDash { to { stroke-dashoffset: -1.3; } }
    @keyframes servicemapLinkFlow { to { background-position: 22px 0; } }
    @media (max-width: 920px) {
      .map { min-height: 1120px; }
      .service-node { width: 220px; }
      .top-actions { display: none; }
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

function interactiveTsxPage(graph) {
  return `'use client';

import { useMemo, useState, type CSSProperties } from 'react';

const css = ${JSON.stringify(pageCss())};
type Evidence = { type?: string; value?: string; confidence?: string };
type RawService = { id: string; name: string; key?: string; category?: string; confidence?: string; evidence?: Evidence[]; iconUrl?: string | null };
type ServiceNode = RawService & { color: string; x: number; y: number };
type DraftDetails = { subtitle: string; use: string; account: string; passwordLocation: string };
type ServiceLink = { label: string; url: string };

const graph = ${JSON.stringify(graph)} as { generatedAt: string; project?: { name?: string; logoUrl?: string }; services?: RawService[] };
const palette = ${JSON.stringify(palette)} as string[];
const layout = ${JSON.stringify(layout)} as Array<{ x: number; y: number }>;

function categoryLabel(value?: string | null) {
  return String(value ?? 'service').replace(/-/g, ' ');
}

function initials(name: string) {
  return name.split(/\\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function edgePath(node: ServiceNode) {
  const isLeft = node.x < 50;
  const fromX = isLeft ? node.x + 8 : node.x - 8;
  const endX = isLeft ? 47 : 53;
  const midX = isLeft ? Math.max(fromX + 7, 42) : Math.min(fromX - 7, 58);
  return \`M \${fromX} \${node.y} H \${midX} V 50 H \${endX}\`;
}

function threePosition(index: number, count: number) {
  const angle = (index / Math.max(count, 1)) * Math.PI * 2 - Math.PI / 2;
  const radius = index % 3 === 0 ? 270 : index % 3 === 1 ? 215 : 320;
  const z = ((index % 5) - 2) * 32;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
    z,
    angle: (angle * 180) / Math.PI,
    length: radius,
  };
}

function threeNodeStyle(index: number, count: number, color: string): CSSProperties {
  const position = threePosition(index, count);
  return {
    '--x': \`\${position.x}px\`,
    '--y': \`\${position.y}px\`,
    '--z': \`\${position.z}px\`,
    '--color': color,
  } as CSSProperties;
}

function threeLinkStyle(index: number, count: number): CSSProperties {
  const position = threePosition(index, count);
  return {
    '--angle': \`\${position.angle}deg\`,
    '--length': \`\${position.length}px\`,
    '--z': \`\${position.z}px\`,
  } as CSSProperties;
}

function primaryEvidence(service: RawService) {
  const evidence = service.evidence?.[0];
  return evidence ? \`\${evidence.type}: \${evidence.value}\` : 'No evidence captured yet.';
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

export default function InternalServiceMapPage() {
  const nodes = useMemo<ServiceNode[]>(() => (graph.services ?? []).slice(0, layout.length).map((service, index) => ({
    ...service,
    ...layout[index],
    color: palette[index % palette.length],
  })), []);
  const [mode, setMode] = useState<'2d' | '3d'>('2d');
  const [rotation, setRotation] = useState({ x: 58, z: -28 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
        </div>
      </header>

      <section className="map">
        <div className="intro">
          <strong>{graph.project?.name ?? 'Project'} infrastructure</strong>
          <span>{selected ? \`Tracing \${selected.name}\` : mode === '3d' ? 'Rotate and explore your service relationships' : 'Select a service to trace its dependencies'}</span>
        </div>
        {mode === '2d' ? (
          <>
            <svg className="edges" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              {nodes.map((service) => (
                <path
                  key={service.id}
                  className={\`edge-line \${selectedId === service.id ? 'is-active' : selectedId ? 'is-muted' : ''}\`}
                  d={edgePath(service)}
                  fill="none"
                  stroke={selectedId === service.id ? '#65f0ad' : 'rgba(103, 130, 118, 0.48)'}
                  strokeWidth={selectedId === service.id ? '0.28' : '0.16'}
                  strokeDasharray={selectedId === service.id ? '0.72 0.58' : undefined}
                  strokeLinecap={selectedId === service.id ? 'round' : undefined}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>
            <div className="hub"><div className="hub-inner"><ProjectMark /></div></div>
            {nodes.map((service) => (
              <button
                type="button"
                key={service.id}
                className={\`service-node \${selectedId === service.id ? 'is-selected' : ''}\`}
                style={{ left: \`\${service.x}%\`, top: \`\${service.y}%\` }}
                onClick={() => setSelectedId(service.id)}
              >
                <ServiceLogo service={service} />
                <div className="service-copy">
                  <strong>{service.name}</strong>
                  <span>{categoryLabel(service.category)}</span>
                </div>
                <i className={\`status-dot status-\${service.confidence}\`} />
              </button>
            ))}
            <div className="legend">
              <span><i style={{ background: '#4a7cff' }} />Cloud</span>
              <span><i style={{ background: '#8be4b2' }} />Product</span>
              <span><i style={{ background: '#65f0ad' }} />Active path</span>
            </div>
          </>
        ) : (
          <div className="three-scene" aria-label="3D service graph">
            <div className="three-space" style={{ '--rx': \`\${rotation.x}deg\`, '--rz': \`\${rotation.z}deg\` } as CSSProperties}>
              {nodes.map((service, index) => (
                <span
                  key={\`\${service.id}-link\`}
                  className={\`three-link \${selectedId === service.id ? 'is-active' : ''}\`}
                  style={threeLinkStyle(index, nodes.length)}
                />
              ))}
              <div className="three-core"><ProjectMark /></div>
              {nodes.map((service, index) => (
                <button
                  type="button"
                  key={service.id}
                  className={\`three-node \${selectedId === service.id ? 'is-selected' : ''}\`}
                  style={threeNodeStyle(index, nodes.length, service.color)}
                  onPointerMove={(event) => {
                    if (event.buttons !== 1) return;
                    setRotation((current) => ({
                      x: Math.max(24, Math.min(72, current.x - event.movementY * 0.25)),
                      z: current.z + event.movementX * 0.25,
                    }));
                  }}
                  onClick={() => setSelectedId(service.id)}
                >
                  <span className="three-orb">{initials(service.name)}</span>
                  <span>{service.name}</span>
                </button>
              ))}
            </div>
            <div className="three-hint">Drag to rotate / Scroll to zoom / Click a service</div>
          </div>
        )}
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

async function prepareProjectLogo(graph, outputRoot) {
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

async function main() {
  const options = parseArgs();
  const graph = await readJson(options.input);
  await prepareProjectLogo(graph, options.root);
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
