# Desktop Fallback

Use the desktop fallback when no website route can be confidently attached.

Run:

```bash
scripts/generate-desktop-app.mjs --root <project-root>
```

The generated app is written to:

```text
stackmap-desktop
```

It is a Vite React app with Tauri configuration.
It can run as a web preview with `npm run dev`.
It can be packaged as a native desktop app with `npm run tauri build` when the local machine has the Tauri/Rust toolchain available.

Validate the generated app with:

```bash
npm install
npm run build
```

Do not install global tooling automatically.
If native packaging fails because Rust, platform SDKs, or Tauri prerequisites are missing, report that the app source was generated and the web build passed.
