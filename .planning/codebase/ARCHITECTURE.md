<!-- refreshed: 2026-06-09 -->
# Architecture

**Analysis Date:** 2026-06-09

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                    Host / Next.js App                        │
│  (cinatra monorepo mounts this connector as an extension)    │
└──────────────────────┬──────────────────────────────────────┘
                       │ injects ExtensionHostContext (ctx)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Dispatch Entry Point                            │
│  `src/setup-page.tsx`  (default export)                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│               Settings UI Layer                              │
│  `src/settings-page.tsx`  GitHubSettingsPage (async RSC)     │
│                                                              │
│  Uses host SDK components:                                   │
│    @cinatra-ai/sdk-ui  ConnectorSettingsDialog               │
│    @cinatra-ai/sdk-ui/nango  NangoManagedApiCard             │
│    @cinatra-ai/sdk-ui/nango  NangoUserConnectButton          │
│                                                              │
│  Uses local primitive components:                            │
│    `src/components/ui/button.tsx`                            │
│    `src/components/ui/input.tsx`                             │
│    `src/components/ui/label.tsx`                             │
└──────────┬──────────────────────────┬───────────────────────┘
           │ server actions            │ host API reads
           ▼                          ▼
┌─────────────────┐       ┌───────────────────────────────────┐
│  Server Actions  │       │  @/lib/github-api  (host-internal) │
│  `src/actions.ts`│       │  getGitHubOAuthSettings()          │
│  "use server"    │       │  getGitHubAPIStatus()              │
│  gated by        │       │  listGitHubRepositories()          │
│  requireExtension│       │  saveGitHubOAuthSettings()         │
│  Action(…manage) │       │  saveGitHubRepositorySelection()   │
└────────┬─────────┘       └───────────────────────────────────┘
         │                             ↑ hostInternal edge (tolerated)
         │ calls                       │ lives in the monorepo, not this repo
         └─────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| GitHubConnectorSetupPage | Dispatch-route default export; adapts host route props to GitHubSettingsPage | `src/setup-page.tsx` |
| GitHubSettingsPage | Async RSC; fetches OAuth settings, API status, Nango ctx, repo list; renders full settings UI | `src/settings-page.tsx` |
| saveGitHubConnectionAction | Server action; validates+saves OAuth client ID/secret; requires `manage` permission | `src/actions.ts` |
| saveGitHubRepositorySelectionAction | Server action; validates+saves chosen repo; requires `manage` permission | `src/actions.ts` |
| Button | CVA-based primitive button with variant/size system | `src/components/ui/button.tsx` |
| Input | Styled native input wrapper | `src/components/ui/input.tsx` |
| Label | Radix-UI Label.Root wrapper | `src/components/ui/label.tsx` |
| cn / slugify / utils | Shared class-merge and string helpers | `src/lib/utils.ts` |

## Pattern Overview

**Overall:** Cinatra Extension / Source Mirror pattern — a standalone extracted package that is mounted by the cinatra monorepo host as an optional-peer extension. The connector declares `cinatra.kind = "connector"` in `package.json` and exposes React Server Components consumed by the host's dispatch routing layer.

**Key Characteristics:**
- All first-party `@cinatra-ai/*` packages are **optional peerDependencies** only — never direct deps. The monorepo provides them at runtime; this repo cannot be installed standalone.
- Authorization is enforced as the **first** statement in every server action via `requireExtensionAction("@cinatra-ai/github-connector", "manage")` from `@cinatra-ai/sdk-extensions`.
- Nango integration data (frontend config, connection status, saved connections) flows through the host-injected `ExtensionHostContext` (`ctx.nango.*`) — never via direct Nango imports.
- The host-internal `@/lib/github-api` edge is a **tolerated** dependency: OAuth settings writers and repo list readers live in the monorepo and are accessed via Next.js path aliases. Relocating them into this connector is deferred (Phase-B).

## Layers

**Dispatch / Entry Layer:**
- Purpose: Bridges the host's extension routing convention (packageId, slug, searchParams, ctx) to the settings page component
- Location: `src/setup-page.tsx`
- Contains: Single default-export async function
- Depends on: `src/settings-page.tsx`, `@cinatra-ai/sdk-extensions` types
- Used by: Cinatra monorepo extension dispatch router

