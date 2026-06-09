# Technology Stack

**Analysis Date:** 2026-06-09

## Languages

**Primary:**
- TypeScript (strict mode, ES2023 target) - all source in `src/`
- TSX (React JSX) - UI components in `src/components/ui/`, `src/settings-page.tsx`, `src/setup-page.tsx`

## Runtime

**Environment:**
- Node.js (ESM module system, `"type": "module"` in `package.json`)

**Package Manager:**
- npm (`.npmrc` present with `auto-install-peers=false`)
- Lockfile: not detected in repo root (likely gitignored or managed by host monorepo)

## Frameworks

**Core:**
- React 19 (peer dependency `^19.2.3`) - UI rendering for connector settings pages
- Next.js (implicit — `"use server"` directives in `src/actions.ts`, `next/navigation` import, `Link` from `next/link`) - server actions and routing

**Build/Dev:**
- TypeScript compiler (`tsc`) targeting `dist/` — config in `tsconfig.json`
- Module resolution: `bundler` mode (host app bundles this package)
- Source maps and declaration maps enabled

## Key Dependencies

**Critical:**
- `class-variance-authority ^0.7.1` - variant-based component styling (`src/components/ui/button.tsx`, `src/components/ui/input.tsx`, `src/components/ui/label.tsx`)
- `clsx ^2.1.1` - conditional class name composition (`src/lib/utils.ts`)
- `tailwind-merge ^3.5.0` - Tailwind CSS class deduplication (`src/lib/utils.ts`)
- `radix-ui ^1.4.3` - accessible primitive components (used by UI components)

**Peer (required by host):**
- `react ^19.2.3` and `react-dom ^19.2.3` - provided by the host Next.js app
- `@cinatra-ai/sdk-extensions` (optional peer) - provides `requireExtensionAction`, `ExtensionHostContext` type (`src/actions.ts`, `src/settings-page.tsx`)
- `@cinatra-ai/sdk-ui` (optional peer) - provides `ConnectorSettingsDialog`, `NangoManagedApiCard`, `NangoUserConnectButton` (`src/settings-page.tsx`)

**Runtime (host-provided, not bundled):**
- `zod` - schema validation in `src/actions.ts` (imported directly; must be available in host)
- `next` - server actions runtime

## Configuration

**TypeScript:**
- `tsconfig.json` — standalone strict config, not extending a monorepo base
- `strict: true`, `noImplicitAny: false`, `isolatedModules: true`, `verbatimModuleSyntax: true`
- Output: `dist/`, rootDir: `src/`

**Package metadata:**
- `package.json` contains a `cinatra` manifest block declaring this as a `connector` kind with `apiVersion: cinatra.ai/v1`, `displayName: GitHub`, and `requestedHostPorts: ["nango"]`

**npm:**
- `.npmrc` — `auto-install-peers=false`

**Environment:**
- `.env` files: not detected

## Platform Requirements

**Development:**
- Host Next.js application must provide React 19, `@cinatra-ai/sdk-extensions`, `@cinatra-ai/sdk-ui`, and a Nango integration
- Host must expose `@/lib/github-api` module (not shipped in this package — consumed via host path alias)

**Production:**
- Deployed as a Next.js connector extension within the Cinatra platform host
- Bundled by the host application; this package is not independently deployable

---

*Stack analysis: 2026-06-09*
