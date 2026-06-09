# Coding Conventions

**Analysis Date:** 2026-06-09

## Naming Patterns

**Files:**
- React page/component files: PascalCase with `.tsx` extension — e.g., `src/settings-page.tsx`, `src/setup-page.tsx`
- UI primitive components: kebab-case filenames — e.g., `src/components/ui/button.tsx`, `src/components/ui/input.tsx`, `src/components/ui/label.tsx`
- Utility modules: kebab-case — e.g., `src/lib/utils.ts`
- Server action files: plain noun — `src/actions.ts`

**Functions:**
- Exported React components: PascalCase — e.g., `GitHubSettingsPage`, `Button`, `Input`, `Label`
- Exported server actions: camelCase with `Action` suffix — e.g., `saveGitHubConnectionAction`, `saveGitHubRepositorySelectionAction`
- Utility helpers: camelCase — e.g., `cn`, `slugify`, `formatCurrencyMillions`, `firstName`, `asArray`
- Local helpers: camelCase — e.g., `pickSearchParam`

**Variables:**
- camelCase throughout — e.g., `nangoFrontendConfig`, `connectionServiceReady`, `savedConnection`

**Types:**
- PascalCase with `Props` suffix for component prop types — e.g., `GitHubSettingsPageProps`, `ConnectorSetupPageProps`
- PascalCase for schemas named after their domain object — e.g., `githubConnectorSchema`, `githubRepoSelectionSchema` (lowercase for `const` schema instances)

**Schemas:**
- Zod schemas: camelCase with `Schema` suffix — e.g., `githubConnectorSchema`, `githubRepoSelectionSchema`

## Code Style

**Formatting:**
- No dedicated formatter config file detected (no `.prettierrc`, `biome.json`, or `eslint.config.*` in repo root)
- Indentation: 2 spaces (consistent across all source files)
- Semicolons: not used on import/export lines; used at statement ends in utility functions
- Trailing commas: used in multi-line object/array literals

**Linting:**
- No ESLint or Biome config detected in this extracted repo; linting is enforced at the monorepo host level

**TypeScript:**
- `strict: true` in `tsconfig.json` but `noImplicitAny: false`
- `verbatimModuleSyntax: true` — use `import type` for type-only imports
- `isolatedModules: true`
- Target: ES2023, module: ESNext, moduleResolution: bundler

## Import Organization

**Order observed:**
1. Framework/runtime imports (`react`, `next/link`, `next/navigation`)
2. External package imports (`zod`, `class-variance-authority`, `radix-ui`)
3. Internal SDK peer imports (`@cinatra-ai/sdk-extensions`, `@cinatra-ai/sdk-ui`)
4. Local component imports (`./components/ui/button`)
5. Local lib imports (`@/lib/github-api`, `../../lib/utils`)

**Path Aliases:**
- `@/lib/*` — maps to host's internal `lib/` (acknowledged as a tolerated `hostInternal` edge in comments; the connector imports `@/lib/github-api` which resolves in the monorepo host)

## Error Handling

**Patterns:**
- Server actions use `await requireExtensionAction(...)` as a fail-closed authorization gate — called as the FIRST executable statement before any logic
- Zod `.parse()` used for form data validation — throws on invalid input (no manual try/catch shown; relies on Next.js server action error boundary)
- Optional chaining for nullable SDK context ports: `ctx.nango.getFrontendConfig?.()` with `?? {}` fallback
- Async data fetching in JSX: `.catch(() => [])` to degrade gracefully for non-critical data — e.g., `listGitHubRepositories().catch(() => [])`
- No explicit `try/catch` in component body; errors propagate to Next.js error boundaries

## Logging

**Framework:** Not applicable — this is a UI connector package (no server logging)

**Patterns:**
- No logging calls detected in source files

## Comments

**When to Comment:**
- Block comments at top of files explain context, SDK decoupling rationale, and migration notes — e.g., the header in `src/actions.ts` explaining authorization gate addition
- Inline comments explain non-obvious design decisions: `"use server"` directive placement, nango port access patterns, optional chaining degradation intent

**JSDoc/TSDoc:**
- Not used; inline block comments preferred for architectural explanation

## Function Design

**Size:** Small, focused functions — utilities in `src/lib/utils.ts` are typically 3–12 lines each

**Parameters:** Destructured from a single props object for React components; named parameters for utilities

**Return Values:**
- Utilities return primitives or arrays; never throw silently
- Server actions: `void` (redirect via `next/navigation`)
- React components: JSX (`React.ReactNode`)

## Module Design

**Exports:**
- Named exports used exclusively — no default exports for components (`export function GitHubSettingsPage`, `export { Button, buttonVariants }`)
- Exception: `src/setup-page.tsx` uses a default export (`export default async function GitHubConnectorSetupPage`) as the dispatch-route entry point
- `src/index.ts` is intentionally empty (`export {}`) — consumers use subpath imports directly

**Barrel Files:**
- `src/index.ts` is a minimal barrel that exports nothing by design; the comment explicitly directs consumers to use subpath aliases (e.g., `@cinatra-ai/github-connector/settings-page`)

## React Patterns

**Components:**
- Function components using `function` keyword (not arrow functions) — consistent across `Button`, `Input`, `Label`, `GitHubSettingsPage`
- `React.ComponentProps<"element">` used for forwarding native HTML props — e.g., `Input`, `Button`
- `data-slot` attributes on all UI primitives for host-side CSS targeting — e.g., `data-slot="button"`, `data-slot="input"`, `data-slot="label"`

**Styling:**
- Tailwind CSS utility classes throughout
- `cn()` helper (`clsx` + `tailwind-merge`) used for conditional/merged class composition — defined in `src/lib/utils.ts`
- `class-variance-authority` (`cva`) used for variant-based component styling — see `src/components/ui/button.tsx`

**Server vs Client:**
- `"use server"` directive in `src/actions.ts`
- `"use client"` directive in `src/components/ui/label.tsx`
- Pages (`src/settings-page.tsx`, `src/setup-page.tsx`) are async Server Components (no directive = server by default in Next.js App Router)

---

*Convention analysis: 2026-06-09*
