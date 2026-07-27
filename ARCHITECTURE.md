# AfriPoll v2 — Architecture Decision Record

Status: Adopted
Date: 2026-07-27
Owner: Frank "Bright" Ijon

This document is the single source of truth for how AfriPoll v2 is structured. Every future
decision should follow this blueprint. If a change contradicts this record, the record is
updated first, with a note, before the code changes.

## 1. What AfriPoll is

AfriPoll is an Election Research and Intelligence Platform, not a single survey app. It is a
platform made up of specialised workspaces, each dedicated to a major election-related function.

## 2. The two-workspace model (core decision)

There are exactly two kinds of workspace, and one context switch between them.

### Workspace 1 — Organisation
The organisation-wide management hub, for leadership and administrators.
Pages: Home, Executive Dashboard, Cross-Module Analytics, Reports, Team, Settings, Audit Logs.
The Organisation workspace NEVER builds questionnaires and NEVER collects data. Its job is
management and oversight across all modules.

### Workspace 2 — Module (six of them)
Each research module is a self-contained mini-application with an identical navigation pattern.
Pages: Home, Studies, Dashboard, Builder, Collect, Reports, Team, Settings.
Entering a module swaps the sidebar to that module's navigation.

The six core modules are fixed:
- Market Research
- Election Observation
- Pre-Election Surveys
- Post-Election Surveys
- Constituency Scorecards
- MP Performance Assessment

(Custom, organisation-defined modules are deferred to a later phase. Not built now.)

## 3. Where Studies fit (core decision)

A Study is NOT a third workspace. A Study is the active context inside a module.

- A study belongs to exactly one module.
- Selecting a study changes the DATA shown in Dashboard, Builder, Collect and Reports.
- Selecting a study does NOT change the module navigation. The sidebar stays the same.

Hierarchy of context (not of navigation):
Organisation -> Module -> Study -> (Questionnaire, Responses, Analytics, Reports, Field Ops)

## 4. Routing (core decision)

One real routed Next.js application. No per-module HTML files.

```
/                                        Organisation Home
/organisation/dashboard                  Executive Dashboard
/organisation/analytics                  Cross-Module Analytics
/organisation/reports                    Organisation Reports
/organisation/team                       Users & Teams
/organisation/settings                   Settings
/organisation/audit                      Audit Logs

/modules                                 Module index (all six)
/modules/[module]                        Module Home
/modules/[module]/studies                Studies list (+ New Study)
/modules/[module]/dashboard              Dashboard (study-scoped)
/modules/[module]/builder                Builder (study-scoped)
/modules/[module]/collect                Collect (study-scoped)
/modules/[module]/reports                Reports (study-scoped)
/modules/[module]/team                   Team
/modules/[module]/settings               Settings
```

`[module]` slug is one of:
`market-research`, `election-observation`, `pre-election`, `post-election`,
`constituency-scorecards`, `mp-performance`.

Active study is held in workspace state (and persisted), read by the study-scoped pages via a
`?study=<id>` query param or the active-study context. Changing study updates the data, not the route's module segment.

## 5. Invariants (must always hold)

1. Organisation pages never contain Builder or Collect.
2. There are exactly six fixed core research modules.
3. A study belongs to exactly one module.
4. Module pages share one common navigation pattern.
5. Study selection changes context, never the module navigation.
6. Next.js with real routing is the application foundation.
7. Built for scale: millions of records, thousands of concurrent users, multiple organisations
   across countries. No query assumes a small dataset (paginate, index, filter server-side where
   it matters).

## 6. Technical stack

- Next.js (App Router) + TypeScript
- Supabase (PostgreSQL + Auth + Edge Functions) — schema unchanged from v1
- Tailwind CSS for styling, with the AfriPoll design tokens (below)
- Deployed on Vercel

Supabase project (unchanged from v1):
- URL: https://knagokkqdtuduqfqqoih.supabase.co
- Publishable key is safe to ship in the client.

## 7. Design system (carried from v1, locked)

- Display font: Poppins. Body font: Inter. Mono/data font: IBM Plex Mono.
- Brand blue: #0B4DA2. Action accent lime: #8DC63F. Ink: #0B2647.
- Light canvas (#F5F7FA), white surfaces, cards with a lime top-accent and circled icons.
- Sidebar is dark navy (#0B2647) with a lime active spine.
- British spelling throughout. No em dashes. ASCII-safe output.

## 8. Build sequence

- Phase 1 (current): Organisation workspace. Organisation Home complete; other org pages and all
  module routes exist as stubs that route correctly.
- Phase 2: MP Performance Assessment as the reference module, built end-to-end.
- Phase 3: Clone the reference pattern to the other five modules.
- Phase 4: Platform-wide capabilities (AI insights, GIS/maps, predictive analytics, collaboration).

## 9. Reference implementation principle

Every module is a self-contained workspace over a shared framework. Users learn the interface once;
moving between modules changes only the data and module-specific logic, never the interaction model.
MP Performance Assessment is the reference; the other five copy its pattern.
