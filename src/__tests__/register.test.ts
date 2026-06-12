// `register(ctx)` shape — the cinatra#172 Stage H4 serverEntry cutover: the
// connector binds its host deps slot itself (always-bind, lazy per-call
// host-service resolution over `@cinatra-ai/host:github-connection`).
// Leaf-graph pin: the entry imports ONLY ./deps. Slot-timing coverage
// (cinatra#172 finding 8): the slot is populated AT ACTIVATION — before the
// settings page / its "use server" actions resolve it — and an unbound slot
// fails LOUD naming the package and the registration step.

import { describe, expect, it, vi, beforeEach } from "vitest";

import { register } from "../register";
import { getGitHubDeps, registerGitHubConnector, _resetGitHubDepsForTests } from "../deps";

function activateWithServices(impls: Record<string, unknown>) {
  const resolveProviders = vi.fn((capability: string) =>
    impls[capability] !== undefined
      ? [{ packageName: "@cinatra-ai/host", impl: impls[capability] }]
      : [],
  );
  const ctx = {
    capabilities: { registerProvider: () => {}, resolveProviders },
  } as never;
  register(ctx);
  return { resolveProviders };
}

const STATUS = {
  status: "connected" as const,
  accountName: "octocat",
  settingsConfigured: true,
  selectedRepositoryFullName: "octo/repo",
};
const SETTINGS = {
  clientId: "id-1",
  clientSecret: "secret-1",
  redirectUri: "https://nango.example/oauth/callback",
  scopes: ["repo", "read:user"],
  selectedRepositoryFullName: "octo/repo",
};
const REPO = {
  id: 7,
  owner: "octo",
  repo: "repo",
  fullName: "octo/repo",
  url: "https://github.com/octo/repo",
  visibility: "private" as const,
  permissions: { admin: true, maintain: true, push: true, triage: true, pull: true },
};

beforeEach(() => {
  vi.clearAllMocks();
  _resetGitHubDepsForTests();
});

describe("register(ctx) — deps binding (cinatra#172 Stage H4)", () => {
  it("binds the deps slot at activation, resolving the host service LAZILY at call time", async () => {
    const getStatus = vi.fn(async () => STATUS);
    const getOAuthSettings = vi.fn(async () => SETTINGS);
    const listRepositories = vi.fn(async () => [REPO]);
    const saveOAuthSettings = vi.fn(async (input: unknown) => input);
    const saveRepositorySelection = vi.fn(async (input: unknown) => input);
    const { resolveProviders } = activateWithServices({
      "@cinatra-ai/host:github-connection": {
        getStatus,
        getOAuthSettings,
        listRepositories,
        saveOAuthSettings,
        saveRepositorySelection,
      },
    });
    // No host-service resolution happened at registration (probe-safe), but
    // the slot IS bound — settings-page/action bundles resolving it later
    // succeed.
    expect(resolveProviders).not.toHaveBeenCalled();

    await expect(getGitHubDeps().getStatus()).resolves.toEqual(STATUS);
    await expect(getGitHubDeps().getOAuthSettings()).resolves.toEqual(SETTINGS);
    await expect(getGitHubDeps().listRepositories()).resolves.toEqual([REPO]);
    // WRITERS forward the input document unchanged (manage gates live at the
    // calling "use server" actions — extension-side, per the TRUST note).
    await expect(
      getGitHubDeps().saveOAuthSettings({ clientId: "id-2", clientSecret: "s-2" }),
    ).resolves.toEqual({ clientId: "id-2", clientSecret: "s-2" });
    expect(saveOAuthSettings).toHaveBeenCalledWith({ clientId: "id-2", clientSecret: "s-2" });
    await expect(
      getGitHubDeps().saveRepositorySelection({ repositoryFullName: "octo/other" }),
    ).resolves.toEqual({ repositoryFullName: "octo/other" });
    expect(saveRepositorySelection).toHaveBeenCalledWith({ repositoryFullName: "octo/other" });
    expect(getStatus).toHaveBeenCalledTimes(1);
    expect(getOAuthSettings).toHaveBeenCalledTimes(1);
  });

  it("REPLACES a pre-bound deps slot (always-bind — a hot-update digest swap re-binds fresh resolvers)", async () => {
    const sentinel = vi.fn(async () => STATUS);
    registerGitHubConnector({ getStatus: sentinel } as never);
    activateWithServices({
      "@cinatra-ai/host:github-connection": {
        getStatus: async () => ({ ...STATUS, status: "not_connected" as const }),
      },
    });
    await expect(getGitHubDeps().getStatus()).resolves.toMatchObject({
      status: "not_connected",
    });
    expect(sentinel).not.toHaveBeenCalled();
  });

  it("fails LOUD (descriptive) on a missing host service at call time", () => {
    activateWithServices({});
    expect(() => getGitHubDeps().getStatus()).toThrow(
      /host service "@cinatra-ai\/host:github-connection" is not registered/,
    );
  });

  it("fails LOUD with the package name + registration step when the SLOT itself is unbound", () => {
    // No register(ctx) ran at all (e.g. a settings-page bundle resolving the
    // slot before activation): the getter must name the package and the
    // missing registration step.
    expect(() => getGitHubDeps()).toThrow(
      /@cinatra-ai\/github-connector: host runtime deps not registered[\s\S]*registerGitHubConnector/,
    );
  });
});
