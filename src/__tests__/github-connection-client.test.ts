// The connector-OWNED GitHub connection client (cinatra#975 Wave 3 — the
// vendor-client inversion, epic #978): behavior pins for the relocated body of
// core's `src/lib/github-api.ts`, and the register(ctx) provider flip under
// the SAME `@cinatra-ai/host:github-connection` capability id.
//
// Pinned here:
//   - registration: own packageName, same id, probe-safe construction (no
//     capability resolution / no I/O at register time).
//   - byte-equivalent behavior of the relocated members (status detail
//     strings, settings precedence, repository mapping/sort/pagination,
//     import-era error strings).
//   - least-privilege posture preserved across the flip: the REGISTERED
//     `getOAuthSettings` strips the stored personal-access-token.
//   - the authorized-connection mint HARD-FAILS (never the instance-global
//     PAT — core's codex diff-round finding 4, preserved).
//   - fail-loud on an unresolved host capability.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { register } from "../register";
import { _resetGitHubDepsForTests } from "../deps";
import { createGitHubConnectionClient } from "../lib/github-connection-client";

type ProviderRecord = { packageName: string; impl: unknown };

function makeCtx(impls: Record<string, unknown>) {
  const registered = new Map<string, ProviderRecord[]>();
  const ctx = {
    capabilities: {
      registerProvider: vi.fn((capability: string, provider: ProviderRecord) => {
        registered.set(capability, [...(registered.get(capability) ?? []), provider]);
      }),
      resolveProviders: vi.fn((capability: string) =>
        impls[capability] !== undefined
          ? [{ packageName: "@cinatra-ai/host", impl: impls[capability] }]
          : [],
      ),
    },
  } as never;
  return { ctx, registered };
}

/** In-memory `@cinatra-ai/host:connector-config` twin (same read/write shape). */
function makeConnectorConfig(initial: Record<string, unknown> = {}) {
  const rows = new Map<string, unknown>(Object.entries(initial));
  return {
    rows,
    impl: {
      read: <T,>(connectorId: string, fallback: T): T =>
        (rows.has(connectorId) ? (rows.get(connectorId) as T) : fallback),
      write: (connectorId: string, value: unknown) => {
        rows.set(connectorId, value);
      },
    },
  };
}

const SAVED_CONNECTION = {
  connectorKey: "github",
  connectionId: "conn-1",
  providerConfigKey: "cinatra-github",
  connectedAt: "2026-01-01T00:00:00.000Z",
  displayName: "Octo Cat",
  email: "octo@example.com",
};

function makeNango(overrides: Record<string, unknown> = {}) {
  return {
    isNangoConfigured: vi.fn(() => true),
    getNangoOAuthCallbackUrl: vi.fn(() => "https://nango.example/oauth/callback"),
    listSavedNangoConnections: vi.fn(() => [SAVED_CONNECTION]),
    getPrimarySavedNangoConnection: vi.fn(() => SAVED_CONNECTION),
    ensureNangoIntegration: vi.fn(async () => ({})),
    getNangoConnection: vi.fn(async () => ({
      credentials: { type: "OAUTH2", access_token: "nango-token" },
    })),
    getNangoOAuth2IntegrationCredentials: vi.fn(async () => ({
      clientId: "client-1",
      clientSecret: "secret-1",
    })),
    providerConfigKeys: { github: "cinatra-github" },
    ...overrides,
  };
}

const realFetch = globalThis.fetch;

