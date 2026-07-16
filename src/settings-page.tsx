import Link from "next/link";
// The connector setup PAGE shell — renders the page header AND content in the
// SAME centered Wide column (max-w-3xl · 768px), so the header's left edge
// aligns with the content frame (app-connectors.html §II; cinatra-ai/cinatra
// #1247). It replaces the hand-rolled Main + PageHeader + PageContent.
import { ConnectorSetupPage } from "@cinatra-ai/sdk-ui/connector-setup-page";
// The shared two-column setup body — minmax(0,1fr) 236px, gap 30, align-start;
// wider left = configuration fields, narrower right = the Connection status
// card; collapses to one column on a narrow viewport (§II · #1254).
import { ConnectorSetupColumns } from "@cinatra-ai/sdk-ui/connector-setup-columns";
// The design-system-strict underline Tabs primitive ships from its OWN subpath.
// TabsListRow (not the bare TabsList) draws the etched paired-line section rule
// to the RIGHT of the last tab out to the column edge and drops its own bottom
// hairline; paired with a header rendered `divider={false}` (via the shell) so
// the header rule and the tab rule never stack (§II · #1242).
import { Tabs, TabsListRow, TabsTrigger, TabsContent } from "@cinatra-ai/sdk-ui/tabs";
// One-shot URL flash-message island — maps the redirect outcome CODE to a
// STATIC message (./github-flash), never URL text (toast-notifications epic;
// replaces the three raw in-page banner <div>s).
import { SearchParamToast } from "@cinatra-ai/sdk-ui/search-param-toast";
import type { ExtensionHostContext } from "@cinatra-ai/sdk-extensions";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Select } from "./components/ui/select";
import { GITHUB_FLASH_TOASTS } from "./github-flash";
import { ConnectGitHubButton, ConnectionStatusPanel, DisconnectAction } from "./setup-client";
import {
  checkGitHubStatusAction,
  disconnectGitHubConnectionAction,
  saveGitHubOAuthSettingsForConnect,
  saveGitHubRepositorySelectionAction,
} from "./actions";
// hostInternal pinned-empty sweep (cinatra#172 Stage H4): status/settings/
// repository reads resolve the host-bound deps slot (bound at serverEntry
// activation by `register(ctx)`) instead of importing `@/lib/github-api`. The
// render keeps its grant-aware `ctx` prop for the Nango port reads below.
import { getGitHubDeps } from "./deps";

type GitHubSettingsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
  // Host-injected ports (SDK-only decouple). Nango render data flows through
  // `ctx.nango.*` (the SDK port); the dispatch route + the plugins-registry
  // mount both build ctx.
  ctx: ExtensionHostContext;
};

