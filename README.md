# GitHub

Connect a GitHub repository to Cinatra so your agents and workflows can read from and write to it. After you sign in via OAuth and choose a repository, Cinatra keeps that repository available to every agent and workflow that needs it — no per-call credential setup required.

**Install.** The connector is a Cinatra extension; install it from the Cinatra marketplace or add `@cinatra-ai/github-connector` as a peer-resolved extension in your Cinatra host configuration.

**Configure.** Open **Settings → GitHub** in the Cinatra UI. Paste your GitHub OAuth app's Client ID and Client Secret (the callback URL is pre-filled for you), save, then click **Connect GitHub**. Once the OAuth flow completes, choose the repository Cinatra should use and save the selection. The connection status badge turns green when both the OAuth credentials and a repository selection are in place.

**Develop.** The connector exports a `register(ctx)` server entry (`./register`) that ships its own GitHub connection client and registers it as the `@cinatra-ai/host:github-connection` capability — the Cinatra core ships no GitHub client code. UI surfaces are exported from `./settings-page` and `./setup-page`. Run the host's lint step (`lint` script) to validate the extension before publishing.

**Troubleshoot.** If the status badge shows "Setup required", the OAuth credentials are missing — re-enter the Client ID and Client Secret. If the badge shows "Ready to connect", the credentials are saved but no GitHub connection exists yet — complete the OAuth flow. If the repository list is empty after connecting, disconnect and reconnect GitHub, then refresh the settings page.

## Works with

- Cinatra agents and workflows that need to read from or write to a GitHub repository
- GitHub OAuth Apps (Client ID + Client Secret required; callback URL is provided by Cinatra)

## Capabilities

- Authorise Cinatra to act on your GitHub account via OAuth
- Browse and select the active repository from all repositories the connected account can access
- Expose the selected repository to any agent or workflow via the `@cinatra-ai/host:github-connection` host service
- Persist OAuth credentials and repository selection; re-activation re-binds fresh resolvers automatically
