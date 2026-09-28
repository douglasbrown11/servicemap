# Framework Routing

Create `/internalservicemap` using the project's existing routing convention.

Preferred route locations:
- Next.js App Router: `app/internalservicemap/page.tsx` or `src/app/internalservicemap/page.tsx`.
- Next.js Pages Router: `pages/internalservicemap.tsx` or `src/pages/internalservicemap.tsx`.
- Astro: `src/pages/internalservicemap.astro`.
- Remix: `app/routes/internalservicemap.tsx`.
- Vite apps with an existing router: add a route matching the app's route conventions.
- Unknown static sites: prefer the desktop fallback app unless the user explicitly wants static website files.

If the project has middleware, auth wrappers, layout conventions, or route metadata, adapt the generated page to match.
Do not invent a new router or add a new framework.

If a project has no website, run `scripts/generate-desktop-app.mjs --root <project-root>` and report the generated desktop app path.
