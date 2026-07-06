// Host DI singleton for the GitHub connector's runtime deps.
//
// The connector carries NO non-SDK `@cinatra-ai/*` code dependency and NO `@/`
// host-internal import (cinatra#172 Stage H4): every host-shared surface it
// needs is delivered here, bound at activation by `register(ctx)` adapting the
// per-concern host service published in the capability registry
// (`@cinatra-ai/host:github-connection`).
// Since cinatra#975 Wave 3 (epic #978) the connector OWNS the GitHub
// connection client (`./lib/github-connection-client` — the relocated body of
// core's `src/lib/github-api.ts`) and registers it under the SAME capability
// id from `register(ctx)`; this deps slot keeps resolving the capability, so
// its members are provider-agnostic across the cutover window.
// Surfaces:
//   - connection status  — aggregate status for the settings-page badge +
//                          Nango card.
//   - OAuth app settings — Nango-resolved client credentials + the stored
//                          repository selection. The host-side
//                          personal-access-token fallback is NOT published
//                          through the service (it stays host-only).
//   - repository list    — repositories reachable through the live
//                          connection (GitHub REST runs host-side).
//   - saveOAuthSettings  — WRITER (persists credentials + ensures the Nango
//                          integration); only ever called behind the
//                          settings page's manage-gated "use server" action.
//   - saveRepositorySelection — WRITER (persists the repository binding
//                          after host-side validation against the live
//                          connection); same manage-gated action posture.
//
// The deps slot is anchored on `globalThis` via a namespaced+versioned Symbol
// so the boot-time registration and the runtime callers — which live in
// SEPARATELY-COMPILED Next.js bundles (the settings page and its "use server"
// actions do NOT import the registrar) — resolve the SAME slot. A plain
// module-local binding would leave those bundles' instance unregistered →
// getGitHubDeps() would throw. (Same reason as the SDK action-guard + the
// crm/gmail/wordpress-mcp deps slots.)

/** Aggregate GitHub connection status (structural mirror of the host's
 * `GitHubConnectionStatus` — no SDK type import needed to compile against any
 * host this connector can meet during skew). */
export type GitHubConnectionStatusShape = {
  status: "connected" | "incomplete" | "not_connected";
  detail?: string;
  accountName?: string;
  accountEmail?: string;
  settingsConfigured: boolean;
  selectedRepositoryFullName?: string;
  selectedRepositoryUrl?: string;
};

/** OAuth app settings document as PUBLISHED by the host service (structural
 * mirror of the host's `GitHubOAuthSettings` MINUS the host-only
 * personal-access-token fallback, which the service strips). */
export type GitHubOAuthSettingsShape = {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  scopes: string[];
  selectedRepositoryFullName?: string;
  selectedRepositoryUrl?: string;
};

/** Repository option reachable through the live connection (structural
 * mirror of the host's `GitHubRepositoryOption`). */
export type GitHubRepositoryOptionShape = {
  id: number;
  owner: string;
  repo: string;
  fullName: string;
  url: string;
  visibility: "private" | "public";
  permissions: {
    admin: boolean;
    maintain: boolean;
    push: boolean;
    triage: boolean;
    pull: boolean;
  };
};

export interface GitHubConnectorDeps {
  /** Aggregate connection status (settings-page badge + Nango card). */
  getStatus: () => Promise<GitHubConnectionStatusShape>;
  /** OAuth app settings document (PAT fallback stays host-side). */
  getOAuthSettings: () => Promise<GitHubOAuthSettingsShape>;
  /** Repositories reachable through the live connection (sorted by name). */
  listRepositories: () => Promise<GitHubRepositoryOptionShape[]>;
  /** WRITER — persist OAuth app credentials + ensure the Nango integration.
   * Only ever called behind the settings page's manage-gated "use server"
   * action — the same `requireExtensionAction` posture as the static import
   * it replaces. */
  saveOAuthSettings: (input: { clientId?: string; clientSecret?: string }) => Promise<unknown>;
  /** WRITER — persist the repository selection (host-side validated; throws
   * on an unknown repository). Manage-gated at the calling action, as above. */
  saveRepositorySelection: (input: { repositoryFullName?: string }) => Promise<unknown>;
}

const GITHUB_DEPS_KEY = Symbol.for("@cinatra-ai/github-connector:host-deps/v1");
type DepsHolder = { [k: symbol]: GitHubConnectorDeps | null | undefined };
const _holder = globalThis as unknown as DepsHolder;

export function registerGitHubConnector(deps: GitHubConnectorDeps): void {
  _holder[GITHUB_DEPS_KEY] = deps;
}

export function getGitHubDeps(): GitHubConnectorDeps {
  const deps = _holder[GITHUB_DEPS_KEY];
  if (!deps) {
    throw new Error(
      "@cinatra-ai/github-connector: host runtime deps not registered. " +
        "Call registerGitHubConnector(deps) at boot.",
    );
  }
  return deps;
}

/** @internal test-only. */
export function _resetGitHubDepsForTests(): void {
  _holder[GITHUB_DEPS_KEY] = null;
}
