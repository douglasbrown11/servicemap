#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const skillRoot = resolve(scriptDir, '..');
const logoDatabasePath = resolve(skillRoot, 'assets/service-logo-database.json');
const defaultOutput = '.servicemap/internal-servicemap.json';

const ignoredDirs = new Set([
  '.servicemap',
  '.git',
  '.next',
  '.nuxt',
  '.svelte-kit',
  'build',
  'coverage',
  'dist',
  'graphify-out',
  'node_modules',
  'servicemap-desktop',
  'target',
  'vendor',
]);

const sourceExtensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.astro', '.vue', '.svelte', '.py', '.rb', '.go', '.rs', '.php', '.java', '.swift']);
const configFileNames = new Set([
  'Dockerfile',
  'docker-compose.yml',
  'firebase.json',
  'netlify.toml',
  'package.json',
  'render.yaml',
  'supabase.config.toml',
  'tauri.conf.json',
  'vercel.json',
  'wrangler.toml',
]);

const manualRules = [
  service('Stripe', 'stripe', 'billing', ['stripe'], ['STRIPE_'], ['stripe.com']),
  service('Supabase', 'supabase', 'database', ['@supabase/supabase-js', 'supabase'], ['SUPABASE_'], ['supabase.com']),
  service('Firebase', 'firebase', 'cloud', ['firebase', 'firebase-admin'], ['FIREBASE_', 'GOOGLE_APPLICATION_CREDENTIALS'], ['firebase.google.com']),
  service('Sentry', 'sentry', 'monitoring', ['@sentry/react', '@sentry/nextjs', '@sentry/node', 'sentry'], ['SENTRY_'], ['sentry.io']),
  service('PostHog', 'posthog', 'analytics', ['posthog-js', 'posthog-node', 'posthog'], ['POSTHOG_'], ['posthog.com']),
  service('OpenAI', 'openai', 'ai', ['openai'], ['OPENAI_'], ['openai.com', 'api.openai.com']),
  service('Anthropic', 'anthropic', 'ai', ['@anthropic-ai/sdk', 'anthropic'], ['ANTHROPIC_'], ['anthropic.com']),
  service('Vercel', 'vercel', 'hosting', ['@vercel/analytics', '@vercel/speed-insights'], ['VERCEL_'], ['vercel.com']),
  service('Cloudflare', 'cloudflare', 'cloud', ['wrangler', '@cloudflare/workers-types'], ['CLOUDFLARE_'], ['cloudflare.com']),
  service('Resend', 'resend', 'email', ['resend'], ['RESEND_'], ['resend.com']),
  service('Mailgun', 'mailgun', 'email', ['mailgun.js'], ['MAILGUN_'], ['mailgun.com']),
  service('SendGrid', 'sendgrid', 'email', ['@sendgrid/mail', '@sendgrid/client'], ['SENDGRID_'], ['sendgrid.com']),
  service('Clerk', 'clerk', 'auth', ['@clerk/nextjs', '@clerk/clerk-react'], ['CLERK_', 'NEXT_PUBLIC_CLERK_'], ['clerk.com']),
  service('Auth0', 'auth0', 'auth', ['@auth0/auth0-react', '@auth0/nextjs-auth0'], ['AUTH0_'], ['auth0.com']),
  service('GitHub', 'github', 'developer-tools', ['@octokit/rest', '@actions/core'], ['GITHUB_'], ['github.com']),
  service('Slack', 'slack', 'collaboration', ['@slack/web-api', '@slack/bolt'], ['SLACK_'], ['slack.com']),
  service('Discord', 'discord', 'collaboration', ['discord.js'], ['DISCORD_'], ['discord.com']),
  service('HubSpot', 'hubspot', 'crm', ['@hubspot/api-client'], ['HUBSPOT_'], ['hubspot.com']),
  service('Zendesk', 'zendesk', 'support', ['node-zendesk', 'zendesk'], ['ZENDESK_'], ['zendesk.com']),
  service('Intercom', 'intercom', 'support', ['@intercom/messenger-js-sdk'], ['INTERCOM_'], ['intercom.com']),
];

