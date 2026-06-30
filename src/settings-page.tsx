import Link from "next/link";
import { ConnectorSettingsDialog } from "@cinatra-ai/sdk-ui";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Select } from "./components/ui/select";
import { NangoManagedApiCard, NangoUserConnectButton } from "@cinatra-ai/sdk-ui/nango";
import type { ExtensionHostContext } from "@cinatra-ai/sdk-extensions";
import { saveGitHubConnectionAction, saveGitHubRepositorySelectionAction } from "./actions";
// hostInternal pinned-empty sweep (cinatra#172 Stage H4): status/settings/
// repository reads resolve the host-bound deps slot (bound at serverEntry
// activation by `register(ctx)` adapting `@cinatra-ai/host:github-connection`)
// instead of importing `@/lib/github-api`. The render keeps its grant-aware
// `ctx` prop for the Nango port reads below — deps slot and ctx prop coexist
// by design (actions CANNOT close over ctx; render-time reads may use either).
import { getGitHubDeps } from "./deps";

type GitHubSettingsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
  // Host-injected ports (SDK-only decouple). Nango render data flows
  // through `ctx.nango.*` (the SDK port) instead of importing the nango-connector
  // extension — the dispatch route + the plugins-registry mount both build ctx.
  ctx: ExtensionHostContext;
};

function pickSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export async function GitHubSettingsPage({ searchParams, ctx }: GitHubSettingsPageProps) {
  const [settings, status, resolvedSearchParams] = await Promise.all([
    getGitHubDeps().getOAuthSettings(),
    getGitHubDeps().getStatus(),
    (searchParams ?? Promise.resolve({})) as Promise<Record<string, string | string[] | undefined>>,
  ]);

  const errorMessage = pickSearchParam(resolvedSearchParams.error);
  const saved = pickSearchParam(resolvedSearchParams.saved) === "1";
  const repoSaved = pickSearchParam(resolvedSearchParams.repoSaved) === "1";
  // Nango render data via the host-injected `ctx.nango` port (optional getters,
  // null-safe — degrade to "not configured" if a host pinned to an older minor
  // doesn't implement them).
  const nangoFrontendConfig = (await ctx.nango.getFrontendConfig?.()) ?? {};
  const connectionServiceReady = ((await ctx.nango.getStatus?.())?.status ?? "not_connected") === "connected";
  const savedConnection = (await ctx.nango.getPrimarySavedConnection?.("github")) ?? null;
  const settingsConfigured = Boolean(settings.clientId && settings.clientSecret);
  const repositories =
    savedConnection
      ? await getGitHubDeps().listRepositories().catch(() => [])
      : [];

  return (
    <ConnectorSettingsDialog closeHref="/configuration/llm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground">API setup</p>
              <h2 className="text-2xl font-semibold tracking-tight">GitHub API</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                Configure the GitHub OAuth app Cinatra uses with Nango, then connect GitHub access for the repository Cinatra should read from and write to.
              </p>
            </div>
            <div className="flex items-start gap-3">
              {/* The connection-status badge is HOST-injected on the connector
                  setup-page dispatch route — the same badge the /connectors card
                  shows — so the extension no longer renders its own status pill
                  here (it would duplicate the host badge). The title + form stay
                  extension-owned, and `status.status` still drives the per-card
                  badge + the saved-connection affordances below. */}
              <Link
                href="/configuration/llm"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
                aria-label="Close"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4.5 w-4.5">
                  <path d="M6 6 18 18" />
                  <path d="M18 6 6 18" />
                </svg>
              </Link>
            </div>
          </div>

          {errorMessage ? (
            <div className="mt-5 rounded-control border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{errorMessage}</div>
          ) : null}

          {saved ? (
            <div className="mt-5 rounded-control border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
              GitHub OAuth administration saved.
            </div>
          ) : null}

          {repoSaved ? (
            <div className="mt-5 rounded-control border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
              GitHub repository saved and cloned into the local data folder.
            </div>
          ) : null}

          <div className="mt-6">
            <h3 className="text-lg font-semibold text-foreground">GitHub OAuth administration</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Save the GitHub OAuth app credentials that Nango should use. Cinatra requests the GitHub permissions it needs to read from and write to the repository you will choose during connection, plus profile and email access for connection metadata.
            </p>
          </div>

          <form action={saveGitHubConnectionAction} className="mt-6 grid gap-4 sm:grid-cols-2">
            <Input type="hidden" name="redirectTo" value="/configuration/llm/github" />
            <Label className="grid gap-2">
              Client ID
              <Input
                name="clientId"
                defaultValue={settings.clientId ?? ""}
              />
            </Label>
            <Label className="grid gap-2">
              Client secret
              <Input
                name="clientSecret"
                type="password"
                defaultValue={settings.clientSecret ?? ""}
              />
            </Label>
            <div className="rounded-control border border-line bg-surface-muted px-4 py-4 text-sm text-muted-foreground sm:col-span-2">
              <p className="font-medium text-foreground">Callback URL</p>
              <p className="mt-2 break-all">{settings.redirectUri}</p>
            </div>
            <div className="rounded-control border border-line bg-surface-muted px-4 py-4 text-sm text-muted-foreground sm:col-span-2">
              <p className="font-medium text-foreground">Scopes requested</p>
              <p className="mt-2">{settings.scopes.join(", ")}</p>
            </div>
            <div className="sm:col-span-2 flex flex-wrap gap-3">
              <Button type="submit">Save GitHub administration</Button>
            </div>
          </form>

          <div className="mt-10">
            <h3 className="text-lg font-semibold text-foreground">GitHub repository connection</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              After saving the OAuth app values, connect GitHub first. Once the connection is active, choose the repository Cinatra should use. The skills package will use this connection through Octokit when it reads and updates `SKILL.md` files and related repo content.
            </p>
          </div>

          <div className="mt-6">
            <NangoManagedApiCard
              connectorKey="github"
              title="GitHub API"
              description="Connect GitHub and select the repository Cinatra should use for skill package file management."
              badge={
                status.status === "connected"
                  ? "Connected"
                  : settingsConfigured
                    ? "Ready to connect"
                    : "Setup required"
              }
              badgeTone={
                status.status === "connected"
                  ? "connected"
                  : settingsConfigured
                    ? "warning"
                    : "neutral"
              }
              detail={status.detail}
              isConnected={status.status === "connected"}
              usesConnectUI={settingsConfigured && !savedConnection}
              reconnectConnectionId={savedConnection?.connectionId}
              nangoFrontendConfig={nangoFrontendConfig}
              connectionServiceReady={connectionServiceReady}
            />
          </div>

          {savedConnection ? (
            <div className="mt-6 rounded-panel border border-line bg-surface px-5 py-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h4 className="text-base font-semibold text-foreground">Selected repository</h4>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                    Choose the GitHub repository Cinatra should manage with this connection.
                  </p>
                </div>
                {status.selectedRepositoryFullName ? (
                  <span className="rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs uppercase text-success">
                    {status.selectedRepositoryFullName}
                  </span>
                ) : (
                  <span className="rounded-full border border-warning/30 bg-warning/10 px-3 py-1 text-xs uppercase text-warning">
                    Repository required
                  </span>
                )}
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <NangoUserConnectButton
                  connectorKey="github"
                  reconnectConnectionId={savedConnection.connectionId}
                  connected
                  reconnectLabel="Connect GitHub again"
                  nangoFrontendConfig={nangoFrontendConfig}
                  className="rounded-control border border-line bg-surface-strong px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-surface-muted"
                />
                <p className="text-sm text-muted-foreground">
                  Use this only if you want to switch the underlying GitHub account. Your repository selection can be changed below without reconnecting.
                </p>
              </div>

              {repositories.length > 0 ? (
                <form action={saveGitHubRepositorySelectionAction} className="mt-6 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <Input type="hidden" name="redirectTo" value="/configuration/llm/github" />
                  <Label className="grid gap-2">
                    Repository
                    <Select
                      name="repositoryFullName"
                      defaultValue={settings.selectedRepositoryFullName ?? ""}
                      className="rounded-control border border-line bg-surface-strong px-4 py-3"
                    >
                      <option value="">Choose a repository</option>
                      {repositories.map((repository) => (
                        <option key={repository.id} value={repository.fullName}>
                          {repository.fullName} ({repository.visibility})
                        </option>
                      ))}
                    </Select>
                  </Label>
                  <div className="flex items-end">
                    <Button type="submit">Save repository</Button>
                  </div>
                </form>
              ) : (
                <div className="mt-6 rounded-control border border-dashed border-line bg-surface-muted px-4 py-4 text-sm text-muted-foreground">
                  No repositories were returned for the current GitHub connection yet. Reconnect GitHub if needed and then refresh this page.
                </div>
              )}

              {settings.selectedRepositoryUrl ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Current repository:{" "}
                  <Link href={settings.selectedRepositoryUrl} className="underline underline-offset-4">
                    {settings.selectedRepositoryFullName}
                  </Link>
                </p>
              ) : null}
            </div>
          ) : null}
    </ConnectorSettingsDialog>
  );
}
