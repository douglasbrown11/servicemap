#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scanScript = resolve(packageRoot, 'servicemap/scripts/scan-project.mjs');
const pageScript = resolve(packageRoot, 'servicemap/scripts/generate-page.mjs');
const desktopScript = resolve(packageRoot, 'servicemap/scripts/generate-desktop-app.mjs');

const targetCatalog = [
  { id: 'codex', label: 'Codex / ChatGPT desktop', kind: 'skill', root: () => resolve(homedir(), '.agents/skills'), recommended: true },
  { id: 'claude', label: 'Claude Code', kind: 'skill', root: () => resolve(homedir(), '.claude/skills'), recommended: true },
  { id: 'grok', label: 'Grok', kind: 'skill', root: () => resolve(homedir(), '.grok/skills'), recommended: true },
  { id: 'chatgpt', label: 'ChatGPT', kind: 'guide' },
  { id: 'gpt-6-astra', label: 'GPT-6 Astra', kind: 'guide' },
  { id: 'gpt-6-sol', label: 'GPT-6 Sol', kind: 'guide' },
  { id: 'gpt-6-luna', label: 'GPT-6 Luna', kind: 'guide' },
  { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol', kind: 'guide' },
  { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra', kind: 'guide' },
  { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna', kind: 'guide' },
  { id: 'claude-opus', label: 'Claude Opus', kind: 'guide' },
  { id: 'claude-sonnet', label: 'Claude Sonnet', kind: 'guide' },
  { id: 'claude-haiku', label: 'Claude Haiku', kind: 'guide' },
  { id: 'gemini-pro', label: 'Gemini Pro', kind: 'guide' },
  { id: 'gemini-flash', label: 'Gemini Flash', kind: 'guide' },
  { id: 'cursor', label: 'Cursor', kind: 'guide' },
  { id: 'windsurf', label: 'Windsurf', kind: 'guide' },
  { id: 'copilot', label: 'GitHub Copilot', kind: 'guide' },
  { id: 'vscode-chat', label: 'VS Code Chat', kind: 'guide' },
  { id: 'continue', label: 'Continue.dev', kind: 'guide' },
  { id: 'aider', label: 'Aider', kind: 'guide' },
  { id: 'cline', label: 'Cline', kind: 'guide' },
  { id: 'roo-code', label: 'Roo Code', kind: 'guide' },
  { id: 'zed-ai', label: 'Zed AI', kind: 'guide' },
  { id: 'replit-agent', label: 'Replit Agent', kind: 'guide' },
  { id: 'lovable', label: 'Lovable', kind: 'guide' },
  { id: 'bolt', label: 'Bolt', kind: 'guide' },
  { id: 'v0', label: 'v0', kind: 'guide' },
  { id: 'perplexity', label: 'Perplexity', kind: 'guide' },
  { id: 'mistral', label: 'Mistral Le Chat', kind: 'guide' },
  { id: 'deepseek', label: 'DeepSeek', kind: 'guide' },
  { id: 'qwen', label: 'Qwen', kind: 'guide' },
  { id: 'llama', label: 'Llama', kind: 'guide' },
  { id: 'ollama', label: 'Ollama', kind: 'guide' },
  { id: 'lm-studio', label: 'LM Studio', kind: 'guide' },
  { id: 'openrouter', label: 'OpenRouter', kind: 'guide' },
  { id: 'anthropic-api', label: 'Anthropic API apps', kind: 'guide' },
  { id: 'openai-api', label: 'OpenAI API apps', kind: 'guide' },
  { id: 'gemini-api', label: 'Gemini API apps', kind: 'guide' },
  { id: 'bedrock', label: 'Amazon Bedrock', kind: 'guide' },
  { id: 'azure-openai', label: 'Azure OpenAI', kind: 'guide' },
  { id: 'vertex-ai', label: 'Vertex AI', kind: 'guide' },
  { id: 'poe', label: 'Poe', kind: 'guide' },
  { id: 'you-com', label: 'You.com', kind: 'guide' },
  { id: 'phind', label: 'Phind', kind: 'guide' },
  { id: 'sourcegraph-cody', label: 'Sourcegraph Cody', kind: 'guide' },
  { id: 'tabnine', label: 'Tabnine', kind: 'guide' },
  { id: 'codeium', label: 'Codeium', kind: 'guide' },
  { id: 'jetbrains-ai', label: 'JetBrains AI', kind: 'guide' },
  { id: 'custom', label: 'Other custom model or agent', kind: 'guide' },
];

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    command: 'generate',
    root: process.cwd(),
    mode: 'auto',
    dryRun: false,
    agent: 'codex',
    targets: null,
    skillsDir: null,
    invokedWithoutArgs: args.length === 0,
    explicitCommand: false,
    generationRequested: false,
  };

  if (args[0] === 'skills' && args[1] === 'install') {
    options.command = 'install-skill';
    args.splice(0, 2);
  }

  if (args[0] && !args[0].startsWith('-')) {
    options.command = args.shift();
    options.explicitCommand = true;
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--root') {
      options.root = args[++index] ?? options.root;
      options.generationRequested = true;
    }
    if (arg === '--mode') {
      options.mode = args[++index] ?? options.mode;
      options.generationRequested = true;
    }
    if (arg === '--agent') options.agent = args[++index] ?? options.agent;
    if (arg === '--targets') options.targets = (args[++index] ?? '').split(',').map((target) => target.trim()).filter(Boolean);
    if (arg === '--skills-dir') options.skillsDir = resolve(args[++index] ?? '.');
    if (arg === '--user') options.user = true;
    if (arg === '--survey') options.survey = true;
    if (arg === '--yes' || arg === '-y') options.yes = true;
    if (arg === '--dry-run') options.dryRun = true;
    if (arg === '--help' || arg === '-h') options.help = true;
  }

  options.root = resolve(options.root);
  return options;
}

