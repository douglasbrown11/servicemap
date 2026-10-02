#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { interactiveTsxPage, prepareProjectLogo } from './generate-page.mjs';

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
      'react-force-graph-3d': '^1.29.1',
      three: '^0.185.1',
      'three-spritetext': '^1.10.0',
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
  await prepareProjectLogo(graph, options.output);
  await writeProjectFile(options.output, 'package.json', packageJson(graph));
  await writeProjectFile(options.output, 'index.html', indexHtml());
  await writeProjectFile(options.output, 'vite.config.js', viteConfig());
  await writeProjectFile(options.output, 'src/main.jsx', `import React from 'react';
import { createRoot } from 'react-dom/client';
import ServiceMap from './ServiceMap';
createRoot(document.getElementById('root')).render(<ServiceMap />);
`);
  await writeProjectFile(options.output, 'src/ServiceMap.tsx', interactiveTsxPage(graph, { desktop: true }));
  await writeProjectFile(options.output, '.gitignore', 'node_modules/\ndist/\nsrc-tauri/target/\n');
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
