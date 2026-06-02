"use server";

// GitHub connection server actions — relocated from the central
// `@cinatra-ai/connectors` host hub into the connector itself (SDK-only
// decouple). Gated by the SDK's `requireExtensionAction(pkg, "manage")` as the
// FIRST executable statement — the hub copies had NO gate, so this ADDS
// authorization (org_owner/org_admin/platform_admin, fail-closed; github IS a
// catalog connector, so `manage` resolves via enforceConnectorPolicy normally).
//
// The OAuth/repo-selection writers stay in `@/lib/github-api` (the connector's
// existing `hostInternal` edge — the SAME tolerated `@/lib/*` edge the
// settings-page already carries; the sdkOnly gate ignores `@/lib/*`). Relocating
// those writers into the connector is Phase-B / out of scope here.

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireExtensionAction } from "@cinatra-ai/sdk-extensions";
import { saveGitHubOAuthSettings, saveGitHubRepositorySelection } from "@/lib/github-api";

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
  await saveGitHubOAuthSettings({
    clientId: parsed.clientId,
    clientSecret: parsed.clientSecret,
  });
  redirect("/configuration/llm");
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
  await saveGitHubRepositorySelection({ repositoryFullName: parsed.repositoryFullName });
  redirect("/configuration/llm");
}
