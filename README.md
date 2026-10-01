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

## Contents

- `servicemap/`: installable skill folder
- `bin/servicemap.mjs`: npm CLI entrypoint
- `servicemap/scripts/scan-project.mjs`: scans a project for service evidence
- `servicemap/scripts/generate-page.mjs`: creates website routes
- `servicemap/scripts/generate-desktop-app.mjs`: creates the desktop fallback
- `servicemap/assets/service-logo-database.json`: 1,000 service logo records

## Validation

```bash
node bin/servicemap.mjs generate --root demo-project --allow-emails founder@example.com,ops@example.com --dry-run
node bin/servicemap.mjs --root no-website-demo --dry-run
node bin/servicemap.mjs --dry-run
node bin/servicemap.mjs install-skill --agent all --dry-run
node bin/servicemap.mjs install-skill --targets universal,claude,grok --dry-run
node bin/servicemap.mjs skills install --agent claude --dry-run
python3 /Users/dougie/.codex/skills/.system/skill-creator/scripts/quick_validate.py servicemap
```
