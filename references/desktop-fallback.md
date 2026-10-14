# Desktop Fallback

Use the desktop fallback when no website route can be confidently attached.

Run:

```bash
scripts/generate-desktop-app.mjs --root <project-root>
```

The generated app is written to:

```text
servicemap-desktop
```

It is a Vite React app with Tauri configuration.
The CLI automatically installs missing local dependencies and runs `npm run tauri dev` from the generated directory after generation and refresh finish.
Use `--no-open` to generate without launching.
Keep the terminal running while using the app.
It can also run as a web preview with `npm run dev`.
It can be packaged as a native desktop app with `npm run tauri build` when the local machine has the Tauri/Rust toolchain available.

Validate the generated app with:

```bash
npm install
npm run build
```

Do not install global tooling automatically.
If native packaging fails because Rust, platform SDKs, or Tauri prerequisites are missing, report that the app source was generated and the web build passed.

## Desktop identity

The generated desktop app uses the shared green Service Map network logo for its Dock and application icons.
The project logo belongs inside the map and must not replace `src-tauri/icons` or the configured bundle icons.
The packaged icon source is `assets/desktop-icons/service-map.svg`, derived from the SettleAI website Service Map header.
