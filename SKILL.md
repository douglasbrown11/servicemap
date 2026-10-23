---
name: servicemap
description: Create or refresh a service map for a software project. Automatically use after adding, removing, or changing third-party services, SDKs, integrations, or service configuration when .servicemap/internal-servicemap.json exists.
metadata:
  short-description: Create a standalone ServiceMap desktop app
---

# Servicemap

Use this skill when a user invokes `servicemap`, asks to create or update a map, or changes a third-party integration in a repository that already contains `.servicemap/internal-servicemap.json`.
Do not wait for the user to mention ServiceMap after an integration change.
The outcome is a standalone native desktop app at `servicemap-desktop`.
Always use desktop output, regardless of the project framework.

## Update before running

Before either creation or refresh, run `node <skill-root>/scripts/update-skill.mjs` using the installed skill directory containing this file.
This checks the latest published npm release and updates installed copies, including symlinked installations, without requiring Git.
After an update, read `<skill-root>/SKILL.md` again and follow the updated instructions before running other scripts.
If the check fails, continue with the existing copy and report the failure briefly.
Development Git checkouts are intentionally left unchanged.
Updates happen when the skill runs, not immediately when a release is published.

## Refresh an existing map

When `.servicemap/internal-servicemap.json` and its desktop output exist, run `node <skill-root>/bin/servicemap.mjs refresh --root <project-root>` after completing integration changes.
Use the installed skill root containing this file, not the project's generated desktop app directory.
After refreshing, review new or changed services and assign their category groups using the Service category filters instructions below.
If you edit groups, run `refresh` again to apply them to the generated output.
Then run the same command with `--check` to verify freshness.
Use this path instead of the creation workflow below; do not regenerate customized output.
Before refreshing, inspect `.servicemap/refresh-state.json` and verify every tracked surface belongs to `servicemap-desktop/`.
If it tracks any other surface, preserve the existing files and canonical JSON, generate desktop output directly with `node <skill-root>/scripts/generate-desktop-app.mjs --root <project-root>`, then register its refresh baseline with the exported `registerRefresh(projectRoot)` function in `<skill-root>/scripts/refresh.mjs`.
Filter `.servicemap/refresh-state.json` surfaces to `servicemap-desktop/` before running `refresh`; registration may also discover older output.
After desktop generation, apply this same filter before any subsequent refresh.
The command preserves custom UI outside the generated data section, manual service metadata, and access settings.
If it reports a conflict inside the generated data section, preserve the file and reconcile the data edits into `.servicemap/internal-servicemap.json` before retrying.
Do not bypass conflicts by deleting refresh state or overwriting the map.
Include `.servicemap/internal-servicemap.json`, `.servicemap/refresh-state.json`, and updated output in the integration change.
Do not launch the map solely to refresh it.
Report any undetected integration rather than claiming every provider is supported.
Repository instructions encourage automatic skill selection but cannot guarantee that every AI host invokes skills.
Do not create CI workflows when generating or refreshing a map.

## Workflow

1. Complete the update check above before using the scripts.
2. Inspect the project layout and integration evidence.
3. Run `node <skill-root>/bin/servicemap.mjs generate --root <project-root> --mode desktop --no-open --no-deploy`.
   This scans the codebase, creates the desktop app, and installs repository instructions for automatic AI maintenance.
4. Confirm the output is in `servicemap-desktop/`.
   Verify `.servicemap/refresh-state.json` tracks only surfaces inside `servicemap-desktop/`; remove any other surface entries while preserving the files themselves.
5. Review `.servicemap/internal-servicemap.json` for obvious false positives or missing high-confidence services.
   Assign category groups to every detected service using the Service category filters instructions below.
6. If evidence-backed corrections or annotations are needed, edit the canonical JSON and run `refresh` to update the output safely.
7. Keep `.servicemap/refresh-state.json` alongside the map data in version control.
8. Keep the desktop interface consistent with the ServiceMap design and the project's verified branding.
9. Run the generated desktop app's relevant build, lint, and focused tests.
   Verify both 2D and 3D modes in the desktop app.
   Click a product or service and verify its details panel and animated illuminated dashed child-branch connections.
   Drag service nodes beyond every side of the initial graph bounds, then pan and zoom; verify each parent-to-child line stays connected to its card.
   Keep the SVG connection layer overflow visible; clip only at the outer map viewport.
   Verify that clicking anywhere outside an open service details panel (including the header and other service cards) closes it and returns to the normal main screen in both 2D and 3D.
   Clicking inside the panel must keep it open; the dismissal click must not activate or drag anything behind it.
   Preserve this behavior when adapting or refreshing existing maps.
   Drag a service and verify that only that node moves and its connections follow, including after zooming.
   After testing 3D, return the delivered preview to 2D and close any open details panel.
   Always initialize new maps in 2D; do not persist the last selected view mode.
   Missing interactions are generator bugs to fix, not controls to remove.
10. Report the desktop app path, service count, validation run, and any services marked low or medium confidence.
    Explicitly include `Desktop app created at: <absolute-desktop-app-path>` in the final response, using the actual generated folder path as a clickable Markdown link.
    Include this path even when the app launches successfully so the user can find it later.
11. Launch the native desktop app after validation instead of relying on chat follow-up buttons.
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

## Supporting References

- For detection rules and evidence confidence, read [references/service-detection-rules.md](references/service-detection-rules.md).
- For desktop interface quality expectations, read [references/page-design.md](references/page-design.md).
- For desktop app generation and launch, read [references/desktop-fallback.md](references/desktop-fallback.md).

## Service category filters

Generated maps include All, Infrastructure, Integrations, and Dev tools filters.
Selecting multiple categories highlights their combined services and dims other services and connections in both 2D and 3D.
The AI model running this skill assigns categories directly from the detected services and project usage; no separate model API, API key, or environment setup is required.
For every new service, inspect its name, catalog category, detection evidence, and relevant project usage, then write its `groups` array in `.servicemap/internal-servicemap.json`.
Use only these values:

- `infrastructure`: hosting, compute, databases, storage, networking, authentication infrastructure, or queues.
- `integrations`: external product or business capabilities such as payments, AI inference, email delivery, maps, or CRM.
- `developer-tools`: CI/CD, testing, build tooling, error monitoring, observability, or product analytics.

Assign multiple groups only when project usage supports multiple roles.
Having an API or SDK alone does not make a service an integration.
Preserve existing user assignments; review changed integrations and update their groups when the evidence warrants it.
If the role cannot be established, leave `groups: []` and report the uncertainty instead of guessing.
After editing groups, run `refresh` to apply them to the generated output, then `refresh --check` to verify freshness.
The scanner preserves saved groups and leaves new services uncategorized until the AI host reviews them.
Running the CLI alone does not invoke an AI model; unassigned services remain visible under All.
Existing saved categories continue working without credentials.
