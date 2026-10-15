---
name: servicemap
description: Create or refresh a service map for a software project. Automatically use after adding, removing, or changing third-party services, SDKs, integrations, or service configuration when .servicemap/internal-servicemap.json exists.
metadata:
  short-description: Generate an internal servicemap page
---

# Servicemap

Use this skill when a user invokes `servicemap`, asks to create or update a map, or changes a third-party integration in a repository that already contains `.servicemap/internal-servicemap.json`.
Do not wait for the user to mention ServiceMap after an integration change.
The outcome is a working `/internalservicemap` page attached to the existing website when possible.
If no website can be found, create a desktop app fallback at `servicemap-desktop`.

## Refresh an existing map

When `.servicemap/internal-servicemap.json` exists, run `node <skill-root>/bin/servicemap.mjs refresh --root <project-root>` after completing integration changes.
Use the installed skill root containing this file, not the project's generated desktop app directory.
Then run the same command with `--check` to verify freshness.
Use this path instead of the creation workflow below; do not regenerate customized output.
The command preserves custom UI outside the generated data section, manual service metadata, and access settings.
If it reports a conflict inside the generated data section, preserve the file and reconcile the data edits into `.servicemap/internal-servicemap.json` before retrying.
Do not bypass conflicts by deleting refresh state or overwriting the map.
Include `.servicemap/internal-servicemap.json`, `.servicemap/refresh-state.json`, and updated output in the integration change.
Do not deploy or launch the map solely to refresh it.
Report any undetected integration rather than claiming every provider is supported.
Repository instructions encourage automatic skill selection; the CI freshness check is the enforcement backstop, not a guarantee that every AI host invokes skills.

## Workflow

1. If this skill is installed from the stable source clone at `~/.servicemap/source`, run `git -C ~/.servicemap/source pull --ff-only` before using the scripts.
   If the update fails because the network is unavailable, continue with the installed local copy and report that the auto-update did not complete.
2. Inspect the project layout and current web framework.
3. If the user gives a list of emails that may access the generated web page, pass them to the scan command with `--allow-email <email>` for each address or `--allow-emails <comma-separated-list>`.
4. Run `node <skill-root>/bin/servicemap.mjs generate --root <project-root> --no-open --no-deploy`.
   Include the access flags from the previous step when relevant.
   This scans the codebase, chooses page or desktop output, and installs repository instructions and the CI freshness check.
5. Review `.servicemap/internal-servicemap.json` for obvious false positives or missing high-confidence services.
6. If evidence-backed corrections or annotations are needed, edit the canonical JSON and run `refresh` to update the output safely.
7. Keep `.servicemap/refresh-state.json` alongside the map data in version control.
8. Adapt the generated surface to the project's existing design system only when the route is clear and the edits are low-risk.
9. Run the project's relevant build, lint, and focused tests.
   Open the generated map in a browser and verify both 2D and 3D modes.
   Click a product or service and verify its details panel and animated illuminated dashed child-branch connections.
   Verify that clicking anywhere outside an open service details panel (including the header and other service cards) closes it and returns to the normal main screen in both 2D and 3D.
   Clicking inside the panel must keep it open; the dismissal click must not activate or drag anything behind it.
   Preserve this behavior when adapting or refreshing existing maps.
   Drag a service and verify that only that node moves and its connections follow, including after zooming.
   After testing 3D, return the delivered preview to 2D and close any open details panel.
   Always initialize new maps in 2D; do not persist the last selected view mode.
   Desktop output uses the same interactive component as website output; missing interactions are generator bugs to fix, not controls to remove.
10. If a website page was created, tell the user it is only local until deployed and ask whether they want to deploy it now.
    Do not deploy unless the user explicitly says yes.
    If they approve, use the project's existing deployment path, preferring `npm run deploy` when present, then provider-specific project configuration such as Vercel or Netlify.
11. Report the page or desktop app path, service count, validation run, any services marked low or medium confidence, whether requested email access was enforced, and whether deployment was skipped or completed.
    For desktop output, explicitly include `Desktop app created at: <absolute-desktop-app-path>` in the final response, using the actual generated folder path as a clickable Markdown link.
    Include this path even when the app launches successfully so the user can find it later.
12. If a desktop app was created, launch the native desktop app after validation instead of relying on chat follow-up buttons.
    Open a terminal in the generated app directory and run `npm run tauri dev`.
    Keep that process running.
    Report whether the native desktop app opened.
    If Tauri, Rust, platform prerequisites, or another local issue prevents the native app from launching, report the exact failure and include this fallback command:
    `cd <absolute-desktop-app-path> && npm run tauri dev`.
    Do not claim the app is open unless the launch succeeds.

## Logo resolution

Generation and refresh automatically resolve service logos from the bundled catalog and official website icons.
For a missing service, add its evidence-backed name and `websiteUrl` to the canonical map, then run `refresh`.
Never guess a company's domain or invent a logo URL.
Preserve explicit `iconUrl` overrides and use `docsUrl` for documentation links.
If identity is unclear, research the official website before adding it; do not replace uncertain identity with a guessed logo.
Include generated `public/internalservicemap-assets/services/` files and `.servicemap/logo-cache/` alongside updated map data and refresh state.
The cache lets `refresh --check` validate without network access.
Report unresolved logos instead of claiming complete coverage.
See [service logos](references/service-logos.md) for fallback and cache behavior.

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
