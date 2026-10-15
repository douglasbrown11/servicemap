# Service logos

ServiceMap ships the complete pinned Simple Icons catalog and curated service identity rules.
Catalog matches use bundled SVGs without network access.
The catalog includes brands beyond the services the scanner can automatically detect.
Detection uses explicit SDK package names, environment variable prefixes, configuration files, and official domains.
Aliases resolve logo identity; they do not automatically become SDK names.

## Automatic fallback

Generation and refresh resolve logos for every service, including manually added services.
A custom `iconUrl` takes precedence over the catalog.
A relative custom image path stays unchanged.
Remote custom logos are validated and copied locally.
When no bundled logo is available, ServiceMap checks the service's explicit `websiteUrl` or curated official website for declared icons, then `/favicon.ico`.
It does not guess company domains from service names or send repository contents to a logo service.
No paid API, API key, or AI model is required.
Unknown company identity still requires an evidence-backed `websiteUrl` in the canonical map.
If researching that identity with an AI agent, confirm the official website before adding it.

For a manually added service, use fields such as:

```json
{
  "id": "custom-provider",
  "name": "Custom Provider",
  "manual": true,
  "websiteUrl": "https://provider.example"
}
```

Put this record in `.servicemap/internal-servicemap.json`, then run `npx servicemap@latest refresh`.
An optional `iconUrl` overrides the selected image; `docsUrl` supplies a separate documentation link.

Resolved images live in the generated app's `public/internalservicemap-assets/services/` directory.
Website downloads are cached in `.servicemap/logo-cache/` for reuse across generated surfaces and offline runs.
Commit both the generated assets and the cache alongside the map and refresh state so CI can reproduce rendered data without network access.
`refresh --check` never downloads or writes logos and reports missing generated assets as stale.
Failed lookups use initials and are reported by service name.
Failures are cached for 24 hours to avoid repeating unavailable requests on every refresh.
Delete a service's failed cache record to retry sooner.
Custom externally hosted logos need one successful download before offline reuse.

## Download limits

The resolver accepts public HTTPS sources only, checks DNS addresses, pins the validated address to each connection, and rechecks redirects.
Local addresses, credentials, custom ports, oversized responses, active SVG content, and non-image responses are rejected.
Requests have timeouts, redirects are bounded, and downloads run with limited concurrency.
Unavailable or blocked sources do not prevent map generation.
IPv4 connectivity is required for website fallback; bundled and cached logos work without it.

## Maintaining the catalog

Edit `assets/service-logo-overrides.json` for verified names, aliases, official domains, SDK packages, and environment prefixes.
Do not treat Simple Icons' `sourceUrl` as a service website; it can point to a third-party brand gallery.
Update the exact `simple-icons` development dependency, then run `npm run build:logos`.
The build writes `assets/service-logo-database.json`, `assets/service-logo-assets.json`, and the upstream license.
These generated files ship in the npm package and installed skill; end users do not need the development dependency.
Run `npm test` and inspect `npm pack --dry-run` before publishing.
Simple Icons assets retain their upstream license; downloaded company assets remain subject to their owners' brand terms.