function service(name, key, category, packages, envPrefixes, domains) {
  return { name, key, category, packages, envPrefixes, domains };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = { root: process.cwd(), output: defaultOutput, allowedEmails: [] };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--root') options.root = args[index + 1] ?? options.root;
    if (args[index] === '--output') options.output = args[index + 1] ?? options.output;
    if (args[index] === '--allow-email') options.allowedEmails.push(args[index + 1] ?? '');
    if (args[index] === '--allow-emails') options.allowedEmails.push(...(args[index + 1] ?? '').split(','));
  }
  options.root = resolve(options.root);
  options.output = resolve(options.root, options.output);
  options.allowedEmails = normalizeEmails(options.allowedEmails);
  return options;
}

function normalizeEmails(values) {
  return [...new Set(values
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .filter((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)))];
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return null;
  }
}

async function walk(root, files = []) {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name)) continue;
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      await walk(path, files);
    } else if (entry.isFile()) {
      files.push(path);
    }
  }
  return files;
}

function packageNameFromImport(value) {
  if (!value || value.startsWith('.') || value.startsWith('/')) return null;
  if (value.startsWith('@')) return value.split('/').slice(0, 2).join('/');
  return value.split('/')[0];
}

function envNamesFromText(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.match(/^([A-Z0-9_]+)\s*=/)?.[1])
    .filter(Boolean);
}

