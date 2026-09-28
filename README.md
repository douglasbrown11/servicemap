# Stackmap Skill

Reusable `/stackmap` skill package.

The skill scans a software project for external services, resolves service logos from a bundled database, and creates either an `/internalservicemap` website route or a desktop app fallback.

## Contents

- `stackmap/`: installable skill folder
- `stackmap/scripts/scan-project.mjs`: scans a project for service evidence
- `stackmap/scripts/generate-page.mjs`: creates website routes
- `stackmap/scripts/generate-desktop-app.mjs`: creates the desktop fallback
- `stackmap/assets/service-logo-database.json`: 1,000 service logo records

## Validation

```bash
python3 /Users/dougie/.codex/skills/.system/skill-creator/scripts/quick_validate.py stackmap
```
