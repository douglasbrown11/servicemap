#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const defaultInput = '.servicemap/internal-servicemap.json';
const defaultOutput = 'servicemap-desktop';

function parseArgs() {
  const args = process.argv.slice(2);
  const options = { root: process.cwd(), input: defaultInput, output: defaultOutput };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--root') options.root = args[index + 1] ?? options.root;
    if (args[index] === '--input') options.input = args[index + 1] ?? options.input;
    if (args[index] === '--output') options.output = args[index + 1] ?? options.output;
  }
  options.root = resolve(options.root);
  options.input = resolve(options.root, options.input);
  options.output = resolve(options.root, options.output);
  return options;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function writeProjectFile(root, path, contents) {
  const filePath = join(root, path);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, contents);
}

function packageJson(graph) {
  const appName = `${graph.project?.name ?? 'internal'}-servicemap`.replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
  return `${JSON.stringify({
    name: appName,
    private: true,
    version: '0.1.0',
    type: 'module',
    scripts: {
      dev: 'vite',
      build: 'vite build',
      preview: 'vite preview',
      tauri: 'tauri',
    },
    dependencies: {
      '@vitejs/plugin-react': '^5.0.0',
      vite: '^7.0.0',
      typescript: '^5.0.0',
      react: '^19.0.0',
      'react-dom': '^19.0.0',
      '@tauri-apps/api': '^2.0.0',
    },
    devDependencies: {
      '@tauri-apps/cli': '^2.0.0',
    },
  }, null, 2)}\n`;
}

function viteConfig() {
  return `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
  },
});
`;
}

function indexHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Internal Servicemap</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`;
}

function mainJsx() {
  return `import React from 'react';
import { createRoot } from 'react-dom/client';
import graph from './servicemap-data.json';
import './styles.css';

function strongestEvidence(service) {
  const evidence = service.evidence?.[0];
  return evidence ? \`\${evidence.type}: \${evidence.value}\` : 'No evidence captured';
}

function categoryLabel(value) {
  return String(value ?? 'service').replace(/-/g, ' ');
}

function categoryClass(value) {
  return String(value ?? 'service').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
}

function layoutServices(services) {
  const left = [];
  const right = [];
  services.forEach((service, index) => {
    if (index % 2 === 0) left.push(service);
    else right.push(service);
  });

  const place = (items, side) => items.map((service, index) => {
    const count = Math.max(items.length, 1);
    const y = 15 + ((index + 0.5) * 70) / count;
    const x = side === 'left' ? 10 + (index % 2) * 13 : 71 + (index % 2) * 10;
    return { service, x, y, side };
  });

  return [...place(left, 'left'), ...place(right, 'right')];
}

function App() {
  const services = graph.services ?? [];
  const highConfidence = services.filter((service) => service.confidence === 'high').length;
  const nodes = layoutServices(services);

  return (
    <main className="appShell">
      <header className="topbar">
        <div className="brand">
          <div className="brandIcon" aria-hidden="true">⌘</div>
          <div>
            <h1>service-map</h1>
            <p>{graph.project?.name ?? 'Internal'} command center</p>
          </div>
        </div>
        <div className="toolbar" aria-label="Service map actions">
          <span className="identity">{graph.project?.framework ?? 'static'}</span>
          <button type="button">2D</button>
          <button type="button" className="ghost">3D</button>
          <button type="button" className="ghost">Import</button>
          <button type="button" className="primary">+ Add service</button>
        </div>
      </header>

      <section className="mapCanvas" aria-label="Detected service map">
        <div className="sectionLabel">
          <span>{(graph.project?.name ?? 'project').toUpperCase()} INFRASTRUCTURE</span>
          <small>{services.length} services · {highConfidence} high confidence</small>
        </div>

        <svg className="edges" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {nodes.map((node) => {
            const startX = node.side === 'left' ? node.x + 13 : node.x;
            const endX = 50;
            const midX = node.side === 'left' ? 38 : 62;
            return (
              <path
                key={node.service.id}
                d={\`M \${startX} \${node.y} H \${midX} V 50 H \${endX}\`}
                className={node.service.confidence === 'high' ? 'edge edgeHigh' : 'edge'}
              />
            );
          })}
        </svg>

        <div className="centerNode" aria-label="Project">
          <div className="coreIcon" aria-hidden="true">⌬</div>
        </div>

        {nodes.map(({ service, x, y }) => (
          <article
            className={\`serviceNode \${service.confidence === 'high' ? 'isHigh' : ''}\`}
            key={service.id}
            style={{ left: \`\${x}%\`, top: \`\${y}%\` }}
            title={strongestEvidence(service)}
          >
            <div className={\`logo logo-\${categoryClass(service.category)}\`} aria-hidden="true">
              {service.iconUrl ? <img src={service.iconUrl} alt="" /> : service.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="nameBlock">
              <strong>{service.name}</strong>
              <span>{categoryLabel(service.category)}</span>
            </div>
            <span className={\`statusDot \${service.confidence === 'high' ? 'active' : 'pending'}\`} />
          </article>
        ))}

        {!services.length && (
          <div className="empty">
            <strong>No external services detected</strong>
            <span>Run the scanner again after adding integrations.</span>
          </div>
        )}

        <div className="legend">
          <span><b className="blue" /> Cloud</span>
          <span><b className="green" /> Active path</span>
          <span><b className="yellow" /> Lower confidence</span>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
`;
}

