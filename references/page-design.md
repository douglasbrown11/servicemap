# Page Design

The page should be useful on first load, not a marketing landing page.

Show:
- Project name.
- Number of detected services.
- High-confidence service count.
- Framework detected.
- Service cards with logo, name, category, confidence, and strongest evidence.

Keep the text concise.
Use the host project's design system when it is easy to identify.
Avoid exposing secrets or internal URLs that are not already present as public hostnames.

Prefer a clean operational interface:
- compact summary metrics
- scannable service cards
- clear confidence labels
- evidence shown in short form

If the UI looks obviously off after rendering, fix the layout before finishing.

## Service details dismissal

Clicking anywhere outside an open service details panel must close it and restore the normal main screen, including clicks on the header or other service cards.
Keep clicks inside the panel interactive without dismissing it.
Consume the outside click so it does not activate underlying controls or start dragging the map or a service.
Apply and verify this behavior in both 2D and 3D, for website and desktop output.
