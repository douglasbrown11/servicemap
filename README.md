# Stackmap

Reusable `/stackmap` skill package and CLI.

The skill scans a software project for external services, resolves service logos from a bundled database, and creates either an `/internalservicemap` website route or a desktop app fallback.

## Terminal Use

The exact npm package name `stackmap` is already owned by someone else.
Until that name can be transferred, publish this package as `@douglasbrown11/stackmap`.

After publishing, users can run:

```bash
npx @douglasbrown11/stackmap
```

The installed command name is still:

```bash
stackmap
```

CLI options:

```bash
stackmap --root <project-path>
stackmap --mode page
stackmap --mode desktop
stackmap --dry-run
```

## Contents

- `stackmap/`: installable skill folder
- `bin/stackmap.mjs`: npm CLI entrypoint
- `stackmap/scripts/scan-project.mjs`: scans a project for service evidence
- `stackmap/scripts/generate-page.mjs`: creates website routes
- `stackmap/scripts/generate-desktop-app.mjs`: creates the desktop fallback
- `stackmap/assets/service-logo-database.json`: 1,000 service logo records

## Validation

```bash
node bin/stackmap.mjs --root demo-project --dry-run
node bin/stackmap.mjs --root no-website-demo --dry-run
python3 /Users/dougie/.codex/skills/.system/skill-creator/scripts/quick_validate.py stackmap
```
