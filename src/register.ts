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

import type { ExtensionHostContext } from "@cinatra-ai/sdk-extensions";
import { registerGitHubConnector, type GitHubConnectorDeps } from "./deps";

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
  // never outlive its digest.
  registerGitHubConnector(buildHostBoundDeps(ctx));
}
