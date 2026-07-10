// The connector-OWNED GitHub connection client (cinatra#975 Wave 3 — the
// vendor-client inversion, epic #978: core owns integration MECHANISM, never
// vendor CODE).
//
// This module is the RELOCATED, behavior-equivalent body of cinatra core's
// `src/lib/github-api.ts` (deleted in the paired core-eviction PR that follows
// every Wave-3 connector PR). The publish direction inverts exactly like the
// merged Wave-2 widget-auth stores (wordpress-mcp-connector#56 / the drupal
// twin): the connector now OWNS the client and `register(ctx)` registers it
// under the SAME existing capability id (`@cinatra-ai/host:github-connection`)
// — a provider flip, no SDK contract change.
//
// Host needs ride EXISTING published capabilities, resolved LAZILY per call
// (probe-safe; activation order never matters):
//   - settings persistence  -> `@cinatra-ai/host:connector-config`
//     (the SAME instance-global `github_oauth` row the core module wrote —
//     existing installs keep their stored redirect/repository/PAT untouched).
//   - Nango OAuth plumbing  -> the connector-authored `nango-system` surface
//     (a RESERVED system capability: resolvable here because this connector is
//     a FIRST-PARTY host-build extension; the host fence denies marketplace
//     code).
//   - outbound HTTP bound   -> `./fetch-with-timeout`, a PURE COPY of the
//     core helper (neutral mechanism, byte-equivalent).
//
// EXPLICIT NON-MEMBER (the `HostInstanceConnectionGateService` contract's
// pinned ruling, cinatra#1077): the ACTOR-GATED W2 grant-following resolver —
// core's `getGitHubAccessToken({ actor })` branch over
// `@/lib/connection-credential-resolver` / `@/lib/connection-use-gate` — STAYS
// HOST-SIDE. `ActorContext` never crosses the extension boundary; after the
// core eviction the host call site (packages/skills) gates FIRST and then
// calls `getAccessTokenForAuthorizedConnection` below with the resolved,
// already-authorized connectionId. Consequently this client performs NO
// gate/audit calls itself, and the host's `source: "github-api"` audit labels
// are untouched (label parity is trivially preserved).
//
// NO SECRET VALUES ARE LOGGED anywhere in this module (it does not log at
// all); tokens/secrets only ever travel to the GitHub API `Authorization`
// header and the Nango integration upsert, exactly as before. There is no
// fs/request logging to route through the `ctx.logger.capture` channel
// (cinatra#981) — the core module carried none.

import type {
  ExtensionHostContext,
  NangoSystemSurface,
  SavedNangoConnection,
} from "@cinatra-ai/sdk-extensions";
import { fetchWithTimeout } from "./fetch-with-timeout";

const PACKAGE_NAME = "@cinatra-ai/github-connector";

// ---------------------------------------------------------------------------
// Shapes — relocated verbatim from core's `src/lib/github-api.ts`.
// ---------------------------------------------------------------------------

type GitHubStoredSettings = {
  redirectUri?: string;
  selectedRepositoryFullName?: string;
  selectedRepositoryUrl?: string;
  personalAccessToken?: string;
};

export type GitHubOAuthSettings = {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  scopes: string[];
  selectedRepositoryFullName?: string;
  selectedRepositoryUrl?: string;
  personalAccessToken?: string;
};

export type GitHubConnectionStatus = {
  status: "connected" | "incomplete" | "not_connected";
  detail?: string;
  accountName?: string;
  accountEmail?: string;
  settingsConfigured: boolean;
  selectedRepositoryFullName?: string;
  selectedRepositoryUrl?: string;
};

