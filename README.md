# Servicemap

Reusable `servicemap` skill package and CLI.

The skill scans a software project for external services, resolves service logos from a bundled database, and creates either an `/internalservicemap` website route or a desktop app fallback.

## Terminal Use

The npm package name `servicemap` is available, so users can run the clean command and choose where to install it:

```bash
npx servicemap
```

That opens the interactive install survey.
It installs to the universal `.agents/skills` folder and lets users choose additional agent-specific skill folders.

To install the bundled AI skill so `/servicemap` appears in compatible coding agents:

```bash
npx servicemap install-skill
```

To use an interactive Caveman-style terminal survey:

```bash
npx servicemap install-skill --survey
```

That installs to the Codex-style user skill folder, matching the way Caveman installs a local skill folder.
To install for several agents on the same computer:

```bash
npx servicemap install-skill --agent all
```

The Caveman-style command shape also works:

```bash
npx servicemap skills install --agent claude
```

Agents with known local skill folders get the real `servicemap` skill installed.
Symlink installs use a stable local clone at `~/.servicemap/source`, so updates can be pulled without reinstalling every agent folder.

To update that local skill source:

```bash
npx servicemap update
```

Running `npx servicemap` again also refreshes the stable source before installing.

After a global install, the command is:

```bash
servicemap
```

Install globally:

```bash
npm install -g servicemap
```

CLI options:

```bash
servicemap
servicemap generate --root <project-path>
servicemap --root <project-path>
servicemap generate --root <project-path> --allow-emails founder@example.com,ops@example.com
servicemap generate --root <project-path> --allow-email founder@example.com --allow-email ops@example.com
servicemap generate --root <project-path> --deploy
servicemap generate --root <project-path> --deploy-command "npm run deploy"
servicemap --mode page
servicemap --mode desktop
servicemap --dry-run
servicemap install-skill
servicemap install-skill --survey
servicemap install-skill --agent codex
servicemap install-skill --agent claude
servicemap install-skill --agent grok
servicemap install-skill --agent all
servicemap install-skill --targets universal,claude,grok
servicemap skills install --agent codex
servicemap update
```

When a website page is generated, Servicemap prompts before deployment when it detects a deployment command.
It prefers an existing `npm run deploy` script, then provider config such as Vercel or Netlify.
Use `--no-deploy` to skip the prompt.

## Contents

- `SKILL.md`: installable Servicemap skill entrypoint
- `bin/servicemap.mjs`: npm CLI entrypoint
- `scripts/scan-project.mjs`: scans a project for service evidence
- `scripts/generate-page.mjs`: creates website routes
- `scripts/generate-desktop-app.mjs`: creates the desktop fallback
- `assets/service-logo-database.json`: 1,000 service logo records

## Validation

```bash
node bin/servicemap.mjs generate --root demo-project --allow-emails founder@example.com,ops@example.com --dry-run
node bin/servicemap.mjs --root no-website-demo --dry-run
node bin/servicemap.mjs --dry-run
node bin/servicemap.mjs install-skill --agent all --dry-run
node bin/servicemap.mjs install-skill --targets universal,claude,grok --dry-run
node bin/servicemap.mjs skills install --agent claude --dry-run
python3 /Users/dougie/.codex/skills/.system/skill-creator/scripts/quick_validate.py .
```

## Keep an existing map current

Run `npx servicemap refresh` after adding, removing, or changing an integration.
Use `--root <project>` when running outside that project.
Refresh scans the current code, merges service data, and updates the existing map without rebuilding its surrounding UI.
A refresh with no changes leaves map files untouched.

Service notes, custom labels, unknown metadata fields, manual services, and access settings are preserved.
Set `manual: true` on a service that should remain even without matching source evidence.
Removed detected services disappear unless customized; customized records remain with `detected: false`, empty evidence, and low confidence so annotations are not lost.
Browser-local positions are unaffected because service IDs and layout storage keys stay stable.
Edits made only in an open browser's unsaved state are not repository data and cannot be recovered by the CLI.

For React output, refresh changes the embedded graph data only.
For static, Astro, and server-protected output, it updates the generated HTML data section while preserving surrounding CSS, code, and access checks.
If that generated section was edited directly since the last refresh, the command reports a conflict before writing any map files.
Keep service annotations in `.servicemap/internal-servicemap.json` rather than editing the embedded generated data.
Older maps without refresh state are adopted on their first refresh when their generated data section is recognizable.

### Automatic AI maintenance

Creating or refreshing a map installs a marked maintenance block in `AGENTS.md`, `CLAUDE.md`, and `.github/copilot-instructions.md` without replacing existing instructions.
The block asks the AI to invoke the installed skill and refresh the map after integration changes.
The skill itself also describes integration changes as a trigger.
An AI host must support and follow those instructions; this is not a background filesystem watcher or a universal completion hook.

### CI freshness check

Run `npx servicemap refresh --check` to check without writing any files.
It exits successfully for a current map and exits with status 1 for stale data, missing output/state, or a conflicting generated data section.
Checks ignore scan timestamps, absolute checkout paths, and unrelated file-count changes.
Commit the map JSON, generated output, and `.servicemap/refresh-state.json` together.
The state records previous detection results and generated data sections so refresh can preserve customizations and detect conflicts.

Generation and refresh create `.github/workflows/servicemap-freshness.yml` if that file does not exist.
The installed instructions and workflow pin the generating ServiceMap package version for reproducibility.
That package version must be available on npm before remote agents or CI can run these commands.
The workflow checks pushes and pull requests with read-only repository permissions and does not install or execute the target project's dependencies.
An existing workflow at that path is preserved; add the check command to it yourself if necessary.
For other CI providers, run the same check command in your existing pipeline.
Detection is limited to supported scanner rules; the check does not prove that every possible service was discovered.
