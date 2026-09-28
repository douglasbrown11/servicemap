# Servicemap

Reusable `servicemap` skill package and CLI.

The skill scans a software project for external services, resolves service logos from a bundled database, and creates either an `/internalservicemap` website route or a desktop app fallback.

## Terminal Use

The npm package name `servicemap` is available, so users can run the clean command:

```bash
npx servicemap
```

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
servicemap --root <project-path>
servicemap --mode page
servicemap --mode desktop
servicemap --dry-run
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
node bin/servicemap.mjs --root demo-project --dry-run
node bin/servicemap.mjs --root no-website-demo --dry-run
python3 /Users/dougie/.codex/skills/.system/skill-creator/scripts/quick_validate.py servicemap
```
