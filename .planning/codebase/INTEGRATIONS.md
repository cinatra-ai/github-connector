# External Integrations

**Analysis Date:** 2026-06-09

## APIs & External Services

**GitHub API:**
- GitHub REST API - repository listing, OAuth authentication, reading and writing repository content (SKILL.md files and related)
  - SDK/Client: Octokit (referenced in `src/settings-page.tsx` inline docs; actual client lives in host's `@/lib/github-api`)
  - Auth: GitHub OAuth App credentials (Client ID / Client Secret) stored via `saveGitHubOAuthSettings` from `@/lib/github-api`
  - Scopes: repo read/write, profile, email access (shown to user in `src/settings-page.tsx` via `settings.scopes`)

**Nango (OAuth proxy and connection manager):**
- Nango - manages the GitHub OAuth connection on behalf of users; stores and refreshes tokens
  - SDK/Client: `@cinatra-ai/sdk-ui/nango` — `NangoManagedApiCard`, `NangoUserConnectButton` components (`src/settings-page.tsx`)
  - Auth: Nango frontend config injected via host context `ctx.nango.getFrontendConfig()`
  - Connection key: `"github"` (connector key passed to Nango components)
  - Host port declared: `requestedHostPorts: ["nango"]` in `package.json` cinatra manifest
  - Status check: `ctx.nango.getStatus()` — returns `connected` / `not_connected`
  - Connection retrieval: `ctx.nango.getPrimarySavedConnection("github")`

## Data Storage

**Databases:**
- Not applicable — this connector package contains no direct database access. Persistence is handled by the host via `@/lib/github-api` functions (`saveGitHubOAuthSettings`, `saveGitHubRepositorySelection`, `getGitHubOAuthSettings`, `getGitHubAPIStatus`, `listGitHubRepositories`)

**File Storage:**
- Local filesystem — when a repository is selected and saved, the host clones the GitHub repository into a local data folder (noted in UI success message: "cloned into the local data folder" in `src/settings-page.tsx`)

**Caching:**
- Not detected in this package

## Authentication & Identity

**Auth Provider:**
- GitHub OAuth App — custom OAuth credentials (Client ID + Client Secret) configured by the platform admin
  - Implementation: credentials saved via server action `saveGitHubConnectionAction` in `src/actions.ts`; OAuth flow delegated to Nango
- Cinatra platform authorization — all server actions gated by `requireExtensionAction("@cinatra-ai/github-connector", "manage")` from `@cinatra-ai/sdk-extensions` (`src/actions.ts`)
  - Roles allowed: `org_owner`, `org_admin`, `platform_admin` (enforced by SDK, fail-closed)

## Monitoring & Observability

**Error Tracking:**
- Not detected

**Logs:**
- No explicit logging in this package; errors are surfaced to the UI via `searchParams.error` query param pattern in `src/settings-page.tsx`

## CI/CD & Deployment

**Hosting:**
- Deployed as a connector extension within the Cinatra AI platform host (Next.js application)
- Not independently deployable

**CI Pipeline:**
- `.github/workflows/` directory present — workflow files not read (contents not inspected)

## Environment Configuration

**Required env vars:**
- None managed directly by this package; env configuration (GitHub OAuth credentials) is stored and retrieved via the host's `@/lib/github-api` layer

**Secrets location:**
- GitHub OAuth Client ID and Client Secret are entered via the settings form and persisted by the host platform; not stored in this package's files

## Webhooks & Callbacks

**Incoming:**
- GitHub OAuth callback — redirect URI is displayed to the user in `src/settings-page.tsx` as `settings.redirectUri`; the actual callback handler lives in the host application, not this package

**Outgoing:**
- Not applicable — reads/writes go through the Octokit client in the host's `@/lib/github-api` layer

---

*Integration audit: 2026-06-09*
