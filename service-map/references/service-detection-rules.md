# Service Detection Rules

The scanner should prefer evidence from package dependencies, imports, known config files, environment variable names, and official service domains.

High-confidence evidence:
- Direct dependency names such as `stripe`, `firebase`, `@supabase/supabase-js`, or `@sentry/nextjs`.
- Known config files such as `firebase.json`, `vercel.json`, or `wrangler.toml`.

Medium-confidence evidence:
- Environment variable names such as `STRIPE_SECRET_KEY`, `RESEND_API_KEY`, or `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.
- Official domains found in docs or source comments.

Low-confidence evidence:
- Generic text mentions without package, env, URL, or config evidence.

Never inspect or display secret values.
Only read the variable name before the equals sign in `.env` files.

False positives to watch:
- Short generated-database aliases that match ordinary words.
- Package names that are not SaaS services.
- Documentation examples that mention services the project does not actually use.