export type GitHubRepositoryOption = {
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

const GITHUB_OAUTH_SCOPES = ["repo", "workflow", "read:user", "user:email"] as const;
const GITHUB_OAUTH_SCOPES_VALUE = GITHUB_OAUTH_SCOPES.join(",");
/** The SAME instance-global connector-config row id the core module used —
 * existing installs' stored settings (redirect/repository/PAT) read back
 * unchanged through the host connector-config capability. */
const GITHUB_SETTINGS_CONNECTOR_ID = "github_oauth";

// ---------------------------------------------------------------------------
// Lazy host-capability resolution (fail-loud on a missing capability).
// ---------------------------------------------------------------------------

/** The generic host connector-config KV service (read/write members only —
 * this client never deletes its row). Local structural shape so the module
 * compiles against any host SDK it can meet during skew. */
type HostConnectorConfigShape = {
  read<T>(connectorId: string, fallback: T): T;
  write(connectorId: string, value: unknown): void;
};

/** The subset of the connector-authored `nango-system` surface this client
 * consumes — exactly the members core's `github-api.ts` imported from
 * `@/lib/nango-system`. */
type NangoSystemShape = Pick<
  NangoSystemSurface,
  | "isNangoConfigured"
  | "getNangoOAuthCallbackUrl"
  | "listSavedNangoConnections"
  | "getPrimarySavedNangoConnection"
  | "ensureNangoIntegration"
  | "getNangoConnection"
  | "getNangoOAuth2IntegrationCredentials"
  // disconnect path (connector setup page Disconnect action): delete the OAuth
  // connection at Nango, then drop the persisted saved-connection record.
  | "deleteNangoConnection"
  | "removeNangoConnectionRecord"
  | "providerConfigKeys"
>;

/** Fail-loud lazy resolution: a capability that is not registered when a
 * member actually runs is a wiring bug, never silently degraded. */
function hostService<T>(ctx: ExtensionHostContext, capability: string): T {
  const provider = ctx.capabilities.resolveProviders(capability)[0];
  if (!provider) {
    throw new Error(
      `${PACKAGE_NAME}: host capability "${capability}" is not registered — ` +
        `the host boot wiring / system-extension activation must run before connector calls.`,
    );
  }
  return provider.impl as T;
}

// ---------------------------------------------------------------------------
// The client.
// ---------------------------------------------------------------------------

export type GitHubAccessTokenResult = {
  accessToken: string;
  connection: SavedNangoConnection | null;
};

export type GitHubConnectionClient = {
  /** Aggregate connection status (settings-page badge + Nango card). */
  getStatus(): Promise<GitHubConnectionStatus>;
  /** FULL OAuth settings document INCLUDING the stored personal-access-token
   * fallback — internal/host-fallback shape. The registered capability's
   * `getOAuthSettings` member STRIPS the PAT before publication (the
   * cinatra#172 H4 least-privilege posture, preserved). */
  getOAuthSettings(): Promise<GitHubOAuthSettings>;
  /** Repositories reachable through the live connection (sorted by name). */
  listRepositories(): Promise<GitHubRepositoryOption[]>;
  /** WRITER — persist OAuth app credentials + ensure the Nango integration. */
  saveOAuthSettings(input: {
    clientId?: string;
    clientSecret?: string;
  }): Promise<GitHubOAuthSettings>;
  /** WRITER — persist the repository selection (validated against the live
   * connection's repository list; throws on an unknown repository). */
  saveRepositorySelection(input: {
    repositoryFullName?: string;
  }): Promise<GitHubRepositoryOption>;
  /** ACTOR-LESS access-token mint (core's legacy primary-record path,
   * byte-equivalent): saved Nango connection first, stored PAT fallback. */
  getAccessToken(input?: { connectionId?: string }): Promise<GitHubAccessTokenResult>;
  /** Connection-ADDRESSED mint for a connection the HOST has already
   * authorized (gate-first-then-call — see the module-head non-member note).
   * HARD-FAILS on a missing record or an unusable token; NEVER falls back to
   * the instance-global PAT (a different credential the host's gate never
   * authorized — core's codex diff-round finding 4, preserved verbatim). */
  getAccessTokenForAuthorizedConnection(input: {
    connectionId: string;
  }): Promise<{ accessToken: string; connection: SavedNangoConnection }>;
  /** WRITER — persist (or clear, on null/blank) the personal-access-token
   * fallback for the host's skills-configuration surface. */
  savePersonalAccessToken(pat: string | null): void;
  /** WRITER — disconnect the GitHub connection: delete the OAuth connection at
   * Nango (tolerating an already-deleted connection), drop the persisted
   * saved-connection record, and clear BOTH the stored repository selection and
   * the stored personal-access-token fallback (a disconnect must leave no
   * credential behind — `getAccessToken` falls back to the PAT). Idempotent /
   * retry-safe — a no-op when there is no saved connection. The OAuth-app admin
   * credentials (client id/secret, held by the Nango integration, not this
   * store) are intentionally KEPT so a later reconnect does not require
   * re-entering them; the connector "stops working until you connect it again"
   * (spec §II disconnect copy). */
  disconnect(input?: { connectionId?: string }): Promise<void>;
};

/** Build the connector-owned GitHub connection client. Construction does NO
 * I/O and NO capability resolution (probe-safe) — every member resolves its
 * host capabilities lazily at call time. */
export function createGitHubConnectionClient(ctx: ExtensionHostContext): GitHubConnectionClient {
  const connectorConfig = () =>
    hostService<HostConnectorConfigShape>(ctx, "@cinatra-ai/host:connector-config");
  const nango = () => hostService<NangoSystemShape>(ctx, "nango-system");

  const githubProviderConfigKey = () => nango().providerConfigKeys.github;

  function readStoredSettings(): GitHubStoredSettings {
    return connectorConfig().read<GitHubStoredSettings>(GITHUB_SETTINGS_CONNECTOR_ID, {});
  }

  function writeStoredSettings(value: GitHubStoredSettings) {
    connectorConfig().write(GITHUB_SETTINGS_CONNECTOR_ID, value);
  }

  function parseSelectedRepository(value: string | undefined) {
    const trimmed = value?.trim();
    if (!trimmed) {
      return undefined;
    }

    const [owner, repo] = trimmed.split("/");
    if (!owner || !repo) {
      return undefined;
    }

    return {
      owner,
      repo,
      fullName: `${owner}/${repo}`,
    };
  }

  function resolveSavedGitHubConnection(connectionId?: string): SavedNangoConnection | null {
    if (!connectionId) {
      return nango().getPrimarySavedNangoConnection("github");
    }

    return (
      nango()
        .listSavedNangoConnections("github")
        .find((connection) => connection.connectionId === connectionId) ?? null
    );
  }

  async function getOAuthSettings(): Promise<GitHubOAuthSettings> {
    const nangoCredentials = await nango().getNangoOAuth2IntegrationCredentials(
      githubProviderConfigKey(),
    );
    const stored = readStoredSettings();

    return {
      clientId: nangoCredentials?.clientId,
      clientSecret: nangoCredentials?.clientSecret,
      redirectUri: stored.redirectUri ?? nango().getNangoOAuthCallbackUrl(),
      scopes: [...GITHUB_OAUTH_SCOPES],
      selectedRepositoryFullName: stored.selectedRepositoryFullName?.trim() || undefined,
      selectedRepositoryUrl: stored.selectedRepositoryUrl?.trim() || undefined,
      personalAccessToken: stored.personalAccessToken?.trim() || undefined,
    };
  }

  async function getStatus(): Promise<GitHubConnectionStatus> {
    const savedConnection = nango().getPrimarySavedNangoConnection("github");
    const settings = await getOAuthSettings();
    const settingsConfigured = Boolean(settings.clientId && settings.clientSecret);

    if (savedConnection) {
      if (settings.selectedRepositoryFullName) {
        return {
          status: "connected",
          detail: `Connected${savedConnection.displayName ? ` as ${savedConnection.displayName}` : ""} for ${settings.selectedRepositoryFullName}.`,
          accountName: savedConnection.displayName,
          accountEmail: savedConnection.email,
          settingsConfigured: true,
          selectedRepositoryFullName: settings.selectedRepositoryFullName,
          selectedRepositoryUrl: settings.selectedRepositoryUrl,
        };
      }

      return {
        status: "incomplete",
        detail: `GitHub account connected${savedConnection.displayName ? ` as ${savedConnection.displayName}` : ""}, but repository selection is still required.`,
        accountName: savedConnection.displayName,
        accountEmail: savedConnection.email,
        settingsConfigured: true,
        selectedRepositoryFullName: settings.selectedRepositoryFullName,
        selectedRepositoryUrl: settings.selectedRepositoryUrl,
      };
    }

    if (settingsConfigured) {
      return {
        status: "incomplete",
        detail:
          "GitHub OAuth is configured. Connect a GitHub account to enable repository access for skill package management.",
        settingsConfigured,
        selectedRepositoryFullName: settings.selectedRepositoryFullName,
        selectedRepositoryUrl: settings.selectedRepositoryUrl,
      };
    }

    if (settings.clientId || settings.clientSecret) {
      return {
        status: "incomplete",
        detail: "Save both the GitHub client ID and client secret to finish the OAuth setup.",
        settingsConfigured: false,
      };
    }

    if (!nango().isNangoConfigured()) {
      return {
        status: "not_connected",
        detail: "Configure the connection service first to enable GitHub access.",
        settingsConfigured: false,
      };
    }

    return {
      status: "not_connected",
      detail: "Configure GitHub OAuth to connect your GitHub account.",
      settingsConfigured: false,
      selectedRepositoryFullName: settings.selectedRepositoryFullName,
      selectedRepositoryUrl: settings.selectedRepositoryUrl,
    };
  }

  async function ensureGitHubIntegration(settings: GitHubOAuthSettings) {
    if (!settings.clientId || !settings.clientSecret) {
      return;
    }

    await nango().ensureNangoIntegration({
      provider: "github",
      providerConfigKey: githubProviderConfigKey(),
      displayName: "Cinatra GitHub",
      credentials: {
        type: "OAUTH2",
        client_id: settings.clientId,
        client_secret: settings.clientSecret,
        scopes: GITHUB_OAUTH_SCOPES_VALUE,
      },
    });
  }

  async function saveOAuthSettings(input: {
    clientId?: string;
    clientSecret?: string;
  }): Promise<GitHubOAuthSettings> {
    const current = await getOAuthSettings();
    const nextSettings: GitHubOAuthSettings = {
      clientId: input.clientId?.trim() || current.clientId,
      clientSecret: input.clientSecret?.trim() || current.clientSecret,
      redirectUri: nango().getNangoOAuthCallbackUrl(),
      scopes: [...GITHUB_OAUTH_SCOPES],
    };

    await ensureGitHubIntegration(nextSettings);
    writeStoredSettings({
      redirectUri: nextSettings.redirectUri,
      selectedRepositoryFullName: current.selectedRepositoryFullName,
      selectedRepositoryUrl: current.selectedRepositoryUrl,
    });

    return nextSettings;
  }

  /** Mint the OAuth bearer for a SAVED connection record via Nango, or null
   * when the resolved credentials are not a usable OAUTH2 bearer. A failing
   * Nango resolution REJECTS (never folded to null) — identical to core. */
  async function mintNangoAccessToken(savedConnection: SavedNangoConnection): Promise<string | null> {
    const connection = await nango().getNangoConnection(
      savedConnection.providerConfigKey ?? githubProviderConfigKey(),
      savedConnection.connectionId,
      {
        forceRefresh: true,
        refreshToken: true,
      },
    );
    const credentials = (
      connection as
        | {
            credentials?: {
              type?: string;
              access_token?: string;
            };
          }
        | null
    )?.credentials;

    if (
      credentials?.type === "OAUTH2" &&
      typeof credentials.access_token === "string" &&
      credentials.access_token.trim()
    ) {
      return credentials.access_token;
    }
    return null;
  }

  async function getAccessToken(input?: {
    connectionId?: string;
  }): Promise<GitHubAccessTokenResult> {
    const savedConnection = resolveSavedGitHubConnection(input?.connectionId);

    if (savedConnection) {
      const accessToken = await mintNangoAccessToken(savedConnection);
      if (accessToken) {
        return {
          accessToken,
          connection: savedConnection,
        };
      }
    }

    // Fall back to a stored Personal Access Token if Nango OAuth is unavailable.
    const stored = readStoredSettings();
    const pat = stored.personalAccessToken?.trim();
    if (pat) {
      return {
        accessToken: pat,
        connection: savedConnection ?? null,
      };
    }

    if (!savedConnection) {
      throw new Error(
        "GitHub is not connected. Add a Personal Access Token in Administration → Skills to enable GitHub push.",
      );
    }

    throw new Error(
      "Unable to load the GitHub access token from Nango. Add a Personal Access Token in Administration → Skills as a fallback.",
    );
  }

  async function getAccessTokenForAuthorizedConnection(input: {
    connectionId: string;
  }): Promise<{ accessToken: string; connection: SavedNangoConnection }> {
    // Strictly connection-ADDRESSED (codex Wave-3 round-1 HIGH): a missing /
    // empty / non-string connectionId at runtime must HARD-FAIL here — it must
    // never degrade into the primary-connection lookup the actor-less member
    // performs (that would mint a credential the host's gate never authorized).
    const connectionId =
      typeof input?.connectionId === "string" ? input.connectionId.trim() : "";
    if (!connectionId) {
      throw new Error(
        "getAccessTokenForAuthorizedConnection requires the already-authorized connectionId — refusing to resolve a primary/fallback GitHub connection.",
      );
    }
    // EXACT-id resolver only — deliberately NOT resolveSavedGitHubConnection,
    // whose falsy-input branch falls back to the primary saved connection.
    const savedConnection =
      nango()
        .listSavedNangoConnections("github")
        .find((connection) => connection.connectionId === connectionId) ?? null;
    // A gate-authorized resolution is connection-ADDRESSED: the decision the
    // host audited covers exactly ONE connection, so a missing record or an
    // unavailable Nango token must HARD-FAIL — never silently substitute the
    // instance-global PAT (a different credential the gate never authorized;
    // core's codex diff-round finding 4, preserved verbatim).
    if (!savedConnection) {
      throw new Error(
        "The authorized GitHub connection has no saved connection record — reconnect GitHub or remove the stale connection.",
      );
    }

    const accessToken = await mintNangoAccessToken(savedConnection);
    if (!accessToken) {
      throw new Error(
        "Unable to load the access token for the authorized GitHub connection — reconnect GitHub.",
      );
    }

    return { accessToken, connection: savedConnection };
  }

  async function githubApiFetch<T>(pathnameWithQuery: string) {
    const { accessToken } = await getAccessToken();
    const response = await fetchWithTimeout(`https://api.github.com${pathnameWithQuery}`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${accessToken}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      cache: "no-store",
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
          ? payload.message
          : "GitHub API request failed.";
      throw new Error(message);
    }

    return payload as T;
  }

  async function listRepositories(): Promise<GitHubRepositoryOption[]> {
    const repositories: GitHubRepositoryOption[] = [];

    for (let page = 1; page <= 10; page += 1) {
      const payload = await githubApiFetch<
        Array<{
          id?: number;
          name?: string;
          full_name?: string;
          html_url?: string;
          private?: boolean;
          owner?: { login?: string };
          permissions?: {
            admin?: boolean;
            maintain?: boolean;
            push?: boolean;
            triage?: boolean;
            pull?: boolean;
          };
        }>
      >(`/user/repos?sort=updated&per_page=100&page=${page}&affiliation=owner,collaborator,organization_member`);

      const batch = payload.flatMap((repository) => {
        const owner = String(repository.owner?.login ?? "").trim();
        const repo = String(repository.name ?? "").trim();
        const fullName = String(repository.full_name ?? "").trim() || (owner && repo ? `${owner}/${repo}` : "");
        const url = String(repository.html_url ?? "").trim();

        if (!owner || !repo || !fullName || !url || typeof repository.id !== "number") {
          return [];
        }

        return [
          {
            id: repository.id,
            owner,
            repo,
            fullName,
            url,
            visibility: repository.private ? ("private" as const) : ("public" as const),
            permissions: {
              admin: repository.permissions?.admin === true,
              maintain: repository.permissions?.maintain === true,
              push: repository.permissions?.push === true,
              triage: repository.permissions?.triage === true,
              pull: repository.permissions?.pull !== false,
            },
          },
        ];
      });

      repositories.push(...batch);

      if (batch.length < 100) {
        break;
      }
    }

    return repositories.sort((left, right) => left.fullName.localeCompare(right.fullName));
  }

  function savePersonalAccessToken(pat: string | null) {
    const current = readStoredSettings();
    writeStoredSettings({
      ...current,
      personalAccessToken: pat?.trim() || undefined,
    });
  }

  async function saveRepositorySelection(input: {
    repositoryFullName?: string;
  }): Promise<GitHubRepositoryOption> {
    const current = await getOAuthSettings();
    const parsedRepository = parseSelectedRepository(input.repositoryFullName);

    if (!parsedRepository) {
      throw new Error("Choose a GitHub repository.");
    }

    const repositories = await listRepositories();
    const selectedRepository = repositories.find(
      (repository) => repository.fullName === parsedRepository.fullName,
    );
    if (!selectedRepository) {
      throw new Error("The selected GitHub repository is not available through the current connection.");
    }

    writeStoredSettings({
      redirectUri: current.redirectUri,
      selectedRepositoryFullName: selectedRepository.fullName,
      selectedRepositoryUrl: selectedRepository.url,
    });

    return selectedRepository;
  }

  async function disconnect(input?: { connectionId?: string }): Promise<void> {
    const savedConnection = resolveSavedGitHubConnection(input?.connectionId);
    if (savedConnection) {
      // Delete at Nango FIRST (the authoritative credential scrub), then drop
      // the local record. TOLERATE a Nango delete failure (e.g. the connection
      // was already removed / not found): we still remove the local record, so
      // a partial-failure retry — remote gone, record left — can always clear
      // the stale record. The disconnect is idempotent (retry-safe).
      try {
        await nango().deleteNangoConnection(githubProviderConfigKey(), savedConnection.connectionId);
      } catch {
        // Proceed to drop the local record regardless — never wedge a
        // disconnected connector in a "still shows a saved connection" state.
      }
      await nango().removeNangoConnectionRecord("github", savedConnection.connectionId);
    }
    // Clear the repository binding AND the stored personal-access-token
    // fallback: a disconnect must leave NO credential behind. `getAccessToken`
    // falls back to the stored PAT, so keeping it would let the connector keep
    // authenticating after "Disconnect". The OAuth-app client id/secret live in
    // the Nango integration (not this store) and are intentionally kept so a
    // later reconnect does not require re-entering them.
    const current = readStoredSettings();
    writeStoredSettings({
      redirectUri: current.redirectUri,
      personalAccessToken: undefined,
      selectedRepositoryFullName: undefined,
      selectedRepositoryUrl: undefined,
    });
  }

  return {
    getStatus,
    getOAuthSettings,
    listRepositories,
    saveOAuthSettings,
    saveRepositorySelection,
    getAccessToken,
    getAccessTokenForAuthorizedConnection,
    savePersonalAccessToken,
    disconnect,
  };
}
