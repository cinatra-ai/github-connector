// Dispatch-route entry.
import type { ExtensionHostContext } from "@cinatra-ai/sdk-extensions";
import { GitHubSettingsPage } from "./settings-page";

type ConnectorSetupPageProps = {
  packageId: string;
  slug: string;
  searchParams: Record<string, string | string[] | undefined>;
  ctx: ExtensionHostContext;
};

export default async function GitHubConnectorSetupPage({
  searchParams,
  ctx,
}: ConnectorSetupPageProps) {
  return GitHubSettingsPage({ searchParams: Promise.resolve(searchParams), ctx });
}