**Settings UI Layer:**
- Purpose: Renders the full GitHub connector configuration UI — OAuth credentials, Nango connection card, repository selector
- Location: `src/settings-page.tsx`
- Contains: Async React Server Component, data-fetch orchestration, JSX render
- Depends on: `src/actions.ts`, `src/components/ui/*`, `@cinatra-ai/sdk-ui`, `@cinatra-ai/sdk-ui/nango`, `@cinatra-ai/sdk-extensions` (ExtensionHostContext type), `@/lib/github-api` (host-internal alias)
- Used by: `src/setup-page.tsx`

**Server Actions Layer:**
- Purpose: Handles form submissions for OAuth settings and repository selection with authorization gating and Zod validation
- Location: `src/actions.ts`
- Contains: Two `"use server"` async functions, two Zod schemas
- Depends on: `@cinatra-ai/sdk-extensions` (requireExtensionAction), `@/lib/github-api` (host-internal), `next/navigation` (redirect), `zod`
- Used by: `src/settings-page.tsx` (form actions)

**UI Primitives Layer:**
- Purpose: Locally-owned styled primitives (Button, Input, Label) using CVA + Tailwind + Radix
- Location: `src/components/ui/`
- Contains: `button.tsx`, `input.tsx`, `label.tsx`
- Depends on: `src/lib/utils.ts` (cn), `class-variance-authority`, `radix-ui`, `tailwind-merge`
- Used by: `src/settings-page.tsx`

**Utilities Layer:**
- Purpose: Shared helper functions for class merging and common data transformations
- Location: `src/lib/utils.ts`
- Contains: `cn`, `slugify`, `formatCurrencyMillions`, `firstName`, `quarterLabel`, `asArray`, `compareValues`, `getPageNumbers`
- Depends on: `clsx`, `tailwind-merge`
- Used by: `src/components/ui/*`

## Data Flow

### OAuth Settings Save

1. User fills Client ID / Client Secret form in `src/settings-page.tsx` (`<form action={saveGitHubConnectionAction}>`)
2. Next.js invokes `saveGitHubConnectionAction` in `src/actions.ts` (`"use server"`)
3. `requireExtensionAction("@cinatra-ai/github-connector", "manage")` enforces authorization — throws/redirects on failure
4. Zod `githubConnectorSchema` validates the FormData fields
5. `saveGitHubOAuthSettings()` from `@/lib/github-api` persists credentials via the monorepo host
6. `redirect("/configuration/llm")` returns user to configuration flow

### Repository Selection Save

1. User selects repository from dropdown in `src/settings-page.tsx` (`<form action={saveGitHubRepositorySelectionAction}>`)
2. Next.js invokes `saveGitHubRepositorySelectionAction` in `src/actions.ts`
3. Authorization checked via `requireExtensionAction`
4. Zod `githubRepoSelectionSchema` validates; supports both `repositoryFullName` and `repository` field names
5. `saveGitHubRepositorySelection()` from `@/lib/github-api` persists selection
6. `redirect("/configuration/llm")` completes the flow

### Settings Page Load

1. Host router calls `GitHubConnectorSetupPage` default export in `src/setup-page.tsx` with `{ searchParams, ctx }`
2. Delegates immediately to `GitHubSettingsPage` in `src/settings-page.tsx`
3. `Promise.all` fetches `getGitHubOAuthSettings()`, `getGitHubAPIStatus()`, resolved searchParams in parallel
4. `ctx.nango.getFrontendConfig?.()`, `ctx.nango.getStatus?.()`, `ctx.nango.getPrimarySavedConnection?.("github")` read Nango state from host context (null-safe optional chaining)
5. If a saved Nango connection exists, `listGitHubRepositories()` is called; errors caught and defaulted to `[]`
6. Component renders `ConnectorSettingsDialog` (from `@cinatra-ai/sdk-ui`) with all data

**State Management:**
- No client-side state. All state is server-rendered per request. Search params carry transient UI state (`?saved=1`, `?repoSaved=1`, `?error=...`). Persistent state lives in the monorepo host via `@/lib/github-api`.

## Key Abstractions

**ExtensionHostContext (`ctx`):**
- Purpose: Host-injected context carrying optional Nango port accessors. Decouples the connector from direct Nango imports.
- Examples: `src/setup-page.tsx`, `src/settings-page.tsx`
- Pattern: Passed as a prop; accessed with optional chaining (`ctx.nango.getFrontendConfig?.()`) to gracefully degrade against older host minor versions.

