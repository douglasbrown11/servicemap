# Website access options for Servicemap

These are proposed ways to deliver a service map to a product's website. They are not all implemented today.

Scan the product's source repositories independently of the destination. Each destination adapter should consume the same service graph.

## 1. Website in the same repository

Find the website application or folder within the product repository. Detect its framework and generate the service map route there.

## 2. Separate local website repository

Use a user-supplied local path, or locate a related checkout in the workspace. Scan the product repository and generate the page in the website checkout.

## 3. Website repository on GitHub or another Git host

Use an authorized Git connection and an explicit repository URL, or resolve a related repository from available evidence. Clone or open the website repository, generate the page, validate it, and propose the change through a pull request or the user's requested workflow.

## 4. Hosting provider connection

Use a provider connection, such as Vercel or Netlify, to identify the hosting project associated with the supplied website domain. Where available, inspect the linked source repository and use it as the page destination. A hosting connection does not necessarily provide access to modify that repository.

## 5. Website builder or CMS

Use the website builder's or CMS's authorized API or plugin to add a page, custom code, or an embedded map, where supported. Adapt the output to the platform's capabilities rather than assuming it accepts a framework route.

## 6. Independently hosted service map

If the main website cannot accept a page, offer a separately hosted map that can be linked from or embedded in the website. Confirm this destination with the user before choosing it as a fallback.

## Shared resolution behavior

- Prefer explicit local paths and repository identifiers over inferred matches.
- Treat a website URL as a discovery clue, not as write access.
- Use domain references and hosting configuration to find candidate destinations; ask the user to choose when the evidence is ambiguous.
- Save the confirmed source-to-destination mapping for subsequent runs from either repository.
- Validate the generated page using the destination project's build and routing conventions.
- Follow existing access protection for internal pages and the user's deployment instructions.
- If destination access is missing, preserve the scan results and explain what access is needed. Do not silently substitute a desktop app for a requested website page.

## Lunifer example

Source: `douglasbrown11/Lunifer`, the product's Xcode app repository.

Website destination: `douglasbrown11/luniferWebsite`, the separate Next.js website repository.

Scan the product repository, then use its service graph to generate `/internalservicemap` in the website repository. The website's own dependencies must not replace the product's service inventory.