function urlHostsFromText(text) {
  return [...text.matchAll(/https?:\/\/[^\s"'`)<\]}]+/g)]
    .map((match) => {
      try {
        return new URL(match[0]).hostname.replace(/^www\./, '');
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function importsFromText(text) {
  const imports = [
    ...text.matchAll(/from\s+['"]([^'"]+)['"]/g),
    ...text.matchAll(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g),
    ...text.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g),
  ];
  return imports.map((match) => packageNameFromImport(match[1])).filter(Boolean);
}

function detectFramework(root, packageJson, files) {
  const dependencies = allDependencies(packageJson);
  if (existsSync(join(root, 'next.config.js')) || existsSync(join(root, 'next.config.mjs')) || dependencies.has('next')) {
    return existsSync(join(root, 'app')) || existsSync(join(root, 'src/app')) ? 'next-app-router' : 'next-pages-router';
  }
  if (existsSync(join(root, 'astro.config.mjs')) || dependencies.has('astro')) return 'astro';
  if (dependencies.has('@remix-run/react') || files.some((file) => file.includes('/app/routes/'))) return 'remix';
  if (dependencies.has('vite') || existsSync(join(root, 'vite.config.ts')) || existsSync(join(root, 'vite.config.js'))) return 'vite';
  return 'static';
}

function allDependencies(packageJson) {
  return new Set(Object.keys({
    ...(packageJson?.dependencies ?? {}),
    ...(packageJson?.devDependencies ?? {}),
    ...(packageJson?.peerDependencies ?? {}),
    ...(packageJson?.optionalDependencies ?? {}),
  }));
}

function addEvidence(map, key, service, evidence) {
  const existing = map.get(key) ?? {
    id: key,
    name: service.name,
    key,
    category: service.category,
    evidence: [],
    confidence: 'medium',
    iconUrl: service.iconUrl,
  };
  if (!existing.evidence.some((item) => item.type === evidence.type && item.value === evidence.value)) {
    existing.evidence.push(evidence);
  }
  if (evidence.confidence === 'high') existing.confidence = 'high';
  map.set(key, existing);
}

function buildGeneratedRules(database) {
  return database.map((entry) => ({
    name: entry.name,
    key: entry.key,
    category: entry.category,
    iconUrl: entry.iconUrl,
    packages: [entry.key, entry.name.toLowerCase().replace(/\s+/g, ''), ...entry.aliases.map((alias) => alias.toLowerCase())].filter(Boolean),
    envPrefixes: [entry.key.replace(/[^a-z0-9]/gi, '_').toUpperCase()],
    domains: [],
  }));
}

function normalizeLookup(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function buildDatabaseLookup(database) {
  const lookup = new Map();
  for (const entry of database) {
    const values = [entry.key, entry.name, ...(entry.aliases ?? [])];
    for (const value of values) {
      const normalized = normalizeLookup(value);
      if (normalized && !lookup.has(normalized)) lookup.set(normalized, entry);
    }
  }
  return lookup;
}

function enrichDetectedServices(services, database) {
  const lookup = buildDatabaseLookup(database);
  return services.map((service) => {
    const databaseEntry = lookup.get(normalizeLookup(service.key)) ?? lookup.get(normalizeLookup(service.name));
    if (!databaseEntry) return service;
    return {
      ...service,
      key: service.key ?? databaseEntry.key,
      category: service.category ?? databaseEntry.category,
      iconUrl: service.iconUrl ?? databaseEntry.iconUrl ?? null,
    };
  });
}

function matchServices({ dependencies, imports, envNames, hosts, configFiles, database }) {
  const serviceMap = new Map();
  const databaseByKey = new Map(database.map((entry) => [entry.key, entry]));
  const enrichedManualRules = manualRules.map((rule) => ({
    ...rule,
    iconUrl: databaseByKey.get(rule.key)?.iconUrl,
  }));
  const rules = [...enrichedManualRules, ...buildGeneratedRules(database)];
  const dependencySet = new Set([...dependencies, ...imports]);

  for (const rule of rules) {
    for (const packageName of rule.packages) {
      if (!packageName) continue;
      const matchedPackage = [...dependencySet].find((dependency) => dependency === packageName || dependency.startsWith(`${packageName}/`));
      if (matchedPackage) addEvidence(serviceMap, rule.key, rule, { type: 'package', value: matchedPackage, confidence: 'high' });
    }

    for (const prefix of rule.envPrefixes) {
      const matchedEnv = envNames.find((name) => name === prefix || name.startsWith(prefix));
      if (matchedEnv) addEvidence(serviceMap, rule.key, rule, { type: 'environment-variable-name', value: matchedEnv, confidence: 'medium' });
    }

    for (const domain of rule.domains) {
      const matchedHost = hosts.find((host) => host === domain || host.endsWith(`.${domain}`));
      if (matchedHost) addEvidence(serviceMap, rule.key, rule, { type: 'external-url-host', value: matchedHost, confidence: 'medium' });
    }
  }

  if (configFiles.includes('firebase.json')) addEvidence(serviceMap, 'firebase', enrichedManualRules.find((rule) => rule.key === 'firebase'), { type: 'config-file', value: 'firebase.json', confidence: 'high' });
  if (configFiles.includes('vercel.json')) addEvidence(serviceMap, 'vercel', enrichedManualRules.find((rule) => rule.key === 'vercel'), { type: 'config-file', value: 'vercel.json', confidence: 'high' });
  if (configFiles.includes('wrangler.toml')) addEvidence(serviceMap, 'cloudflare', enrichedManualRules.find((rule) => rule.key === 'cloudflare'), { type: 'config-file', value: 'wrangler.toml', confidence: 'high' });

  return enrichDetectedServices([...serviceMap.values()], database).map((service) => ({
    ...service,
    evidence: service.evidence.slice(0, 8),
  })).sort((a, b) => a.name.localeCompare(b.name));
}

function buildEdges(projectName, services) {
  return services.map((service) => ({
    source: 'project',
    target: service.id,
    label: service.confidence === 'high' ? 'uses' : 'may use',
  }));
}

async function findProjectLogo(root, files) {
  const appIconManifests = files
    .filter((file) => file.endsWith('AppIcon.appiconset/Contents.json'))
    .sort((a, b) => scoreLogoManifest(b) - scoreLogoManifest(a));

  for (const manifestPath of appIconManifests) {
    const manifest = await readJson(manifestPath);
    const images = Array.isArray(manifest?.images) ? manifest.images : [];
    const candidates = images
      .filter((image) => image?.filename)
      .map((image) => ({
        file: join(dirname(manifestPath), image.filename),
        score: scoreAppIconImage(image),
      }))
      .filter((candidate) => existsSync(candidate.file))
      .sort((a, b) => b.score - a.score);

    if (candidates[0]) {
      return {
        path: relative(root, candidates[0].file),
        source: 'asset-catalog-app-icon',
      };
    }
  }

  const namedLogo = files.find((file) => /(^|[/\\])(app-?icon|logo|favicon)\.(png|jpg|jpeg|webp|svg|ico)$/i.test(file));
  if (namedLogo) {
    return {
      path: relative(root, namedLogo),
      source: 'named-image-file',
    };
  }

  return null;
}

function scoreLogoManifest(path) {
  let score = 0;
  if (/Assets\.xcassets[/\\]AppIcon\.appiconset/i.test(path)) score += 10;
  if (/Assets 2\.xcassets/i.test(path)) score += 20;
  return score;
}

function scoreAppIconImage(image) {
  const size = Number.parseInt(String(image.size ?? '0').split('x')[0], 10) || 0;
  let score = size;
  const filename = String(image.filename ?? '').toLowerCase();
  if (filename.includes('dark') || filename.includes('darker')) score += 100;
  if (filename.includes('tinted')) score -= 50;
  if (image.platform === 'ios') score += 25;
  return score;
}

async function main() {
  const options = parseArgs();
  const packageJsonPath = join(options.root, 'package.json');
  const packageJson = await readJson(packageJsonPath);
  const database = await readJson(logoDatabasePath);
  const files = await walk(options.root);
  const projectName = packageJson?.name ?? basename(options.root);
  const dependencies = allDependencies(packageJson);
  const imports = [];
  const envNames = [];
  const hosts = [];
  const configFiles = [];

  for (const file of files) {
    const name = basename(file);
    const ext = extname(file);
    if (configFileNames.has(name)) configFiles.push(relative(options.root, file));
    if (name.startsWith('.env')) envNames.push(...envNamesFromText(await readFile(file, 'utf8')));
    if (sourceExtensions.has(ext) || configFileNames.has(name) || name.match(/README|\.md$/i)) {
      const text = await readFile(file, 'utf8').catch(() => '');
      imports.push(...importsFromText(text));
      hosts.push(...urlHostsFromText(text));
    }
  }

  const services = matchServices({
    dependencies,
    imports,
    envNames: [...new Set(envNames)],
    hosts: [...new Set(hosts)],
    configFiles: configFiles.map((file) => basename(file)),
    database,
  });
  const logo = await findProjectLogo(options.root, files);

  const graph = {
    generatedAt: new Date().toISOString(),
    project: {
      name: projectName,
      root: options.root,
      framework: detectFramework(options.root, packageJson, files),
      logo,
    },
    access: {
      allowedEmails: options.allowedEmails,
      requested: options.allowedEmails.length > 0,
    },
    services,
    edges: buildEdges(projectName, services),
    summary: {
      serviceCount: services.length,
      highConfidenceCount: services.filter((service) => service.confidence === 'high').length,
      scannedFileCount: files.length,
    },
  };

  await readdir(dirname(options.output)).catch(async () => {
    await import('node:fs/promises').then((fs) => fs.mkdir(dirname(options.output), { recursive: true }));
  });
  await writeFile(options.output, `${JSON.stringify(graph, null, 2)}\n`);
  console.log(`Wrote ${services.length} services to ${options.output}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
