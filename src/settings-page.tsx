import Link from "next/link";
import { Main, PageHeader, PageContent } from "@cinatra-ai/sdk-ui";
// The shared, design-system-strict underline Tabs primitive ships from its OWN
// subpath (NOT the `/marketplace` barrel — that would pull it onto every app
// route's reachable-module graph). Model B (bundled-react) connector setup
// pages consume it directly for their Setup / … / always-last Help tabs.
// `TabsListRow` (not the bare `TabsList`) is the under-header row: it draws the
// design-system etched paired-line rule to the RIGHT of the last tab out to the
// column edge and drops its own bottom hairline; pair it with a header rendered
// `divider={false}` so the two rules never stack (app-connectors §II ·
// app.html Components · Tabs).
import { Tabs, TabsListRow, TabsTrigger, TabsContent } from "@cinatra-ai/sdk-ui/tabs";
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
    // Standard connector-setup PAGE chrome (no modal). The host floats the
    // connection-status badge top-right OVER this page, so the extension renders
    // no status pill and no `actions` slot of its own. Single connection + a
    // reserved, always-last Help tab (app-connectors.html §II): adding the Help
    // tab is what introduces the tablist.
    <Main className="min-h-screen">
      {/* Header + tablist hold to the Wide column (max-w-3xl · 768px, §VII
          Content widths), centered in the stage. `divider={false}` because the
          section rule is drawn by TabsListRow to the right of the last tab —
          never stack a header rule above a tab rule (§II). */}
      <PageHeader title="GitHub" description="Connector setup" divider={false} className="max-w-3xl" />
      <PageContent className="flex max-w-3xl flex-col gap-6 pb-8">
        <Tabs defaultValue="setup" className="w-full">
          <TabsListRow aria-label="GitHub connector setup">
            <TabsTrigger value="setup">Setup</TabsTrigger>
            {/* Help is RESERVED and ALWAYS LAST (§II). */}
            <TabsTrigger value="help">Help</TabsTrigger>
          </TabsListRow>

          {/* forceMount + our own `data-[state=inactive]:hidden` keeps the Setup
              form mounted while the user reads Help, so partially-typed OAuth
              credentials are never dropped on a tab switch (the schema-config
              connector-form pattern). Help is read-only prose, mounted the same
              way for parity. */}
          <TabsContent value="setup" forceMount className="mt-6 flex flex-col gap-10 data-[state=inactive]:hidden">
            {errorMessage ? (
              <div className="rounded-control border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{errorMessage}</div>
            ) : null}

            {saved ? (
              <div className="rounded-control border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
                GitHub OAuth administration saved.
              </div>
            ) : null}

            {repoSaved ? (
              <div className="rounded-control border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
                GitHub repository saved and cloned into the local data folder.
              </div>
            ) : null}

            <section>
              <h3 className="text-lg font-semibold text-foreground">GitHub OAuth administration</h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                Save the GitHub OAuth app credentials Nango should use. See the <span className="font-medium text-foreground">Help</span> tab for how to create the OAuth app and which callback URL to register.
              </p>

              <form action={saveGitHubConnectionAction} className="mt-6 grid gap-4 sm:grid-cols-2">
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
                  <p className="mt-2 break-all">{settings.redirectUri ?? "Available once the connector is configured."}</p>
                </div>
                <div className="rounded-control border border-line bg-surface-muted px-4 py-4 text-sm text-muted-foreground sm:col-span-2">
                  <p className="font-medium text-foreground">Scopes requested</p>
                  <p className="mt-2">{settings.scopes.join(", ")}</p>
                </div>
                <div className="sm:col-span-2 flex flex-wrap gap-3">
                  <Button type="submit">Save GitHub administration</Button>
                </div>
              </form>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-foreground">GitHub repository connection</h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                After saving the OAuth app values, connect GitHub, then choose the repository Cinatra should read from and write to.
              </p>

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
            </section>
          </TabsContent>

          {/* Help — reserved, always LAST, read-only (no form, no Save): the
              setup how-to (prerequisites, callback URL, scopes, steps) narrowed
              to the §II Narrow content width. */}
          <TabsContent value="help" forceMount className="mt-6 flex max-w-xl flex-col gap-8 text-sm leading-6 text-muted-foreground data-[state=inactive]:hidden">
            <section>
              <h3 className="text-base font-semibold text-foreground">About the GitHub connector</h3>
              <p className="mt-2">
                Cinatra uses a GitHub connection to read from and write to a single repository. The skills package uses this connection through Octokit when it reads and updates <code className="rounded bg-surface-muted px-1 py-0.5 font-mono text-xs">SKILL.md</code> files and related repository content.
              </p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-foreground">Before you start</h3>
              <p className="mt-2">
                You need a GitHub OAuth app. Create one under GitHub → Settings → Developer settings → OAuth Apps, or go straight to{" "}
                <Link
                  href="https://github.com/settings/developers"
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  github.com/settings/developers
                </Link>
                . When creating the OAuth app, register this callback URL so GitHub can return the authorization to Cinatra:
              </p>
              <div className="mt-3 rounded-control border border-line bg-surface-muted px-4 py-3">
                <p className="break-all font-mono text-xs text-foreground">{settings.redirectUri ?? "Available once the connector is configured."}</p>
              </div>
            </section>

            <section>
              <h3 className="text-base font-semibold text-foreground">Permissions requested</h3>
              <p className="mt-2">
                Cinatra requests the GitHub permissions it needs to read from and write to the repository you choose, plus profile and email access for connection metadata:
              </p>
              <p className="mt-3 font-mono text-xs text-foreground">{settings.scopes.join(", ")}</p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-foreground">Steps</h3>
              <ol className="mt-2 list-decimal space-y-2 pl-5">
                <li>On the <span className="font-medium text-foreground">Setup</span> tab, paste the OAuth app&apos;s Client ID and Client secret, then Save.</li>
                <li>Connect GitHub — you will be sent to GitHub to authorize the app.</li>
                <li>Once the connection is active, choose the repository Cinatra should manage.</li>
              </ol>
            </section>
          </TabsContent>
        </Tabs>
      </PageContent>
    </Main>
  );
}