function help() {
  console.log(`Servicemap

Usage:
  servicemap
  servicemap generate [--root <project>] [--mode auto|page|desktop] [--dry-run]
  servicemap --root <project> [--mode auto|page|desktop] [--dry-run]
  servicemap install-skill [--survey] [--agent codex|claude|grok|all] [--targets <ids>]
  servicemap skills install [--survey] [--agent codex|claude|grok|all]

Examples:
  npx servicemap
  npx servicemap generate --root ../my-app
  npx servicemap -- --root ../my-app
  npx servicemap install-skill
  npx servicemap install-skill --survey
  npx servicemap install-skill --agent all
  npx servicemap install-skill --targets codex,claude,cursor
  npx servicemap skills install --agent claude
  servicemap --mode desktop
`);
}

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      ...options,
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

async function readScan(root) {
  const scanPath = resolve(root, '.servicemap/internal-servicemap.json');
  return JSON.parse(await readFile(scanPath, 'utf8'));
}

function targetsByIds(ids) {
  const byId = new Map(targetCatalog.map((target) => [target.id, target]));
  return ids.map((id) => {
    const target = byId.get(id);
    if (!target) {
      throw new Error(`Unknown target "${id}". Use --survey to choose from the list.`);
    }
    return target;
  });
}

function targetsForOptions(options) {
  if (options.targets?.length) return targetsByIds(options.targets);
  if (options.agent === 'all') return targetCatalog.filter((target) => target.kind === 'skill');
  if (options.agent === 'agents') return targetsByIds(['codex']);
  return targetsByIds([options.agent]);
}

function skillRootsForTargets(options, targets) {
  const skillTargets = targets.filter((target) => target.kind === 'skill');
  if (options.skillsDir && skillTargets.length) return [options.skillsDir];
  return [...new Set(skillTargets.map((target) => target.root()))];
}

function guideTargets(targets) {
  return targets.filter((target) => target.kind === 'guide');
}

function renderSurvey(selected, cursor) {
  console.clear();
  console.log('Where should Servicemap be available?');
  console.log('Use ↑/↓, Space to select, Enter to install.\n');

  targetCatalog.forEach((target, index) => {
    const pointer = index === cursor ? '>' : ' ';
    const checked = selected.has(target.id) ? 'x' : ' ';
    const detail = target.kind === 'skill' ? 'skill folder' : 'portable guide';
    console.log(`${pointer} [${checked}] ${target.label} (${detail})`);
  });
}

