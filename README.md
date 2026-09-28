# Service Map Skill

Reusable `/service-map` skill package.

The skill scans a software project for external services, resolves service logos from a bundled database, and creates either an `/internalservicemap` website route or a desktop app fallback.

## Contents

- `service-map/`: installable skill folder
- `service-map/scripts/scan-project.mjs`: scans a project for service evidence
- `service-map/scripts/generate-page.mjs`: creates website routes
- `service-map/scripts/generate-desktop-app.mjs`: creates the desktop fallback
- `service-map/assets/service-logo-database.json`: 1,000 service logo records

## Validation

```bash
python3 /Users/dougie/.codex/skills/.system/skill-creator/scripts/quick_validate.py service-map
```
