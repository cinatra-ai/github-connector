// The github connector's `register(ctx)` server entry.
//
// hostInternal pinned-empty sweep (cinatra#172 Stage H4): the settings page
// and its "use server" actions stop importing `@/lib/github-api` — this entry
// binds the connector's host deps AT ACTIVATION by adapting the per-concern
// host service published in the capability registry
// (`@cinatra-ai/host:github-connection`). Every adapter member resolves its
// host service LAZILY at call time, so activation order against the host's
// boot imports never matters.
//
// Registration-only (no I/O) — safe under required-extension-activation's
// prod-boot arming, and probe-safe (the hot-update probe's `resolveProviders`
// reads stay live, so a probe-bound deps slot resolves identically to an
// activation-bound one). Imports stay LEAF-only (`./deps`): the package index
// re-exports React components that must stay OUT of the serverEntry graph.
//
// SDK imports here are TYPE-ONLY (host-peer value-import ban): the host
// service arrives as DATA through `ctx.capabilities`; the capability id is an
// inlined string literal; the service shape is a local structural type so the
// connector compiles against ANY host SDK it can meet during skew.
//
// cinatra#975 Wave 3 (epic #978) — vendor-client inversion: this connector now
// OWNS the GitHub connection client (`./lib/github-connection-client`, the
// relocated body of core's `src/lib/github-api.ts`) and REGISTERS it below
// under the SAME existing `@cinatra-ai/host:github-connection` capability id.
// The publish direction flips: the paired core-eviction PR (after every Wave-3
// connector PR merges) drops the host's `register(svc.githubConnection, …)`
// block and re-points core's skills-configuration consumers at the
// connector-registered provider. During the cutover window BOTH providers are
// registered (the registry keys providers per package — no clobber) and both
// are behavior-equivalent, so resolution order is immaterial.

import type { ExtensionHostContext } from "@cinatra-ai/sdk-extensions";
import { registerGitHubConnector, type GitHubConnectorDeps } from "./deps";
import { createGitHubConnectionClient } from "./lib/github-connection-client";

const PACKAGE_NAME = "@cinatra-ai/github-connector";

// Local STRUCTURAL shape of the per-concern host service this connector
// adapts into its deps slot.
type HostGitHubConnectionShape = {
  getStatus: GitHubConnectorDeps["getStatus"];
  getOAuthSettings: GitHubConnectorDeps["getOAuthSettings"];
  listRepositories: GitHubConnectorDeps["listRepositories"];
  saveOAuthSettings: GitHubConnectorDeps["saveOAuthSettings"];
  saveRepositorySelection: GitHubConnectorDeps["saveRepositorySelection"];
};

/** Lazy per-concern host-service resolution (fail-loud on a missing service —
 * the host boot wiring publishes it before any connector call runs). */
function hostService<T>(ctx: ExtensionHostContext, capability: string): T {
  const provider = ctx.capabilities.resolveProviders(capability)[0];
  if (!provider) {
    throw new Error(
      `${PACKAGE_NAME}: host service "${capability}" is not registered — ` +
        `the host boot wiring (register-host-connector-services) must run before connector calls.`,
    );
  }
  return provider.impl as T;
}

/** Build the host-bound deps from the per-concern host service. Every member
 * resolves LAZILY at call time — constructing this object does no I/O and no
 * resolution (probe-safe). */
function buildHostBoundDeps(ctx: ExtensionHostContext): GitHubConnectorDeps {
  const github = () =>
    hostService<HostGitHubConnectionShape>(ctx, "@cinatra-ai/host:github-connection");
  return {
    getStatus: () => github().getStatus(),
    getOAuthSettings: () => github().getOAuthSettings(),
    listRepositories: () => github().listRepositories(),
    // WRITERS — only ever reached through the settings page's manage-gated
    // "use server" actions (the host service's TRUST note documents the
    // shared in-process capability id; gating stays here, extension-side).
    saveOAuthSettings: (input) => github().saveOAuthSettings(input),
    saveRepositorySelection: (input) => github().saveRepositorySelection(input),
  };
}

export function register(ctx: ExtensionHostContext): void {
  // Bind the host deps slot. Always-bind: re-activation — incl. a hot-update
  // digest swap — re-binds fresh lazy resolvers, so a stale deps object can
  // never outlive its digest. The slot keeps resolving the CAPABILITY (not the
  // local client directly): during the Wave-3 cutover window that is the
  // host's provider, after the core eviction it is the connector's own
  // registration below — both behavior-equivalent.
  registerGitHubConnector(buildHostBoundDeps(ctx));

  // cinatra#975 Wave 3 — register the connector-owned GitHub connection client
  // as the `@cinatra-ai/host:github-connection` capability (the SAME existing
  // id — reused, not renamed; provider flip, no SDK contract change).
  // Building the client does no I/O and no capability resolution (probe-safe);
  // every member resolves `@cinatra-ai/host:connector-config` and the
  // connector-authored `nango-system` surface lazily at call time.
  //
  // Registered surface = the existing 5-member `HostGitHubConnectionService`
  // contract (getOAuthSettings STRIPS the stored personal-access-token —
  // the cinatra#172 H4 least-privilege posture, preserved verbatim) PLUS the
  // ADDITIVE structural members the post-eviction HOST call sites resolve
  // (the `HostExternalMcpRegistrySetupSurface` precedent — no SDK change):
  //   - getAccessToken — the actor-LESS legacy mint (packages/skills' push
  //     path without an actor; PAT fallback, import-era error strings).
  //   - getAccessTokenForAuthorizedConnection — the gate-first-then-call mint
  //     (the `HostInstanceConnectionGateService` contract's pinned ruling,
  //     cinatra#1077: the actor-gated resolver STAYS host-side; the host
  //     gates + audits FIRST, then calls this with the already-authorized
  //     connectionId; hard-fail, NEVER the PAT).
  //   - savePersonalAccessToken — the host skills-configuration fallback
  //     writer (the PAT keeps living in the same `github_oauth` row).
  // TRUST: one in-process capability id on the server-side registry — never
  // client-resolvable; the consumers are the same host code paths that could
  // already import `@/lib/github-api`, and this connector's own manage-gated
  // "use server" actions (gating stays extension-side, unchanged).
  const client = createGitHubConnectionClient(ctx);
  ctx.capabilities.registerProvider("@cinatra-ai/host:github-connection", {
    packageName: PACKAGE_NAME,
    impl: {
      getStatus: () => client.getStatus(),
      // The stored personal-access-token fallback is STRIPPED before
      // publication — it belongs to the host's skills-configuration fallback
      // path, not this settings surface (cinatra#172 H4, codex round-1
      // finding 2; posture preserved across the provider flip).
      getOAuthSettings: async () => {
        const { personalAccessToken: _hostOnlyPat, ...settings } = await client.getOAuthSettings();
        return settings;
      },
      listRepositories: () => client.listRepositories(),
      saveOAuthSettings: (input: { clientId?: string; clientSecret?: string }) =>
        client.saveOAuthSettings(input),
      saveRepositorySelection: (input: { repositoryFullName?: string }) =>
        client.saveRepositorySelection(input),
      // --- additive host-call-site members (see the TRUST note above) -------
      getAccessToken: (input?: { connectionId?: string }) => client.getAccessToken(input),
      getAccessTokenForAuthorizedConnection: (input: { connectionId: string }) =>
        client.getAccessTokenForAuthorizedConnection(input),
      savePersonalAccessToken: (pat: string | null) => client.savePersonalAccessToken(pat),
    },
  });
}
