#!/usr/bin/env node
// Maintainer-only: regenerate bundled catalog from the pinned Simple Icons dependency.
import * as icons from 'simple-icons';
import { readFile, writeFile } from 'node:fs/promises';
const asset = name => new URL(`../assets/${name}`, import.meta.url);
const previous = JSON.parse(await readFile(asset('service-logo-database.json'), 'utf8'));
const overrides = JSON.parse(await readFile(asset('service-logo-overrides.json'), 'utf8'));
const { version } = JSON.parse(await readFile(new URL('../node_modules/simple-icons/package.json', import.meta.url), 'utf8'));
const entries = new Map(previous.map(entry => [entry.key, entry]));
const bundled = {};
for (const icon of Object.values(icons).sort((a, b) => a.slug.localeCompare(b.slug))) {
  const old = entries.get(icon.slug);
  entries.set(icon.slug, {
    ...old, key: icon.slug, name: old?.name ?? icon.title,
    aliases: [...new Set([...(old?.aliases ?? []), ...(icon.aliases?.names ?? [])])],
    category: old?.category ?? 'service', sourceUrl: icon.source,
    sourceHost: new URL(icon.source).hostname, simpleIconSlug: icon.slug,
    simpleIconHex: icon.hex, iconUrl: `https://cdn.jsdelivr.net/npm/simple-icons@${version}/icons/${icon.slug}.svg`,
    // Explicit detection rules prevent generic brand names from becoming false positives.
    packages: old?.packages ?? (old ? [old.key, old.name.toLowerCase().replace(/\s+/g, ''), ...old.aliases] : []),
    domains: old?.domains ?? [], envPrefixes: old?.envPrefixes ?? (old ? [old.key.replace(/[^a-z0-9]/gi, '_').toUpperCase() + '_'] : []),
  });
  bundled[icon.slug] = icon.svg.replace('<svg ', '<svg fill="#ffffff" ');
}
for (const override of overrides) {
  const old = entries.get(override.key) ?? {};
  entries.set(override.key, { aliases: [], category: 'service', ...old, ...override });
}
const catalog = [...entries.values()].sort((a, b) => a.key.localeCompare(b.key))
  .map(entry => Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a.localeCompare(b))));
await writeFile(asset('service-logo-database.json'), JSON.stringify(catalog, null, 2) + '\n');
await writeFile(asset('service-logo-assets.json'), JSON.stringify({ source: 'simple-icons', version, license: 'CC0-1.0', icons: bundled }) + '\n');
await writeFile(asset('simple-icons-LICENSE.md'), await readFile(new URL('../node_modules/simple-icons/LICENSE.md', import.meta.url)));
console.log(`Bundled ${Object.keys(bundled).length} icons and ${entries.size} service records from Simple Icons ${version}.`);