export async function GitHubSettingsPage({ searchParams, ctx }: GitHubSettingsPageProps) {
  const resolvedSearchParams = (await (searchParams ?? Promise.resolve({}))) as Record<
    string,
    string | string[] | undefined
  >;
  void resolvedSearchParams; // outcome codes are consumed by <SearchParamToast>

  // All data-fetching in one guarded block so the Setup body can render its
  // `error` state (§II item 9) instead of throwing the whole route.
  let loadError = false;
  let settings: Awaited<ReturnType<ReturnType<typeof getGitHubDeps>["getOAuthSettings"]>> | null = null;
  // THREE-state connection status (#53): collapsing "incomplete" (account
  // connected, repository still unselected) into a boolean created a deadlock —
  // the repository picker was gated on `connected`, but `connected` required a
  // selected repository, so a fresh OAuth connection could never be completed.
  let connectionState: "connected" | "incomplete" | "not_connected" = "not_connected";
  let statusDetail: string | undefined;
  let savedConnection: { connectionId: string } | null = null;
  let nangoFrontendConfig: Record<string, unknown> = {};
  let repositories: Awaited<ReturnType<ReturnType<typeof getGitHubDeps>["listRepositories"]>> = [];

  try {
    const [loadedSettings, status] = await Promise.all([
      getGitHubDeps().getOAuthSettings(),
      getGitHubDeps().getStatus(),
    ]);
    settings = loadedSettings;
    connectionState = status.status;
    statusDetail = status.status === "incomplete" ? status.detail : undefined;
    // Nango render data via the host-injected `ctx.nango` port (optional
    // getters, null-safe — degrade if a host pinned to an older minor omits them).
    nangoFrontendConfig = (await ctx.nango.getFrontendConfig?.()) ?? {};
    savedConnection = (await ctx.nango.getPrimarySavedConnection?.("github")) ?? null;
    repositories = savedConnection ? await getGitHubDeps().listRepositories().catch(() => []) : [];
  } catch {
    loadError = true;
  }

  const callbackUrl = settings?.redirectUri ?? "Available once the connector is configured.";
  const scopes = settings?.scopes ?? [];

  return (
    // Standard connector-setup PAGE chrome (no modal). The status badge that
    // once sat top-right of the header now lives in the Connection status card
    // (§II item 2), so the header carries no badge / actions. `divider={false}`
    // — the section rule is the tab row's etched rule (§II item 4).
    <ConnectorSetupPage
      title="GitHub"
      description="Connector setup"
      divider={false}
      className="flex flex-col gap-6 pb-8"
    >
      {/* Banner → toast migration (issue #39): the three legacy in-page banner
          <div>s are gone; outcome codes toast via the static message map. */}
      <SearchParamToast toasts={GITHUB_FLASH_TOASTS} />

      <Tabs defaultValue="setup" className="w-full">
        <TabsListRow aria-label="GitHub connector setup">
          <TabsTrigger value="setup">Setup</TabsTrigger>
          {/* Help is RESERVED and ALWAYS LAST (§II items 30–31); for this
              single-connection connector the Help tab is what introduces the
              tablist (§II item 25/31). */}
          <TabsTrigger value="help">Help</TabsTrigger>
        </TabsListRow>

        {/* forceMount + `data-[state=inactive]:hidden` keeps the Setup form
            mounted while the user reads Help, so partially-typed OAuth
            credentials survive a tab switch (the schema-config form pattern). */}
        <TabsContent value="setup" forceMount className="mt-6 data-[state=inactive]:hidden">
          <ConnectorSetupColumns
            conformanceId="connector-setup"
            state={loadError ? "error" : "ready"}
            fields={
              loadError ? (
                <div className="rounded-[7px] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  Could not load the GitHub connection settings. Refresh the page to try again.
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  {/* Setup ordering (#54): the OAuth-app prerequisite and the
                      credentials-before-Connect sequence used to live ONLY on
                      the Help tab — the default tab showed two empty fields
                      beside a primary Connect with no ordering cue. State the
                      sequence here, with the OAuth-app surface linked inline
                      (same link idiom as Help). */}
                  <p className="text-sm leading-6 text-muted-foreground">
                    Connecting takes three steps: create a GitHub OAuth app at{" "}
                    <Link
                      href="https://github.com/settings/developers"
                      className="font-medium text-foreground underline underline-offset-4"
                    >
                      github.com/settings/developers
                    </Link>{" "}
                    — registering the Callback URL shown below — then enter the app&apos;s Client ID and
                    Client secret here, then press Connect. Connect saves the credentials and starts the
                    GitHub authorization; it cannot create the OAuth app for you.
                  </p>
                  {/* Configuration fields — stacked, single-column (§II item 6).
                      Pure-white inputs with the navy hairline border (Input:
                      bg-surface-strong + border-input, radius 7). Each field
                      keeps its own helper text. This is a field GROUP, not a
                      self-submitting form: the standalone "Save GitHub
                      administration" button was removed per the owner review on
                      PR #45 — the Connect button below persists these
                      credentials (reading them by `id`) before it connects. */}
                  <form id="github-oauth-form" className="flex flex-col gap-4">
                    <Label className="grid gap-1.5 text-sm font-medium text-foreground">
                      Client ID
                      <Input name="clientId" defaultValue={settings?.clientId ?? ""} autoComplete="off" />
                      <span className="text-xs font-normal text-muted-foreground">
                        The GitHub OAuth app&apos;s Client ID. Leave blank to keep the current saved value.
                      </span>
                    </Label>
                    <Label className="grid gap-1.5 text-sm font-medium text-foreground">
                      Client secret
                      <Input name="clientSecret" type="password" defaultValue={settings?.clientSecret ?? ""} autoComplete="off" />
                      <span className="text-xs font-normal text-muted-foreground">
                        The OAuth app&apos;s Client secret. Leave blank to keep the current saved value.
                      </span>
                    </Label>

                    <div className="grid gap-1.5">
                      <span className="text-sm font-medium text-foreground">Callback URL</span>
                      <p className="rounded-[7px] border border-line bg-surface-muted px-3 py-2 font-mono text-xs break-all text-foreground">
                        {callbackUrl}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        Register this exact URL as the OAuth app&apos;s authorization callback URL.
                      </span>
                    </div>

                    <div className="grid gap-1.5">
                      <span className="text-sm font-medium text-foreground">Scopes requested</span>
                      <p className="rounded-[7px] border border-line bg-surface-muted px-3 py-2 font-mono text-xs text-foreground">
                        {scopes.length > 0 ? scopes.join(", ") : "Available once the connector is configured."}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        The GitHub permissions Cinatra requests for the connection.
                      </span>
                    </div>

                  </form>

                  {/* Actions — side by side, never stacked (§II item 7):
                      Connect (indigo primary) always available (item 8), and
                      Disconnect (destructive, unplug) disabled until a
                      connection EXISTS — including the "incomplete" state, so a
                      stuck connection can always be cleared (#53).
                      Connect persists the OAuth-app credentials above (the save
                      folded in from the removed button, PR #45) and then runs
                      the shared Nango OAuth trigger. */}
                  <div className="flex flex-wrap items-center gap-3">
                    <ConnectGitHubButton
                      connectorKey="github"
                      connected={connectionState !== "not_connected"}
                      reconnectConnectionId={savedConnection?.connectionId}
                      formId="github-oauth-form"
                      nangoFrontendConfig={nangoFrontendConfig}
                      saveOAuthAction={saveGitHubOAuthSettingsForConnect}
                    />
                    <DisconnectAction
                      connected={connectionState !== "not_connected"}
                      disconnectAction={disconnectGitHubConnectionAction}
                    />
                  </div>

                  {/* Repository selection — GitHub-specific configuration that
                      applies once a connection EXISTS. Gated on the saved
                      connection, NOT on `connected` (#53): `connected` requires
                      a selected repository, and the repository is selected
                      HERE — gating this picker on it deadlocked the connector
                      at "incomplete" forever. */}
                  {savedConnection ? (
                    repositories.length > 0 ? (
                      <form action={saveGitHubRepositorySelectionAction} className="flex flex-col gap-2">
                        <Label className="grid gap-1.5 text-sm font-medium text-foreground">
                          Repository
                          <Select name="repositoryFullName" defaultValue={settings?.selectedRepositoryFullName ?? ""}>
                            <option value="">Choose a repository</option>
                            {repositories.map((repository) => (
                              <option key={repository.id} value={repository.fullName}>
                                {repository.fullName} ({repository.visibility})
                              </option>
                            ))}
                          </Select>
                          <span className="text-xs font-normal text-muted-foreground">
                            The GitHub repository Cinatra reads from and writes to.
                          </span>
                        </Label>
                        <div>
                          <Button type="submit">Save repository</Button>
                        </div>
                        {settings?.selectedRepositoryUrl ? (
                          <p className="text-xs text-muted-foreground">
                            Current:{" "}
                            <Link href={settings.selectedRepositoryUrl} className="underline underline-offset-4">
                              {settings.selectedRepositoryFullName}
                            </Link>
                          </p>
                        ) : null}
                      </form>
                    ) : (
                      <div className="rounded-[7px] border border-dashed border-line bg-surface-muted px-3 py-2 text-xs text-muted-foreground">
                        No repositories are reachable through the current GitHub connection yet. Reconnect GitHub if needed, then refresh.
                      </div>
                    )
                  ) : null}
                </div>
              )
            }
            aside={
              /* Connection status card (§II items 10–14): heading over a
                 divider, a status badge with icon + label, and a full-width
                 Check action beneath it. Pressing Check swaps in the transient
                 "Checking…" badge until the re-probe resolves. */
              <ConnectionStatusPanel
                initialState={connectionState}
                incompleteDetail={statusDetail}
                checkAction={checkGitHubStatusAction}
              />
            }
          />
        </TabsContent>

        {/* Help — reserved, always LAST, read-only (no form, no Save): the
            setup how-to narrowed to the §II Narrow content width (max-w-xl ·
            576px), flush-left beneath the tabs (§II items 26, 29–30). */}
        <TabsContent
          value="help"
          forceMount
          className="mt-6 flex max-w-xl flex-col gap-8 text-sm leading-6 text-muted-foreground data-[state=inactive]:hidden"
        >
          <section>
            <h3 className="text-base font-semibold text-foreground">About the GitHub connector</h3>
            <p className="mt-2">
              Cinatra uses a GitHub connection to read from and write to a single repository. The skills package uses this connection through Octokit when it reads and updates{" "}
              <code className="rounded bg-surface-muted px-1 py-0.5 font-mono text-xs">SKILL.md</code> files and related repository content.
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
            <div className="mt-3 rounded-[7px] border border-line bg-surface-muted px-4 py-3">
              <p className="font-mono text-xs break-all text-foreground">{callbackUrl}</p>
            </div>
          </section>

          <section>
            <h3 className="text-base font-semibold text-foreground">Permissions requested</h3>
            <p className="mt-2">
              Cinatra requests the GitHub permissions it needs to read from and write to the repository you choose, plus profile and email access for connection metadata:
            </p>
            <p className="mt-3 font-mono text-xs text-foreground">
              {scopes.length > 0 ? scopes.join(", ") : "Available once the connector is configured."}
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-foreground">Steps</h3>
            <ol className="mt-2 list-decimal space-y-2 pl-5">
              <li>On the <span className="font-medium text-foreground">Setup</span> tab, paste the OAuth app&apos;s Client ID and Client secret.</li>
              <li>Press <span className="font-medium text-foreground">Connect</span> — Cinatra saves those credentials and sends you to GitHub to authorize the app.</li>
              <li>Once the connection is active, choose the repository Cinatra should manage.</li>
              <li>Use <span className="font-medium text-foreground">Disconnect</span> to remove the connection; the connector stops working until you connect again.</li>
            </ol>
          </section>
        </TabsContent>
      </Tabs>
    </ConnectorSetupPage>
  );
}