function runTargetSurvey() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return Promise.resolve(targetCatalog.filter((target) => target.recommended));
  }

  const selected = new Set(targetCatalog.filter((target) => target.recommended).map((target) => target.id));
  let cursor = 0;

  return new Promise((resolvePromise) => {
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    renderSurvey(selected, cursor);

    const onKeypress = (_str, key) => {
      if (key.name === 'up') cursor = (cursor - 1 + targetCatalog.length) % targetCatalog.length;
      if (key.name === 'down') cursor = (cursor + 1) % targetCatalog.length;
      if (key.name === 'space') {
        const id = targetCatalog[cursor].id;
        if (selected.has(id)) selected.delete(id);
        else selected.add(id);
      }
      if (key.name === 'return') {
        process.stdin.setRawMode(false);
        process.stdin.off('keypress', onKeypress);
        console.log('');
        resolvePromise(targetCatalog.filter((target) => selected.has(target.id)));
        return;
      }
      if (key.ctrl && key.name === 'c') {
        process.stdin.setRawMode(false);
        process.stdin.off('keypress', onKeypress);
        process.exit(130);
      }

      renderSurvey(selected, cursor);
    };

    process.stdin.on('keypress', onKeypress);
  });
}

function guideText(target) {
  return `# Servicemap for ${target.label}

Use this instruction with ${target.label} when you want it to create a service map for a software project.

Invoke: /servicemap

Goal:
Scan the current project for third-party services, resolve service logos from the bundled Servicemap database, and create an /internalservicemap page when a website is present.
If no website can be safely found, create a desktop app fallback named servicemap-desktop.

Recommended local command:
\`\`\`bash
npx servicemap --root <project-path>
\`\`\`

If your agent supports local skills, install the real skill folder with:
\`\`\`bash
npx servicemap install-skill --agent all
\`\`\`
`;
}

async function writeGuidePacks(targets, options) {
  const guideRoot = resolve(homedir(), '.servicemap/model-guides');
  for (const target of guideTargets(targets)) {
    const destination = join(guideRoot, target.id);
    if (options.dryRun) {
      console.log(`Would write Servicemap guide for ${target.label} to ${destination}`);
      continue;
    }
    await mkdir(destination, { recursive: true });
    await cp(resolve(packageRoot, 'servicemap/SKILL.md'), join(destination, 'SKILL.md'));
    await mkdir(join(destination, 'servicemap'), { recursive: true });
    await cp(resolve(packageRoot, 'servicemap'), join(destination, 'servicemap'), { recursive: true });
    await writeFile(join(destination, 'README.md'), guideText(target));
    console.log(`Wrote Servicemap guide for ${target.label} to ${destination}`);
  }
}

async function installSkill(options) {
  const source = resolve(packageRoot, 'servicemap');
  const selectedTargets = options.survey && !options.yes
    ? await runTargetSurvey()
    : targetsForOptions(options);
  const roots = skillRootsForTargets(options, selectedTargets);

  if (!existsSync(source)) {
    throw new Error(`Bundled skill folder not found: ${source}`);
  }

  if (options.dryRun) {
    for (const root of roots) {
      console.log(`Would install Servicemap skill to ${join(root, 'servicemap')}`);
    }
    await writeGuidePacks(selectedTargets, options);
    return;
  }

  for (const root of roots) {
    const destination = join(root, 'servicemap');
    await mkdir(root, { recursive: true });
    await rm(destination, { recursive: true, force: true });
    await cp(source, destination, { recursive: true });
    console.log(`Installed Servicemap skill to ${destination}`);
  }

  await writeGuidePacks(selectedTargets, options);

  console.log('Restart your AI app if /servicemap does not appear immediately.');
}

async function main() {
  const options = parseArgs();
  if (options.help) {
    help();
    return;
  }

  if (options.command === 'generate' && !options.explicitCommand && !options.generationRequested) {
    options.command = 'install-skill';
    options.survey = true;
  }

  if (options.command === 'install-skill' || options.command === 'install') {
    await installSkill(options);
    return;
  }

  if (options.command !== 'generate') {
    throw new Error(`Unknown command "${options.command}". Use generate, install-skill, or skills install.`);
  }

  if (!['auto', 'page', 'desktop'].includes(options.mode)) {
    throw new Error(`Unknown mode "${options.mode}". Use auto, page, or desktop.`);
  }

  await run(process.execPath, [scanScript, '--root', options.root]);
  const scan = await readScan(options.root);
  const selectedMode = options.mode === 'auto'
    ? scan.project?.framework === 'static' ? 'desktop' : 'page'
    : options.mode;

  console.log(`Servicemap detected ${scan.summary?.serviceCount ?? 0} services.`);
  console.log(`Framework: ${scan.project?.framework ?? 'unknown'}`);
  console.log(`Mode: ${selectedMode}`);

  if (options.dryRun) return;

  if (selectedMode === 'desktop') {
    await run(process.execPath, [desktopScript, '--root', options.root]);
  } else {
    await run(process.execPath, [pageScript, '--root', options.root]);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
