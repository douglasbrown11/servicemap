# Service Map desktop icon

This icon reproduces the Service Map header in the SettleAI website source, rather than using a screenshot or the scanned project's logo.

Source: `app/internal/service-map/desktop/App.tsx` (`Network size={18}`) and `app/internal/service-map/desktop/styles.css` (`.brand__mark`) in the SettleAI website repository.
The SVG preserves the network paths, green gradient, mint stroke, rounded tile, and relative symbol size, with transparent padding for the Dock.
The Network paths come from Lucide and their license is included in `LICENSE.lucide`.

Regenerate the native assets using the Tauri CLI:

```sh
tauri icon assets/desktop-icons/service-map.svg --output assets/desktop-icons
```

Keep only the desktop PNG, ICNS, and ICO files used by `scripts/generate-desktop-app.mjs`; the command also generates unused mobile and Windows Store assets.
The generator copies these prebuilt files so consumers do not need image-conversion tools.
