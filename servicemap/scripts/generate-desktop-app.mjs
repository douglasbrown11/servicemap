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
import graph from '.servicemap-data.json';
import './styles.css';

function strongestEvidence(service) {
  const evidence = service.evidence?.[0];
  return evidence ? \`\${evidence.type}: \${evidence.value}\` : 'No evidence captured';
}

function App() {
  const services = graph.services ?? [];
  const highConfidence = services.filter((service) => service.confidence === 'high').length;

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <h1>Internal Servicemap</h1>
          <p>{graph.project?.name ?? 'This project'} uses these detected services.</p>
        </div>
        <span className="stamp">{new Date(graph.generatedAt).toLocaleString()}</span>
      </header>

      <section className="metrics" aria-label="Service map summary">
        <div><strong>{services.length}</strong><span>services</span></div>
        <div><strong>{highConfidence}</strong><span>high confidence</span></div>
        <div><strong>{graph.project?.framework ?? 'unknown'}</strong><span>source</span></div>
      </section>

      <section className="grid">
        {services.length ? services.map((service) => (
          <article className="card" key={service.id}>
            <div className="cardTop">
              <div className="logo" aria-hidden="true">
                {service.iconUrl ? <img src={service.iconUrl} alt="" /> : service.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="nameBlock">
                <strong>{service.name}</strong>
                <span>{service.confidence} confidence</span>
              </div>
            </div>
            <span className="category">{service.category}</span>
            <p>{strongestEvidence(service)}</p>
          </article>
        )) : <div className="empty">No external services were detected yet.</div>}
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
`;
}

function stylesCss() {
  return `:root {
  color: #172033;
  background: #f7f8fb;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  background: #f7f8fb;
}

.shell {
  max-width: 1180px;
  margin: 0 auto;
  padding: 40px 24px 56px;
}

.topbar {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 24px;
  margin-bottom: 24px;
}

h1 {
  margin: 0 0 8px;
  font-size: 44px;
  line-height: 1;
  letter-spacing: 0;
}

p {
  margin: 0;
  color: #5f6b7c;
  line-height: 1.55;
}

.stamp {
  color: #64748b;
  font-size: 13px;
  white-space: nowrap;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 22px 0;
}

.metrics div,
.card {
  background: #fff;
  border: 1px solid #e3e8ef;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.metrics div {
  padding: 16px;
}

.metrics strong {
  display: block;
  font-size: 26px;
}

.metrics span {
  color: #64748b;
  font-size: 13px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}

.card {
  min-height: 150px;
  padding: 14px;
}

.cardTop {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.logo {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: #172033;
  color: #fff;
  display: grid;
  place-items: center;
  overflow: hidden;
  flex: 0 0 auto;
  font-size: 12px;
  font-weight: 700;
}

.logo img {
  max-width: 22px;
  max-height: 22px;
  object-fit: contain;
}

.nameBlock {
  min-width: 0;
}

.nameBlock strong {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nameBlock span,
.card p {
  color: #64748b;
  font-size: 12px;
}

.category {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: #edf2ff;
  color: #334155;
  font-size: 12px;
  margin-bottom: 10px;
}

.empty {
  background: #fff;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  padding: 24px;
}

@media (max-width: 720px) {
  .topbar {
    display: block;
  }

  h1 {
    font-size: 34px;
  }

  .metrics {
    grid-template-columns: 1fr;
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
  await writeProjectFile(options.output, 'srcservicemap-data.json', `${JSON.stringify(graph, null, 2)}\n`);
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
