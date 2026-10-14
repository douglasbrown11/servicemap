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
The generator script above only writes the app; see [Desktop launch](../README.md#desktop-launch) for CLI startup behavior and launch controls.
It can also run as a web preview with `npm run dev`.
It can be packaged as a native desktop app with `npm run tauri build` when the local machine has the Tauri/Rust toolchain available.

The development server requires port 5173 and fails if it is occupied, keeping it aligned with Tauri’s configured URL rather than selecting a fallback port.

Run the following commands from `servicemap-desktop` to validate the generated app:

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
