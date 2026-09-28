---
name: stackmap
description: Create an /internalservicemap page or desktop app for a software project by scanning its codebase for external services, resolving logos, and attaching the map to the existing website when one is present.
metadata:
  short-description: Generate an internal stackmap page
---

# Stackmap

Use this skill when a user invokes `/stackmap` or asks to create an internal stackmap for a software project.
The outcome is a working `/internalservicemap` page attached to the existing website when possible.
If no website can be found, create a desktop app fallback at `stackmap-desktop`.

## Workflow

1. Inspect the project layout and current web framework.
2. Run `scripts/scan-project.mjs --root <project-root>` to create `.stackmap/internal-stackmap.json`.
3. Review the scan output for obvious false positives or missing high-confidence services.
4. If the scan detects a web framework or routeable website, run `scripts/generate-page.mjs --root <project-root>` to create the framework-specific `/internalservicemap` route.
5. If the scan reports `framework: static` or no website route can be safely attached, run `scripts/generate-desktop-app.mjs --root <project-root>` to create `stackmap-desktop`.
6. Adapt the generated surface to the project's existing design system only when the route is clear and the edits are low-risk.
7. Run the project's relevant build, lint, and focused tests.
8. Report the page or desktop app path, service count, validation run, and any services marked low or medium confidence.

## Safety Rules

Read environment variable names only.
Never copy, expose, summarize, or commit secret values.
The scan output may include env var names such as `STRIPE_SECRET_KEY`, but not their values.

Do not add authentication, deployment, analytics, or external writes unless the user explicitly asks.
If the repository already has route protection conventions for internal pages, follow them.
If no website route can be safely attached, create the desktop app fallback instead of forcing website files into an unrelated project.

## Supporting References

- For detection rules and evidence confidence, read [references/service-detection-rules.md](references/service-detection-rules.md).
- For route placement by framework, read [references/framework-routing.md](references/framework-routing.md).
- For page quality expectations, read [references/page-design.md](references/page-design.md).
- For desktop fallback behavior, read [references/desktop-fallback.md](references/desktop-fallback.md).
