# Servicemap

Scan a software project for external services and generate a service map as a standalone desktop app.
Use the CLI directly or install the bundled skill for a compatible coding agent.
Detection uses supported package, configuration, environment-variable-name, and hostname rules; review the map for missing integrations.

## Install the skill

```bash
npx servicemap@latest
```

In an interactive terminal, choose additional agent folders; the installer always includes `~/.agents/skills`.
Restart your coding agent if the skill does not appear.
Skill discovery and invocation depend on the agent.
Ask your coding agent to create or refresh the service map using the installed `servicemap` skill.
For a specific agent without the survey:

```bash
npx servicemap@latest install-skill --agent codex
npx servicemap@latest install-skill --agent claude
```

Default installs link to `~/.servicemap/source`.
Update that source with `npx servicemap@latest update`.
The installed skill also checks for updates when its instructions are followed; development Git checkouts skip automatic updates.

## Generate a map

Run from your project directory:

```bash
npx servicemap@latest generate
```

Use `--root /path/to/project` to target another directory.
The generated desktop app is written to `servicemap-desktop/` inside the project.

Useful controls:

```bash
npx servicemap@latest generate --dry-run
npx servicemap@latest generate --no-open
npx servicemap@latest --help
```

`--dry-run` scans and writes `.servicemap/internal-servicemap.json`, but does not generate or launch the map.
`--no-open` skips automatic opening and desktop dependency installation/building.

## Desktop launch

Generation installs dependencies, builds a native Tauri app, and opens it.
Rust and the platform's Tauri build prerequisites must already be installed.
On macOS, reopen `servicemap-desktop/src-tauri/target/release/bundle/macos/Internal Servicemap.app` without a development server.
For a browser preview or manual build, see [Desktop guide](references/desktop-fallback.md).

## Keep a map current

After adding, changing, or removing an integration:

```bash
npx servicemap@latest refresh
npx servicemap@latest refresh --check
```

Add `--root /path/to/project` when running elsewhere.
Refresh updates existing map data while preserving custom labels, notes, manual services, and surrounding UI.
Store customizations in `.servicemap/internal-servicemap.json`; set `manual: true` to retain a service without detected evidence.
Direct edits to embedded generated data can cause a conflict; unsaved browser edits are not CLI input.
Refresh does not rebuild or reopen the native desktop app; rebuild it to include updated data.

`refresh --check` checks without writing files or making logo requests and exits with status 1 when stale, missing, or conflicting.
Commit the map JSON, generated output/assets, and `.servicemap/refresh-state.json` together.

Generation and refresh add maintenance instructions to `AGENTS.md`, `CLAUDE.md`, and `.github/copilot-instructions.md`, preserving existing instructions.
These ask participating agents to refresh after integration changes; they are not a background watcher.
No CI workflow is created.

## Logos and categories

Thousands of bundled brand icons work without an API key.
Missing logos can resolve from a service's known website and are cached locally; failed lookups use initials.
Custom logos take precedence.
See [Service logos](references/service-logos.md) for overrides and website fallback behavior.

Interactive maps support 2D/3D views and category filters.
When using the skill, your coding agent assigns service categories directly from project evidence; no separate API key or model setup is required.
The agent reviews new or changed integrations, preserves user assignments, and leaves uncertain services uncategorized.
The standalone CLI does not invoke an AI model; it preserves saved categories but leaves new services uncategorized and visible under All until reviewed.
Categories describe each service's role in your project:

- **Infrastructure:** hosting, databases, storage, networking, authentication, and queues.
- **Integrations:** product capabilities such as payments, AI, email, maps, and CRM.
- **Dev tools:** builds, testing, CI/CD, monitoring, and analytics.

A service can belong to multiple categories when project usage supports it.
To assign categories manually, edit each service's `groups` in `.servicemap/internal-servicemap.json` using `infrastructure`, `integrations`, or `developer-tools`, then run `refresh`.
Refresh preserves saved group assignments.

For scanner coverage, see [Detection rules](references/service-detection-rules.md).
For agent workflows, see [SKILL.md](SKILL.md).
