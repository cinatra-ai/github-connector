# Codebase Structure

**Analysis Date:** 2026-06-09

## Directory Layout

```
github-connector/
├── src/
│   ├── index.ts                  # Intentionally empty barrel export
│   ├── setup-page.tsx            # Dispatch-route default export (host entry point)
│   ├── settings-page.tsx         # GitHubSettingsPage async RSC (main UI)
│   ├── actions.ts                # "use server" form actions with auth gating
│   ├── components/
│   │   └── ui/
│   │       ├── button.tsx        # CVA-based Button primitive
│   │       ├── input.tsx         # Styled Input primitive
│   │       └── label.tsx         # Radix Label wrapper
│   └── lib/
│       └── utils.ts              # cn(), slugify(), and other shared helpers
├── .github/
│   └── workflows/
│       ├── ci.yml                # Build + typecheck + pack dry-run CI
│       └── release.yml           # Release workflow
├── .planning/
│   └── codebase/                 # GSD codebase map documents
├── .npmrc                        # npm registry config
├── package.json                  # Package manifest + cinatra connector metadata
├── tsconfig.json                 # Standalone strict TypeScript config (no monorepo extends)
├── LICENSE                       # Apache-2.0
└── README.md                     # User-facing connector description
```

## Directory Purposes

**`src/`:**
- Purpose: All TypeScript/TSX source for the connector package
- Contains: Entry points, UI pages, server actions, components, utilities
- Key files: `src/setup-page.tsx`, `src/settings-page.tsx`, `src/actions.ts`

**`src/components/ui/`:**
- Purpose: Locally-owned styled primitive components (Button, Input, Label)
- Contains: CVA/Radix-based components with Tailwind class variants
- Key files: `src/components/ui/button.tsx`, `src/components/ui/input.tsx`, `src/components/ui/label.tsx`

**`src/lib/`:**
- Purpose: Shared utility functions used across components
- Contains: `cn()` class merger, `slugify`, format helpers, array/comparison helpers
- Key files: `src/lib/utils.ts`

**`.github/workflows/`:**
- Purpose: CI/CD pipeline definitions
- Contains: `ci.yml` (build gate), `release.yml` (publish)
- Key files: `.github/workflows/ci.yml`

**`.planning/codebase/`:**
- Purpose: GSD codebase map documents for planning and execution guidance
- Contains: ARCHITECTURE.md, STRUCTURE.md (this file)
- Generated: Yes (by GSD mapper)
- Committed: Yes

## Key File Locations

**Entry Points:**
- `src/setup-page.tsx`: Default export — host extension dispatch route entry; adapts host props to `GitHubSettingsPage`
- `src/index.ts`: Barrel export (intentionally empty; host uses subpath aliases directly)

**Configuration:**
- `package.json`: Package identity, peer dependencies, and `cinatra` connector manifest (`kind`, `displayName`, `requestedHostPorts`)
- `tsconfig.json`: Standalone TypeScript config — strict mode, ESNext modules, `bundler` resolution, outputs to `dist/`
- `.npmrc`: npm registry configuration

**Core Logic:**
- `src/settings-page.tsx`: Main async RSC — data fetching, Nango ctx consumption, full settings UI render
- `src/actions.ts`: All server-side mutations — authorization-gated form handlers for OAuth settings and repo selection

**UI Primitives:**
- `src/components/ui/button.tsx`: Button with variant/size system via CVA
- `src/components/ui/input.tsx`: Input with Tailwind styling
- `src/components/ui/label.tsx`: Label wrapping Radix `Label.Root`

**Utilities:**
- `src/lib/utils.ts`: `cn()`, `slugify()`, `formatCurrencyMillions()`, `firstName()`, `quarterLabel()`, `asArray()`, `compareValues()`, `getPageNumbers()`

**Testing:**
- Not applicable — this is a source mirror. Tests run in the cinatra monorepo, not standalone. No test files are present in this repo.

## Naming Conventions

**Files:**
- React components: `kebab-case.tsx` (e.g., `setup-page.tsx`, `settings-page.tsx`, `button.tsx`)
- Non-component TypeScript: `kebab-case.ts` (e.g., `actions.ts`, `utils.ts`, `index.ts`)

**Directories:**
- lowercase kebab-case: `components/`, `ui/`, `lib/`

**Exports:**
- React components: PascalCase named exports (`GitHubSettingsPage`, `Button`, `Input`, `Label`)
- Server actions: camelCase named exports (`saveGitHubConnectionAction`, `saveGitHubRepositorySelectionAction`)
- Utilities: camelCase named exports (`cn`, `slugify`, `formatCurrencyMillions`)

**CVA variants:**
- Variant keys: camelCase (`variant`, `size`)
- Variant values: lowercase (`default`, `outline`, `destructive`, `icon-xs`)

## Where to Add New Code

**New server action (mutation):**
- Implementation: `src/actions.ts` — add a new `export async function` with `"use server"` context, always with `requireExtensionAction("@cinatra-ai/github-connector", "manage")` as the first statement, Zod validation second
- The file already has the `"use server"` directive at the top; all exports in the file are server actions

**New UI section in the settings page:**
- Implementation: `src/settings-page.tsx` — add to the `GitHubSettingsPage` return JSX; fetch any additional data in the existing `Promise.all` or separate awaits at the top of the function

**New UI primitive component:**
- Implementation: `src/components/ui/[component-name].tsx` — follow the existing pattern (import `cn` from `../../lib/utils`, use CVA or Radix primitives, export as named PascalCase function)

**New shared utility:**
- Implementation: `src/lib/utils.ts` — add as a named export function

**New subpath export (for host consumption):**
- Update `package.json` exports field if the host needs to import a new entry point directly (e.g., `@cinatra-ai/github-connector/new-page`)

## Special Directories

**`dist/`:**
- Purpose: TypeScript compiler output (`tsc` with `outDir: dist`)
- Generated: Yes
- Committed: No (gitignored by convention; not present in repo)

**`.planning/`:**
- Purpose: GSD planning documents
- Generated: Yes (by GSD commands)
- Committed: Yes

---

*Structure analysis: 2026-06-09*
