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

## Update before running

Before either creation or refresh, run `node <skill-root>/scripts/update-skill.mjs` using the installed skill directory containing this file.
This checks the latest published npm release and updates installed copies, including symlinked installations, without requiring Git.
After an update, read `<skill-root>/SKILL.md` again and follow the updated instructions before running other scripts.
If the check fails, continue with the existing copy and report the failure briefly.
Development Git checkouts are intentionally left unchanged.
Updates happen when the skill runs, not immediately when a release is published.

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
Repository instructions encourage automatic skill selection but cannot guarantee that every AI host invokes skills.
Do not create CI workflows when generating or refreshing a map.

## Workflow

1. Complete the update check above before using the scripts.
2. Inspect the project layout and current web framework.
3. If the user gives a list of emails that may access the generated web page, pass them to the scan command with `--allow-email <email>` for each address or `--allow-emails <comma-separated-list>`.
4. Run `node <skill-root>/bin/servicemap.mjs generate --root <project-root> --no-open --no-deploy`.
   Include the access flags from the previous step when relevant.
   This scans the codebase, chooses page or desktop output, and installs repository instructions for automatic AI maintenance.
5. Review `.servicemap/internal-servicemap.json` for obvious false positives or missing high-confidence services.
6. If evidence-backed corrections or annotations are needed, edit the canonical JSON and run `refresh` to update the output safely.
7. Keep `.servicemap/refresh-state.json` alongside the map data in version control.
8. Adapt the generated surface to the project's existing design system only when the route is clear and the edits are low-risk.
9. Run the project's relevant build, lint, and focused tests.
   Open the generated map in a browser and verify both 2D and 3D modes.
   Click a product or service and verify its details panel and animated illuminated dashed child-branch connections.
   Drag service nodes beyond every side of the initial graph bounds, then pan and zoom; verify each parent-to-child line stays connected to its card.
   Keep the SVG connection layer overflow visible; clip only at the outer map viewport.
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
    Build a standalone app with `npm run tauri build -- --bundles app` on macOS, then open `src-tauri/target/release/bundle/macos/Internal Servicemap.app`.
    On other platforms, use `npm run tauri build -- --no-bundle` and launch the executable in `src-tauri/target/release`.
    Rebuild after refreshing the map so the app includes the latest data.
    Do not deliver `tauri dev` as the reusable app: it depends on a temporary development server and can show a blank window after reopening.
    Verify the standalone app loads the generated map with no development server running, fully quit it, reopen the built app, and confirm the same map loads again.
    Report the built app path and whether launch and quit/reopen verification succeeded.
    If native building fails, report the exact failure and the build command to retry from the generated folder.
    Do not claim the app is open unless the launch succeeds.

## Logo resolution

Generation and refresh automatically resolve service logos from the bundled catalog and official website icons.
For a missing service, add its evidence-backed name and `websiteUrl` to the canonical map, then run `refresh`.
Never guess a company's domain or invent a logo URL.
Preserve explicit `iconUrl` overrides and use `docsUrl` for documentation links.

### Product logo visual verification

When creating or refreshing a map, visually compare the selected product logo and other plausible repository logo images with the branding actually used in the application's UI.
Inspect the image contents, and trace the app's branding components to establish which artwork is currently used; do not infer a visual match from filenames alone.
Prefer the candidate whose shape, circuit or symbol details, proportions, and colors match the branding used consistently throughout the app, rather than a simplified favicon or an older variant.
When this comparison establishes a better match, set `project.logo.path` in `.servicemap/internal-servicemap.json` to that repository asset and run `refresh` to apply it.
Preserve an explicit user-selected logo.
If the available evidence does not establish a clear visual match, report the uncertainty instead of claiming a candidate is verified.

### Multiple SDKs or APIs from one company

When multiple SDKs or APIs from the same company are detected, use the same company logo for all of them.
Keep each integration as a separate node with its own name and details.
Use the same logo background color across those nodes rather than assigning different colors by list position.
For example, Apple HealthKit, EventKit, MapKit, AlarmKit, and Push Notifications should all share one Apple logo and background.
Preserve explicit user-selected logo overrides; otherwise resolve the company logo once and reuse the same `iconUrl` for every integration from that company.
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

## Service category filters

Generated maps include All, Infrastructure, Integrations, and Dev tools filters.
Selecting multiple categories highlights their combined services and dims other services and connections in both 2D and 3D.
Set `OPENAI_API_KEY` in the scanning process environment or the scanned project’s ignored `.env.local` to enable OpenAI Decisions classification.
Keep API keys local; never include them in generated pages, committed map data, or published packages.
The scanner sends only service names, catalog categories, and detection metadata (package names, environment variable names, hostnames, and configuration filenames), never environment values or source files.
Classifications are cached by evidence and rule version; `refresh --check` makes no API requests or cache writes.
Without a key or a valid API response, unmatched services remain uncategorized and visible under All.
To override a classification, edit the service’s `groups` array in `.servicemap/internal-servicemap.json`, using `infrastructure`, `integrations`, or `developer-tools`, then run `refresh`.
Refresh preserves these manual group edits.
