import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fetchLogoResource, publicURL } from './logo-network.mjs';

const database = JSON.parse(await readFile(new URL('../assets/service-logo-database.json', import.meta.url), 'utf8'));
const bundle = JSON.parse(await readFile(new URL('../assets/service-logo-assets.json', import.meta.url), 'utf8'));
const normalize = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const lookup = new Map();
for (const entry of database) for (const value of [entry.key, entry.name, ...(entry.aliases ?? [])]) {
  if (!lookup.has(normalize(value))) lookup.set(normalize(value), entry);
}
const hash = value => createHash('sha256').update(value).digest('hex');
export function findLogoEntry(service) {
  const named = lookup.get(normalize(service.key)) ?? lookup.get(normalize(service.name));
  if (named) return named;
  let host;
  try { host = new URL(service.websiteUrl).hostname; } catch { return; }
  return database.find(entry => (entry.domains ?? []).some(domain => host === domain || host.endsWith(`.${domain}`)));
}

export function validateImage(body) {
  if (!Buffer.isBuffer(body) || body.length < 8 || body.length > 1024 * 1024) return null;
  if (body.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && body.length >= 24) {
    const width = body.readUInt32BE(16), height = body.readUInt32BE(20);
    if (width && height && width <= 4096 && height <= 4096) return { body, extension: 'png' };
    return null;
  }
  if (body[0] === 255 && body[1] === 216 && body[2] === 255 && body.at(-2) === 255 && body.at(-1) === 217) return { body, extension: 'jpg' };
  if (body.subarray(0, 4).toString() === 'RIFF' && body.subarray(8, 12).toString() === 'WEBP') return { body, extension: 'webp' };
  if (body.readUInt32LE(0) === 0x10000 && body.readUInt16LE(4) > 0 && body.length >= 22) return { body, extension: 'ico' };
  const svg = body.toString('utf8').replace(/<\?xml[^?]*\?>/g, '').replace(/<!--[\s\S]*?-->/g, '').trim();
  if (!/^<svg\s/i.test(svg) || !/<\/svg>$/i.test(svg) || /<!|<\?|&(?!(?:amp|lt|gt|quot|apos|#[0-9]+|#x[0-9a-fA-F]+);)/.test(svg)) return null;
  const elements = new Set(['svg','path','g','circle','rect','ellipse','polygon','polyline','line','title','desc','defs','lineargradient','radialgradient','stop','clippath','mask','use']);
  const attributes = /^(?:xmlns|xmlns:xlink|viewBox|width|height|x|y|x1|x2|y1|y2|cx|cy|r|rx|ry|d|points|fill|fill-rule|fill-opacity|stroke|stroke-width|stroke-linecap|stroke-linejoin|stroke-miterlimit|stroke-dasharray|stroke-dashoffset|stroke-opacity|opacity|transform|id|class|role|aria-hidden|aria-labelledby|focusable|clip-rule|clip-path|mask|offset|stop-color|stop-opacity|gradientUnits|gradientTransform|spreadMethod|href|xlink:href|preserveAspectRatio|version)$/i;
  for (const tag of svg.matchAll(/<([^>]+)>/g)) {
    const match = /^\/?([\w:-]+)([\s\S]*?)\/?$/.exec(tag[1]);
    if (!match || !elements.has(match[1].toLowerCase())) return null;
    let rest = match[2].trim();
    while (rest) {
      const attribute = /^([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2\s*/.exec(rest);
      if (!attribute || !attributes.test(attribute[1])) return null;
      const [, name, , value] = attribute;
      if (/[<>&\\]|javascript:|data:|@import/i.test(value) ||
          (/href$/i.test(name) && !/^#[\w.-]+$/.test(value)) ||
          (/url\s*\(/i.test(value) && !/^url\(#[\w.-]+\)$/.test(value))) return null;
      rest = rest.slice(attribute[0].length);
    }
  }
  // WebGL needs intrinsic dimensions; viewBox-only SVGs display in HTML but upload as empty textures.
  const sized = svg.replace(/<svg\s([^>]*)>/i, (tag, attrs) => {
    if (!/\bviewBox\s*=/i.test(attrs)) return tag;
    const withoutSize = attrs.replace(/\b(?:width|height)\s*=\s*(["'])[^"']*\1\s*/gi, '');
    return `<svg width="256" height="256" ${withoutSize}>`;
  });
  return { body: Buffer.from(sized), extension: 'svg' };
}

export function websiteIcons(html, website) {
  const candidates = [];
  for (const tag of html.matchAll(/<link\b[^>]*>/gi)) {
    const attributes = Object.fromEntries([...tag[0].matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)]
      .map(match => [match[1].toLowerCase(), match[2] ?? match[3] ?? match[4]]));
    if (!/(?:^|\s)(?:icon|apple-touch-icon)(?:\s|$)/i.test(attributes.rel ?? '') || !attributes.href) continue;
    try {
      const url = publicURL(new URL(attributes.href.replace(/&amp;/g, '&'), website).href);
      candidates.push({ url: url.href, priority: /apple-touch-icon/i.test(attributes.rel) ? 0 : 1 });
    } catch { /* Ignore unsafe or malformed website icon declarations. */ }
  }
  return [...new Set(candidates.sort((a, b) => a.priority - b.priority).map(item => item.url))].slice(0, 3);
}

function websiteFor(service, entry) {
  // Never infer company domains from names or logo-source hosts (often third-party brand galleries).
  const values = [service.websiteUrl, ...(service.domains ?? []).map(domain => `https://${domain}`), entry?.websiteUrl];
  for (const value of values.filter(Boolean)) {
    try { return publicURL(value).origin; } catch { /* Try the next explicit source. */ }
  }
  return null;
}

async function readCache(file) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch { return null; }
}
async function writeChanged(file, body) {
  try { if ((await readFile(file)).equals(Buffer.from(body))) return; } catch { /* New asset. */ }
  await mkdir(dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  await writeFile(temp, body);
  await rename(temp, file);
}

// Mutate only the graph being rendered; canonical service metadata and custom overrides stay intact.
export async function prepareServiceLogos(graph, outputRoot, { cacheRoot = outputRoot, check = false, fetchResource = fetchLogoResource } = {}) {
  const unresolved = [], missingAssets = [];
  const services = graph.services ?? [];
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(4, services.length) }, async () => {
    while (cursor < services.length) {
      const service = services[cursor++];
      const entry = findLogoEntry(service);
      const catalogUrl = entry?.simpleIconSlug && service.iconUrl?.match(/^https:\/\/cdn\.jsdelivr\.net\/npm\/simple-icons@[^/]+\/icons\/([^/]+)\.svg$/)?.[1] === entry.simpleIconSlug;
      const custom = service.iconUrl && service.iconUrl !== entry?.iconUrl && !catalogUrl;
      if (custom && !/^[a-z][a-z0-9+.-]*:|^\/\//i.test(service.iconUrl)) continue;
      const website = websiteFor(service, entry);
      const key = hash(JSON.stringify([service.key ?? service.name, service.iconUrl ?? null, website, bundle.version]));
      const cacheFile = join(cacheRoot, '.servicemap', 'logo-cache', `${key}.json`);
      let image = null;
      if (custom && /^data:image\//i.test(service.iconUrl)) {
        try {
          const [, encoding, payload] = /^data:image\/[\w.+-]+(;base64)?,([\s\S]*)$/i.exec(service.iconUrl) ?? [];
          if (payload) image = validateImage(encoding ? Buffer.from(payload, 'base64') : Buffer.from(decodeURIComponent(payload)));
        } catch { /* Invalid inline images follow the normal fallback path. */ }
      }
      if (!image && !custom && entry?.simpleIconSlug && bundle.icons[entry.simpleIconSlug]) {
        image = validateImage(Buffer.from(bundle.icons[entry.simpleIconSlug]));
      }
      const cached = image ? null : await readCache(cacheFile);
      if (!image && cached?.data) image = validateImage(Buffer.from(cached.data, 'base64'));
      if (!image && !check && !(cached?.missingUntil > Date.now())) {
        const deadline = Date.now() + 8000;
        const get = url => fetchResource(publicURL(url).href, { timeout: Math.max(1, Math.min(3000, deadline - Date.now())) });
        const tryImage = async url => {
          if (Date.now() >= deadline) return null;
          try {
            const response = await get(url);
            if (!/^image\//i.test(response.type)) return null;
            return validateImage(response.body);
          } catch { return null; }
        };
        if (service.iconUrl) image = await tryImage(service.iconUrl);
        if (!image && custom && entry?.simpleIconSlug && bundle.icons[entry.simpleIconSlug]) {
          image = validateImage(Buffer.from(bundle.icons[entry.simpleIconSlug]));
        }
        if (!image && website && Date.now() < deadline) {
          let candidates = [];
          try {
            const page = await get(website);
            if (/^(?:text\/html|application\/xhtml\+xml)/i.test(page.type)) candidates = websiteIcons(page.body.toString('utf8'), page.url ?? website);
          } catch { /* The conventional favicon may still be available. */ }
          candidates.push(`${website}/favicon.ico`);
          for (const url of [...new Set(candidates)]) {
            image = await tryImage(url);
            if (image) break;
          }
        }
        if (service.iconUrl || website) await writeChanged(cacheFile, JSON.stringify(image
          ? { data: image.body.toString('base64') } : { missingUntil: Date.now() + 24 * 60 * 60 * 1000 }) + '\n');
      }
      if (!image) {
        service.iconUrl = null;
        unresolved.push(service.name);
        continue;
      }
      const filename = `${hash(image.body)}.${image.extension}`;
      const file = join(outputRoot, 'public', 'internalservicemap-assets', 'services', filename);
      service.iconUrl = `/internalservicemap-assets/services/${filename}`;
      if (check) {
        try { if (!(await readFile(file)).equals(image.body)) missingAssets.push(file); }
        catch { missingAssets.push(file); }
      } else await writeChanged(file, image.body);
    }
  }));
  return { unresolved: unresolved.sort(), missingAssets };
}

export function reportMissingLogos(result) {
  if (result.unresolved.length) console.log(`Logos unavailable (using initials): ${result.unresolved.join(', ')}`);
}