beforeEach(() => {
  vi.clearAllMocks();
  _resetGitHubDepsForTests();
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("register(ctx) — capability provider flip (cinatra#975 Wave 3)", () => {
  it("registers the connector-owned client under the SAME existing id with its OWN packageName", () => {
    const { ctx, registered } = makeCtx({});
    register(ctx);

    const providers = registered.get("@cinatra-ai/host:github-connection");
    expect(providers).toHaveLength(1);
    expect(providers?.[0].packageName).toBe("@cinatra-ai/github-connector");
    const impl = providers?.[0].impl as Record<string, unknown>;
    for (const member of [
      "getStatus",
      "getOAuthSettings",
      "listRepositories",
      "saveOAuthSettings",
      "saveRepositorySelection",
      "getAccessToken",
      "getAccessTokenForAuthorizedConnection",
      "savePersonalAccessToken",
    ]) {
      expect(typeof impl[member], member).toBe("function");
    }
  });

  it("is probe-safe: registration resolves NO capability and does NO I/O", () => {
    const { ctx } = makeCtx({});
    register(ctx);
    const capabilities = (ctx as { capabilities: { resolveProviders: ReturnType<typeof vi.fn> } })
      .capabilities;
    expect(capabilities.resolveProviders).not.toHaveBeenCalled();
  });

  it("the REGISTERED getOAuthSettings strips the stored personal-access-token (H4 posture preserved)", async () => {
    const config = makeConnectorConfig({
      github_oauth: { personalAccessToken: "ghp_secret", redirectUri: "https://stored.example/cb" },
    });
    const { ctx, registered } = makeCtx({
      "@cinatra-ai/host:connector-config": config.impl,
      "nango-system": makeNango(),
    });
    register(ctx);
    const impl = registered.get("@cinatra-ai/host:github-connection")?.[0].impl as {
      getOAuthSettings(): Promise<Record<string, unknown>>;
    };

    const settings = await impl.getOAuthSettings();
    expect(settings).not.toHaveProperty("personalAccessToken");
    expect(settings.clientId).toBe("client-1");
    expect(settings.redirectUri).toBe("https://stored.example/cb");
  });
});

describe("github-connection-client — relocated behavior pins", () => {
  it("fails LOUD naming the missing host capability", async () => {
    const { ctx } = makeCtx({});
    const client = createGitHubConnectionClient(ctx);
    await expect(client.getStatus()).rejects.toThrow(
      /host capability "nango-system" is not registered/,
    );
  });

  it("getStatus: connected detail string is byte-equivalent when a repo is selected", async () => {
    const config = makeConnectorConfig({
      github_oauth: {
        selectedRepositoryFullName: "octo/repo",
        selectedRepositoryUrl: "https://github.com/octo/repo",
      },
    });
    const { ctx } = makeCtx({
      "@cinatra-ai/host:connector-config": config.impl,
      "nango-system": makeNango(),
    });
    const client = createGitHubConnectionClient(ctx);

    const status = await client.getStatus();
    expect(status).toEqual({
      status: "connected",
      detail: "Connected as Octo Cat for octo/repo.",
      accountName: "Octo Cat",
      accountEmail: "octo@example.com",
      settingsConfigured: true,
      selectedRepositoryFullName: "octo/repo",
      selectedRepositoryUrl: "https://github.com/octo/repo",
    });
  });

  it("getStatus: unconfigured Nango yields the connection-service detail", async () => {
    const config = makeConnectorConfig();
    const nango = makeNango({
      isNangoConfigured: vi.fn(() => false),
      getPrimarySavedNangoConnection: vi.fn(() => null),
      getNangoOAuth2IntegrationCredentials: vi.fn(async () => null),
    });
    const { ctx } = makeCtx({
      "@cinatra-ai/host:connector-config": config.impl,
      "nango-system": nango,
    });
    const client = createGitHubConnectionClient(ctx);

    const status = await client.getStatus();
    expect(status).toEqual({
      status: "not_connected",
      detail: "Configure the connection service first to enable GitHub access.",
      settingsConfigured: false,
    });
  });

  it("getAccessToken: mints the Nango OAuth bearer with forceRefresh+refreshToken", async () => {
    const config = makeConnectorConfig();
    const nango = makeNango();
    const { ctx } = makeCtx({
      "@cinatra-ai/host:connector-config": config.impl,
      "nango-system": nango,
    });
    const client = createGitHubConnectionClient(ctx);

    const result = await client.getAccessToken();
    expect(result).toEqual({ accessToken: "nango-token", connection: SAVED_CONNECTION });
    expect(nango.getNangoConnection).toHaveBeenCalledWith("cinatra-github", "conn-1", {
      forceRefresh: true,
      refreshToken: true,
    });
  });

  it("getAccessToken: falls back to the stored PAT when the Nango token is unusable (actor-less legacy path)", async () => {
    const config = makeConnectorConfig({ github_oauth: { personalAccessToken: " ghp_pat " } });
    const nango = makeNango({
      getNangoConnection: vi.fn(async () => ({ credentials: { type: "BASIC" } })),
    });
    const { ctx } = makeCtx({
      "@cinatra-ai/host:connector-config": config.impl,
      "nango-system": nango,
    });
    const client = createGitHubConnectionClient(ctx);

    const result = await client.getAccessToken();
    expect(result).toEqual({ accessToken: "ghp_pat", connection: SAVED_CONNECTION });
  });

  it("getAccessToken: import-era error strings for the no-connection / no-token cases", async () => {
    const config = makeConnectorConfig();
    const noConnection = makeNango({
      getPrimarySavedNangoConnection: vi.fn(() => null),
      listSavedNangoConnections: vi.fn(() => []),
    });
    const { ctx } = makeCtx({
      "@cinatra-ai/host:connector-config": config.impl,
      "nango-system": noConnection,
    });
    const client = createGitHubConnectionClient(ctx);
    await expect(client.getAccessToken()).rejects.toThrow(
      "GitHub is not connected. Add a Personal Access Token in Administration → Skills to enable GitHub push.",
    );

    const unusableToken = makeNango({
      getNangoConnection: vi.fn(async () => null),
    });
    const { ctx: ctx2 } = makeCtx({
      "@cinatra-ai/host:connector-config": makeConnectorConfig().impl,
      "nango-system": unusableToken,
    });
    const client2 = createGitHubConnectionClient(ctx2);
    await expect(client2.getAccessToken()).rejects.toThrow(
      "Unable to load the GitHub access token from Nango. Add a Personal Access Token in Administration → Skills as a fallback.",
    );
  });

  it("getAccessTokenForAuthorizedConnection: HARD-FAILS — never the instance-global PAT", async () => {
    // PAT is stored, but the gate-authorized mint must never substitute it.
    const config = makeConnectorConfig({ github_oauth: { personalAccessToken: "ghp_pat" } });

    // Strictly connection-addressed (codex round-1 HIGH): an empty/undefined
    // connectionId at runtime must hard-fail, NEVER resolve the primary
    // saved connection like the actor-less member does.
    const withPrimary = makeNango();
    const { ctx: ctx0 } = makeCtx({
      "@cinatra-ai/host:connector-config": config.impl,
      "nango-system": withPrimary,
    });
    for (const badId of ["", "   ", undefined]) {
      await expect(
        createGitHubConnectionClient(ctx0).getAccessTokenForAuthorizedConnection({
          connectionId: badId as never,
        }),
      ).rejects.toThrow(
        "getAccessTokenForAuthorizedConnection requires the already-authorized connectionId — refusing to resolve a primary/fallback GitHub connection.",
      );
    }
    expect(withPrimary.getPrimarySavedNangoConnection).not.toHaveBeenCalled();
    expect(withPrimary.getNangoConnection).not.toHaveBeenCalled();

    const staleRecord = makeNango({ listSavedNangoConnections: vi.fn(() => []) });
    const { ctx } = makeCtx({
      "@cinatra-ai/host:connector-config": config.impl,
      "nango-system": staleRecord,
    });
    await expect(
      createGitHubConnectionClient(ctx).getAccessTokenForAuthorizedConnection({
        connectionId: "conn-gone",
      }),
    ).rejects.toThrow(
      "The authorized GitHub connection has no saved connection record — reconnect GitHub or remove the stale connection.",
    );

    const unusableToken = makeNango({ getNangoConnection: vi.fn(async () => null) });
    const { ctx: ctx2 } = makeCtx({
      "@cinatra-ai/host:connector-config": config.impl,
      "nango-system": unusableToken,
    });
    await expect(
      createGitHubConnectionClient(ctx2).getAccessTokenForAuthorizedConnection({
        connectionId: "conn-1",
      }),
    ).rejects.toThrow(
      "Unable to load the access token for the authorized GitHub connection — reconnect GitHub.",
    );
  });

  it("listRepositories: GitHub REST headers, row mapping, name sort, drops malformed rows", async () => {
    const config = makeConnectorConfig();
    const { ctx } = makeCtx({
      "@cinatra-ai/host:connector-config": config.impl,
      "nango-system": makeNango(),
    });
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => [
        {
          id: 2,
          name: "zeta",
          full_name: "octo/zeta",
          html_url: "https://github.com/octo/zeta",
          private: true,
          owner: { login: "octo" },
          permissions: { admin: true, maintain: false, push: true, triage: false, pull: true },
        },
        {
          id: 1,
          name: "alpha",
          full_name: "octo/alpha",
          html_url: "https://github.com/octo/alpha",
          private: false,
          owner: { login: "octo" },
          permissions: { push: false },
        },
        // malformed: no id -> dropped
        { name: "ghost", full_name: "octo/ghost", html_url: "https://x", owner: { login: "octo" } },
      ],
    }));
    globalThis.fetch = fetchMock as never;

    const repositories = await createGitHubConnectionClient(ctx).listRepositories();
    expect(repositories.map((r) => r.fullName)).toEqual(["octo/alpha", "octo/zeta"]);
    expect(repositories[1]).toEqual({
      id: 2,
      owner: "octo",
      repo: "zeta",
      fullName: "octo/zeta",
      url: "https://github.com/octo/zeta",
      visibility: "private",
      permissions: { admin: true, maintain: false, push: true, triage: false, pull: true },
    });
    // pull defaults TRUE unless explicitly false (import-era `!== false`).
    expect(repositories[0].permissions.pull).toBe(true);
    expect(repositories[0].permissions.admin).toBe(false);

    // one page (< 100 rows) stops pagination; bearer + API-version headers pinned.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      "https://api.github.com/user/repos?sort=updated&per_page=100&page=1&affiliation=owner,collaborator,organization_member",
    );
    expect(init.headers).toMatchObject({
      Accept: "application/vnd.github+json",
      Authorization: "Bearer nango-token",
      "X-GitHub-Api-Version": "2022-11-28",
    });
  });

  it("saveOAuthSettings: ensures the Nango integration and preserves the stored selection", async () => {
    const config = makeConnectorConfig({
      github_oauth: {
        selectedRepositoryFullName: "octo/repo",
        selectedRepositoryUrl: "https://github.com/octo/repo",
      },
    });
    const nango = makeNango({
      getNangoOAuth2IntegrationCredentials: vi.fn(async () => null),
    });
    const { ctx } = makeCtx({
      "@cinatra-ai/host:connector-config": config.impl,
      "nango-system": nango,
    });

    const saved = await createGitHubConnectionClient(ctx).saveOAuthSettings({
      clientId: " new-client ",
      clientSecret: "new-secret",
    });
    expect(saved.clientId).toBe("new-client");
    expect(nango.ensureNangoIntegration).toHaveBeenCalledWith({
      provider: "github",
      providerConfigKey: "cinatra-github",
      displayName: "Cinatra GitHub",
      credentials: {
        type: "OAUTH2",
        client_id: "new-client",
        client_secret: "new-secret",
        scopes: "repo,workflow,read:user,user:email",
      },
    });
    expect(config.rows.get("github_oauth")).toEqual({
      redirectUri: "https://nango.example/oauth/callback",
      selectedRepositoryFullName: "octo/repo",
      selectedRepositoryUrl: "https://github.com/octo/repo",
    });
  });

  it("saveRepositorySelection: validates against the live list and persists the selection", async () => {
    const config = makeConnectorConfig();
    const { ctx } = makeCtx({
      "@cinatra-ai/host:connector-config": config.impl,
      "nango-system": makeNango(),
    });
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => [
        {
          id: 1,
          name: "repo",
          full_name: "octo/repo",
          html_url: "https://github.com/octo/repo",
          private: false,
          owner: { login: "octo" },
        },
      ],
    })) as never;
    const client = createGitHubConnectionClient(ctx);

    await expect(client.saveRepositorySelection({})).rejects.toThrow("Choose a GitHub repository.");
    await expect(client.saveRepositorySelection({ repositoryFullName: "octo/other" })).rejects.toThrow(
      "The selected GitHub repository is not available through the current connection.",
    );

    const selected = await client.saveRepositorySelection({ repositoryFullName: "octo/repo" });
    expect(selected.fullName).toBe("octo/repo");
    expect(config.rows.get("github_oauth")).toMatchObject({
      selectedRepositoryFullName: "octo/repo",
      selectedRepositoryUrl: "https://github.com/octo/repo",
    });
  });

  it("savePersonalAccessToken: trims, stores, and clears the PAT in the same row", () => {
    const config = makeConnectorConfig({ github_oauth: { redirectUri: "https://keep.example" } });
    const { ctx } = makeCtx({
      "@cinatra-ai/host:connector-config": config.impl,
      "nango-system": makeNango(),
    });
    const client = createGitHubConnectionClient(ctx);

    client.savePersonalAccessToken(" ghp_pat ");
    expect(config.rows.get("github_oauth")).toEqual({
      redirectUri: "https://keep.example",
      personalAccessToken: "ghp_pat",
    });

    client.savePersonalAccessToken(null);
    expect(config.rows.get("github_oauth")).toEqual({
      redirectUri: "https://keep.example",
      personalAccessToken: undefined,
    });
  });
});
