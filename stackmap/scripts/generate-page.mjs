#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const defaultInput = '.stackmap/internal-stackmap.json';

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
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #f7f8fb; color: #172033; }
    .stackmap-shell { max-width: 1180px; margin: 0 auto; padding: 40px 24px 56px; }
    .stackmap-header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-end; margin-bottom: 24px; }
    h1 { margin: 0 0 8px; font-size: clamp(30px, 4vw, 48px); line-height: 1; letter-spacing: 0; }
    p { margin: 0; color: #5f6b7c; line-height: 1.55; }
    .summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 22px 0; }
    .metric, .service-card { background: #fff; border: 1px solid #e3e8ef; border-radius: 8px; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04); }
    .metric { padding: 16px; }
    .metric strong { display: block; font-size: 26px; }
    .metric span { color: #64748b; font-size: 13px; }
    .service-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
    .service-card { padding: 14px; min-height: 150px; }
    .service-top { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
    .logo { width: 36px; height: 36px; border-radius: 8px; background: #172033; display: grid; place-items: center; overflow: hidden; flex: 0 0 auto; }
    .logo img { max-width: 22px; max-height: 22px; object-fit: contain; }
    .service-name { min-width: 0; }
    .service-name strong { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .service-name span, .evidence { color: #64748b; font-size: 12px; }
    .badge { display: inline-flex; align-items: center; height: 22px; padding: 0 8px; border-radius: 999px; background: #edf2ff; color: #334155; font-size: 12px; margin-bottom: 10px; }
    .evidence { margin-top: 8px; }
    .empty { background: #fff; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 24px; }
    @media (max-width: 720px) { .stackmap-header { display: block; } .summary { grid-template-columns: 1fr; } }
  `;
}

function htmlBody(graph) {
  const services = graph.services ?? [];
  const serviceCards = services.length
    ? services.map((service) => {
      const evidence = service.evidence?.[0];
      const evidenceText = evidence ? `${evidence.type}: ${evidence.value}` : 'No evidence captured';
      return `
        <article class="service-card">
          <div class="service-top">
            <div class="logo">${service.iconUrl ? `<img src="${escapeHtml(service.iconUrl)}" alt="">` : escapeHtml(service.name.slice(0, 2).toUpperCase())}</div>
            <div class="service-name">
              <strong>${escapeHtml(service.name)}</strong>
              <span>${escapeHtml(service.confidence)} confidence</span>
            </div>
          </div>
          <span class="badge">${escapeHtml(service.category)}</span>
          <p class="evidence">${escapeHtml(evidenceText)}</p>
        </article>
      `;
    }).join('')
    : '<div class="empty">No external services were detected yet.</div>';

  return `
    <main class="stackmap-shell">
      <section class="stackmap-header">
        <div>
          <h1>Internal Stackmap</h1>
          <p>${escapeHtml(graph.project?.name ?? 'This project')} uses these detected services.</p>
        </div>
        <p>Generated ${escapeHtml(new Date(graph.generatedAt).toLocaleString())}</p>
      </section>
      <section class="summary" aria-label="Service map summary">
        <div class="metric"><strong>${services.length}</strong><span>services detected</span></div>
        <div class="metric"><strong>${graph.summary?.highConfidenceCount ?? 0}</strong><span>high confidence</span></div>
        <div class="metric"><strong>${escapeHtml(graph.project?.framework ?? 'unknown')}</strong><span>framework</span></div>
      </section>
      <section class="service-grid">
        ${serviceCards}
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
  <title>Internal Stackmap</title>
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
    <title>Internal Stackmap</title>
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