**requireExtensionAction:**
- Purpose: Authorization gate for server actions. Fail-closed; enforces `manage` permission (org_owner / org_admin / platform_admin).
- Examples: `src/actions.ts` lines 26, 43
- Pattern: Always the **first** awaited statement in a server action body.

**Cinatra connector manifest (package.json `cinatra` field):**
- Purpose: Declares this package as a `connector` kind to the Cinatra extension system. Specifies `requestedHostPorts: ["nango"]`.
- Examples: `package.json`
- Pattern: Static JSON; consumed by the monorepo extension registry and CI kind-gate.

## Entry Points

**Dispatch Route Entry:**
- Location: `src/setup-page.tsx`
- Triggers: Cinatra monorepo extension dispatch router mounting the connector's setup/settings route
- Responsibilities: Receives host routing props (`packageId`, `slug`, `searchParams`, `ctx`); delegates to `GitHubSettingsPage`

**Barrel (intentionally empty):**
- Location: `src/index.ts`
- Triggers: Host importers using subpath aliases directly (e.g., `@cinatra-ai/github-connector/settings-page`)
- Responsibilities: Exports nothing; kept light by design

## Architectural Constraints

- **Threading:** Next.js RSC single-threaded async rendering; no worker threads.
- **Global state:** None — no module-level singletons. All state flows through function arguments and the host context.
- **Circular imports:** None detected.
- **Source mirror constraint:** This repo cannot be installed, typechecked, or tested standalone. All `@cinatra-ai/*` deps are optional peers resolved only by the monorepo host. CI explicitly skips install/typecheck/test for source mirrors (see `.github/workflows/ci.yml`).
- **Host-internal edge:** `@/lib/github-api` is a Next.js path alias that resolves inside the monorepo, not this package. It is a known, tolerated architectural coupling. Phase-B work would move those writers into this connector.

## Anti-Patterns

### Importing @cinatra-ai/* as direct dependencies

**What happens:** Adding `@cinatra-ai/sdk-extensions` or `@cinatra-ai/sdk-ui` to `dependencies` or `devDependencies` instead of `peerDependencies`.
**Why it's wrong:** These packages are never published to a registry; they live only in the cinatra monorepo. Direct deps break CI (`ci.yml` exits with code 2 on leaked first-party deps) and hide real dependency regressions.
**Do this instead:** Declare them as optional peerDependencies with `peerDependenciesMeta[pkg].optional = true` as all current `@cinatra-ai/*` entries in `package.json` do.

### Skipping requireExtensionAction in server actions

**What happens:** Adding a new `"use server"` function without calling `requireExtensionAction` as the first statement.
**Why it's wrong:** The previous connector implementation (in the central hub) had no authorization gate at all. This connector explicitly adds the gate. Omitting it re-introduces the privilege-escalation vulnerability.
**Do this instead:** Always await `requireExtensionAction("@cinatra-ai/github-connector", "manage")` as the first line of any new server action in `src/actions.ts`.

### Accessing Nango directly instead of via ctx

**What happens:** Importing from a nango-connector extension directly rather than using `ctx.nango.*` accessors.
**Why it's wrong:** Breaks the SDK-only decouple. The Nango port is injected by the host; the connector must not carry a direct dependency on Nango internals.
**Do this instead:** Use `ctx.nango.getFrontendConfig?.()`, `ctx.nango.getStatus?.()`, etc. with optional chaining as done in `src/settings-page.tsx`.

## Error Handling

**Strategy:** Fail-closed on authorization (throws / redirects before any data access). Data-fetch errors are caught at the call site and defaulted to safe values.

**Patterns:**
- `requireExtensionAction` throws / redirects before any mutation if the caller lacks `manage` permission
- `listGitHubRepositories().catch(() => [])` in `src/settings-page.tsx` — gracefully returns empty list on error rather than crashing the page
- `ctx.nango.*?.()` optional chaining + `?? {}` / `?? null` — null-safe defaults for older host versions
- Search param `?error=...` pattern for surfacing auth/redirect errors back to the UI

## Cross-Cutting Concerns

**Logging:** Not detected — no logger calls in this package. Host handles logging.
**Validation:** Zod schemas in `src/actions.ts` for all FormData inputs before persistence.
**Authentication:** `requireExtensionAction` from `@cinatra-ai/sdk-extensions` — enforced at server action boundary, not in UI.

---

*Architecture analysis: 2026-06-09*