function stylesCss() {
  return `:root {
  color: #eef7f2;
  background: #020806;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  background: #020806;
}

button {
  border: 0;
  border-radius: 8px;
  min-height: 42px;
  padding: 0 16px;
  color: #e8f5ee;
  background: #101a16;
  font: inherit;
  font-weight: 700;
}

.appShell {
  min-height: 100vh;
  background: #020806;
}

.topbar {
  height: 86px;
  padding: 18px 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  background: #202622;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.brand {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.brandIcon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: #1f704f;
  border: 1px solid #38c987;
  box-shadow: 0 0 24px rgba(56, 201, 135, 0.25);
  color: #c9f8df;
  font-size: 25px;
}

h1 {
  margin: 0 0 3px;
  font-size: 22px;
  line-height: 1;
  letter-spacing: 0;
}

p {
  margin: 0;
}

.brand p,
.nameBlock span,
.sectionLabel,
.legend {
  color: rgba(238, 247, 242, 0.54);
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.identity {
  color: #93c8ac;
  font-size: 13px;
  font-weight: 800;
  margin-right: 10px;
  white-space: nowrap;
}

.toolbar .primary {
  background: #247b58;
  box-shadow: inset 0 0 0 1px rgba(104, 255, 179, 0.25);
}

.toolbar .ghost {
  color: rgba(238, 247, 242, 0.72);
}

.mapCanvas {
  position: relative;
  min-height: calc(100vh - 86px);
  overflow: hidden;
  background:
    radial-gradient(circle at center, rgba(37, 128, 88, 0.16), transparent 34%),
    radial-gradient(circle at 1px 1px, rgba(115, 255, 183, 0.16) 1px, transparent 1px),
    #020806;
  background-size: auto, 28px 28px, auto;
}

.sectionLabel {
  position: absolute;
  top: 28px;
  left: 32px;
  right: 32px;
  display: flex;
  justify-content: space-between;
  gap: 18px;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.sectionLabel small {
  letter-spacing: 0.08em;
}

.edges {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.edge {
  fill: none;
  stroke: rgba(121, 158, 140, 0.34);
  stroke-width: 0.12;
}

.edgeHigh {
  stroke: rgba(115, 255, 183, 0.5);
}

.centerNode {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 112px;
  height: 112px;
  transform: translate(-50%, -50%);
  display: grid;
  place-items: center;
  border-radius: 26px;
  background: rgba(15, 31, 24, 0.88);
  border: 1px solid rgba(114, 255, 183, 0.28);
  box-shadow: 0 0 0 9px rgba(56, 201, 135, 0.08), 0 0 45px rgba(56, 201, 135, 0.18);
}

.coreIcon {
  width: 78px;
  height: 78px;
  display: grid;
  place-items: center;
  border-radius: 20px;
  background: #f7fbf7;
  color: #101513;
  font-size: 38px;
}

.serviceNode {
  position: absolute;
  width: clamp(190px, 16vw, 260px);
  min-height: 70px;
  transform: translateY(-50%);
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) 12px;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(22, 33, 27, 0.98), rgba(12, 20, 16, 0.96));
  border: 1px solid rgba(158, 202, 176, 0.24);
  box-shadow: 0 12px 26px rgba(0, 0, 0, 0.34), inset 0 0 0 1px rgba(255, 255, 255, 0.03);
}

.serviceNode.isHigh {
  box-shadow: 0 12px 26px rgba(0, 0, 0, 0.34), 0 0 24px rgba(56, 201, 135, 0.08);
}

.logo {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: #24302b;
  color: #fff;
  display: grid;
  place-items: center;
  overflow: hidden;
  flex: 0 0 auto;
  font-size: 12px;
  font-weight: 800;
}

.logo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 7px;
  filter: brightness(0) invert(1);
}

.logo-cloud {
  background: #2d72f6;
}

.logo-developer-tools {
  background: #202833;
}

.logo-billing {
  background: #635bff;
}

.logo-email,
.logo-collaboration {
  background: #f45d48;
}

.logo-ai {
  background: #1f7a55;
}

.logo-monitoring {
  background: #6b4bd8;
}

.logo-auth {
  background: #28a37a;
}

.logo-database {
  background: #f57c00;
}

.nameBlock {
  min-width: 0;
}

.nameBlock strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 15px;
}

.nameBlock span {
  display: block;
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  text-transform: capitalize;
}

.statusDot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #eac94f;
  box-shadow: 0 0 12px rgba(234, 201, 79, 0.9);
}

.statusDot.active {
  background: #69f6b1;
  box-shadow: 0 0 12px rgba(105, 246, 177, 0.9);
}

.empty {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, 90px);
  display: grid;
  gap: 6px;
  text-align: center;
  color: rgba(238, 247, 242, 0.74);
}

.legend {
  position: absolute;
  left: 50%;
  bottom: 28px;
  transform: translateX(-50%);
  display: flex;
  gap: 20px;
  padding: 8px 16px;
  border-radius: 999px;
  background: rgba(8, 15, 12, 0.82);
  border: 1px solid rgba(158, 202, 176, 0.18);
  font-size: 12px;
  font-weight: 800;
}

.legend span {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  white-space: nowrap;
}

.legend b {
  width: 8px;
  height: 8px;
  border-radius: 999px;
}

.legend .blue {
  background: #3d8cff;
}

.legend .green {
  background: #69f6b1;
}

.legend .yellow {
  background: #eac94f;
}

@media (max-width: 880px) {
  .topbar {
    height: auto;
    align-items: flex-start;
    flex-direction: column;
  }

  .toolbar {
    flex-wrap: wrap;
  }

  .mapCanvas {
    min-height: 980px;
  }

  .serviceNode {
    width: 210px;
  }

  .sectionLabel {
    align-items: flex-start;
    flex-direction: column;
  }
}
`;
}

