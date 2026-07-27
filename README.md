# AfriPoll v2

Election Research and Intelligence Platform. Next.js (App Router) + TypeScript + Supabase + Tailwind.

See ARCHITECTURE.md for the two-workspace model and all core decisions.

## Run locally

    npm install
    npm run dev

Open http://localhost:3000 and sign in with your AfriPoll email and password.

Supabase URL and publishable key are baked in with safe defaults; to override, copy
`.env.example` to `.env.local` and edit.

## Build

    npm run build
    npm start

## Deploy to Vercel

1. Push this folder to a GitHub repo.
2. Import the repo in Vercel. Framework preset: Next.js. Root Directory: the repo root.
3. Deploy. No environment variables are required (defaults are baked in); set
   NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY if you want to override.

## What is built (Phase 1)

- Application shell: auth, responsive dark sidebar, top strip, workspace context, routing.
- Organisation workspace:
  - Organisation Home (complete): executive KPIs, research-modules overview, needs-attention
    alerts, live activity, quick actions.
  - Executive Dashboard, Cross-Module Analytics, Reports, Users & Teams, Settings, Audit Logs
    exist as routed stubs.
- Module routes (all six) exist and route correctly:
  /modules and /modules/{market-research,election-observation,pre-election,post-election,
  constituency-scorecards,mp-performance} plus each module's Home, Studies, Dashboard, Builder,
  Collect, Reports, Team, Settings. These are Phase 2 stubs.

## Note on the Next.js version

package.json pins next@14.2.33. npm may warn about a security advisory affecting the 14.2.x
line; bump to the latest patched 14.x (or 15.x) at your convenience with `npm i next@latest`.
The app was type-checked and production-built clean.
