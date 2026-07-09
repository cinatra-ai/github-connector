"use server";

// GitHub connection server actions — relocated from the central
// `@cinatra-ai/connectors` host hub into the connector itself (SDK-only
// decouple). Gated by the SDK's `requireExtensionAction(pkg, "manage")` as the
// FIRST executable statement — the hub copies had NO gate, so this ADDS
// authorization (org_owner/org_admin/platform_admin, fail-closed; github IS a
// catalog connector, so `manage` resolves via enforceConnectorPolicy normally).
//
// hostInternal pinned-empty sweep (cinatra#172 Stage H4): the OAuth/
// repo-selection WRITERS no longer reach `@/lib/github-api` statically — they
// resolve the host-bound deps slot (`getGitHubDeps()`, bound at serverEntry
// activation by `register(ctx)` adapting `@cinatra-ai/host:github-connection`).
// "use server" actions compile into separately-compiled bundles and CANNOT
// close over the render-time `ctx` prop, hence the deps slot. The writers run
// host-side inside the service; the manage gates above stay HERE,
// extension-side — the identical posture the static imports carried.

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireExtensionAction } from "@cinatra-ai/sdk-extensions";
import { getGitHubDeps } from "./deps";

// The connector's own public setup route (the generic connector dispatch route,
// subroute "setup"). After a save we redirect back HERE — with the matching
// success flag — so the standalone setup PAGE stays put and renders its own
// ?saved / ?repoSaved banner. (Before the connector-setup-tabs conversion the
// setup surface was a MODAL that closed back to /configuration/llm on save; that
// off-page redirect left the page's success banners unreachable.)
const GITHUB_SETUP_PATH = "/connectors/cinatra-ai/github-connector/setup";

const githubConnectorSchema = z.object({
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
});

export async function saveGitHubConnectionAction(formData: FormData) {
  await requireExtensionAction("@cinatra-ai/github-connector", "manage");
  const parsed = githubConnectorSchema.parse({
    clientId: formData.get("clientId") ?? undefined,
    clientSecret: formData.get("clientSecret") ?? undefined,
  });
  await getGitHubDeps().saveOAuthSettings({
    clientId: parsed.clientId,
    clientSecret: parsed.clientSecret,
  });
  redirect(`${GITHUB_SETUP_PATH}?saved=1`);
}

const githubRepoSelectionSchema = z.object({
  repositoryFullName: z.string().optional(),
});

export async function saveGitHubRepositorySelectionAction(formData: FormData) {
  await requireExtensionAction("@cinatra-ai/github-connector", "manage");
  const parsed = githubRepoSelectionSchema.parse({
    repositoryFullName:
      (formData.get("repositoryFullName") as string | null) ??
      (formData.get("repository") as string | null) ??
      undefined,
  });
  await getGitHubDeps().saveRepositorySelection({ repositoryFullName: parsed.repositoryFullName });
  redirect(`${GITHUB_SETUP_PATH}?repoSaved=1`);
}