function tauriConfig(graph) {
  return `${JSON.stringify({
    productName: 'Internal Servicemap',
    version: '0.1.0',
    identifier: `com.internal.${(graph.project?.name ?? 'servicemap').replace(/[^a-z0-9]+/gi, '').toLowerCase() || 'servicemap'}`,
    build: {
      beforeDevCommand: 'npm run dev',
      beforeBuildCommand: 'npm run build',
      devUrl: 'http://localhost:5173',
      frontendDist: '../dist',
    },
    app: {
      windows: [
        {
          title: 'Internal Servicemap',
          width: 1180,
          height: 820,
          minWidth: 860,
          minHeight: 620,
        },
      ],
    },
    bundle: {
      active: true,
      targets: 'all',
    },
  }, null, 2)}\n`;
}

function cargoToml() {
  return `[package]
name = "internal-servicemap"
version = "0.1.0"
description = "Internal Servicemap"
authors = ["Internal"]
edition = "2021"

[lib]
name = "internal_service_map_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
`;
}

function buildRs() {
  return `fn main() {
    tauri_build::build()
}
`;
}

function rustLib() {
  return `#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
`;
}

function rustMain() {
  return `fn main() {
    internal_service_map_lib::run()
}
`;
}

async function main() {
  const options = parseArgs();
  const graph = await readJson(options.input);

  await mkdir(options.output, { recursive: true });
  await writeProjectFile(options.output, 'package.json', packageJson(graph));
  await writeProjectFile(options.output, 'index.html', indexHtml());
  await writeProjectFile(options.output, 'vite.config.js', viteConfig());
  await writeProjectFile(options.output, 'src/main.jsx', mainJsx());
  await writeProjectFile(options.output, 'src/styles.css', stylesCss());
  await writeProjectFile(options.output, 'src/servicemap-data.json', `${JSON.stringify(graph, null, 2)}\n`);
  await writeProjectFile(options.output, 'src-tauri/tauri.conf.json', tauriConfig(graph));
  await writeProjectFile(options.output, 'src-tauri/Cargo.toml', cargoToml());
  await writeProjectFile(options.output, 'src-tauri/build.rs', buildRs());
  await writeProjectFile(options.output, 'src-tauri/src/lib.rs', rustLib());
  await writeProjectFile(options.output, 'src-tauri/src/main.rs', rustMain());

  console.log(`Wrote desktop servicemap app to ${options.output}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
