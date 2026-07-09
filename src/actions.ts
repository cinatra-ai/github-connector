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
import { flashHref } from "@cinatra-ai/sdk-extensions/flash-href";
import { getGitHubDeps } from "./deps";

// Codes-only flash protocol (toast-notifications epic, cinatra-ai/cinatra#1107
// S7): both actions redirect back to the settings page carrying `?notice=<code>`
// / `?error=<code>`; the <SearchParamToast> island mounted in ./settings-page
// maps each code to the static message in ./github-flash — never URL-derived
// text.
const SETUP_PATH = "/configuration/llm/github";

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
  try {
    await getGitHubDeps().saveOAuthSettings({
      clientId: parsed.clientId,
      clientSecret: parsed.clientSecret,
    });
  } catch (e) {
    console.error("[saveGitHubConnectionAction] saveOAuthSettings failed:", e);
    redirect(flashHref(SETUP_PATH, { error: "oauth-save-failed" }));
  }
  redirect(flashHref(SETUP_PATH, { notice: "saved" }));
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
  try {
    await getGitHubDeps().saveRepositorySelection({ repositoryFullName: parsed.repositoryFullName });
  } catch (e) {
    console.error("[saveGitHubRepositorySelectionAction] saveRepositorySelection failed:", e);
    redirect(flashHref(SETUP_PATH, { error: "repo-save-failed" }));
  }
  redirect(flashHref(SETUP_PATH, { notice: "repo-saved" }));
}
