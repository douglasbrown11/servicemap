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

1. If this skill is installed from the stable source clone at `~/.servicemap/source`, run `git -C ~/.servicemap/source pull --ff-only` before using the scripts.
   If the update fails because the network is unavailable, continue with the installed local copy and report that the auto-update did not complete.
2. Inspect the project layout and current web framework.
3. If the user gives a list of emails that may access the generated web page, pass them to the scan command with `--allow-email <email>` for each address or `--allow-emails <comma-separated-list>`.
4. Run `scripts/scan-project.mjs --root <project-root>` to create `.servicemap/internal-servicemap.json`.
   Include the access flags from the previous step when relevant.
5. Review the scan output for obvious false positives or missing high-confidence services.
6. If the scan detects a web framework or routeable website, run `scripts/generate-page.mjs --root <project-root>` to create the framework-specific `/internalservicemap` route.
7. If the scan reports `framework: static` or no website route can be safely attached, run `scripts/generate-desktop-app.mjs --root <project-root>` to create `servicemap-desktop`.
8. Adapt the generated surface to the project's existing design system only when the route is clear and the edits are low-risk.
9. Run the project's relevant build, lint, and focused tests.
   Open the generated map in a browser and verify both 2D and 3D modes.
   Click a product or service and verify its details panel and animated illuminated dashed child-branch connections.
   Drag a service and verify that only that node moves and its connections follow, including after zooming.
   After testing 3D, return the delivered preview to 2D and close any open details panel.
   Always initialize new maps in 2D; do not persist the last selected view mode.
   Desktop output uses the same interactive component as website output; missing interactions are generator bugs to fix, not controls to remove.
10. If a website page was created, tell the user it is only local until deployed and ask whether they want to deploy it now.
    Do not deploy unless the user explicitly says yes.
    If they approve, use the project's existing deployment path, preferring `npm run deploy` when present, then provider-specific project configuration such as Vercel or Netlify.
11. Report the page or desktop app path, service count, validation run, any services marked low or medium confidence, whether requested email access was enforced, and whether deployment was skipped or completed.

## Safety Rules

Read environment variable names only.
Never copy, expose, summarize, or commit secret values.
The scan output may include env var names such as `STRIPE_SECRET_KEY`, but not their values.

Do not add authentication, analytics, or external writes unless the user explicitly asks.
Deploy only after the generated website page exists and the user has confirmed deployment.
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
