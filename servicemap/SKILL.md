---
name: servicemap
description: Create an /internalservicemap page or desktop app for a software project by scanning its codebase for external services, resolving logos, and attaching the map to the existing website when one is present.
metadata:
  short-description: Generate an internal servicemap page
---

# Servicemap

Use this skill when a user invokes `servicemap` or asks to create an internal servicemap for a software project.
The outcome is a working `/internalservicemap` page attached to the existing website when possible.
If no website can be found, create a desktop app fallback at `servicemap-desktop`.

## Workflow

1. Inspect the project layout and current web framework.
2. If the user gives a list of emails that may access the generated web page, pass them to the scan command with `--allow-email <email>` for each address or `--allow-emails <comma-separated-list>`.
3. Run `scripts/scan-project.mjs --root <project-root>` to create `.servicemap/internal-servicemap.json`.
   Include the access flags from the previous step when relevant.
4. Review the scan output for obvious false positives or missing high-confidence services.
5. If the scan detects a web framework or routeable website, run `scripts/generate-page.mjs --root <project-root>` to create the framework-specific `/internalservicemap` route.
6. If the scan reports `framework: static` or no website route can be safely attached, run `scripts/generate-desktop-app.mjs --root <project-root>` to create `servicemap-desktop`.
7. Adapt the generated surface to the project's existing design system only when the route is clear and the edits are low-risk.
8. Run the project's relevant build, lint, and focused tests.
9. Report the page or desktop app path, service count, validation run, any services marked low or medium confidence, and whether requested email access was enforced.

## Safety Rules

Read environment variable names only.
Never copy, expose, summarize, or commit secret values.
The scan output may include env var names such as `STRIPE_SECRET_KEY`, but not their values.

Do not add authentication, deployment, analytics, or external writes unless the user explicitly asks.
If the repository already has route protection conventions for internal pages, follow them.
When email access is requested, enforce it only through the app's existing server-side authentication.
The built-in generator can enforce email allowlists for Next.js App Router projects using Clerk by checking `currentUser()` against the configured emails.
For unsupported frameworks or static output, report that the allowlist is recorded but not enforced.
If no website route can be safely attached, create the desktop app fallback instead of forcing website files into an unrelated project.

## Supporting References

- For detection rules and evidence confidence, read [references/service-detection-rules.md](references/service-detection-rules.md).
- For route placement by framework, read [references/framework-routing.md](references/framework-routing.md).
- For page quality expectations, read [references/page-design.md](references/page-design.md).
- For desktop fallback behavior, read [references/desktop-fallback.md](references/desktop-fallback.md).
