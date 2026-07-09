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
//
// Flash protocol (toast-notifications epic, cinatra-ai/cinatra#1107): each
// action redirects back to the setup page carrying an outcome CODE — never a
// message — in `?notice=<code>` / `?error=<code>`. The <SearchParamToast>
// island in ./settings-page maps each code to a STATIC, server-trusted message
// via ./github-flash (the single source of truth). A crafted `?error=<text>`
// that is not a known code maps to nothing and is ignored — attacker-controlled
// query text is never reflected into a toast.

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireExtensionAction } from "@cinatra-ai/sdk-extensions";
import { getGitHubDeps } from "./deps";

const PACKAGE_NAME = "@cinatra-ai/github-connector";

// The connector's own public setup route (the generic connector dispatch route,
// subroute "setup"). After a save/disconnect we redirect back HERE — with the
// matching outcome code — so the standalone setup PAGE stays put and its toast
// island shows the confirmation. (Before the connector-setup-tabs conversion the
// setup surface was a MODAL that closed back to /configuration/llm on save; that
// off-page redirect left the page's confirmations unreachable.)
const GITHUB_SETUP_PATH = "/connectors/cinatra-ai/github-connector/setup";

function noticeUrl(code: "saved" | "repo-saved" | "disconnected") {
  return `${GITHUB_SETUP_PATH}?notice=${code}`;
}
function errorUrl(code: "oauth-save-failed" | "repo-save-failed" | "disconnect-failed") {
  return `${GITHUB_SETUP_PATH}?error=${code}`;
}

const githubConnectorSchema = z.object({
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
});

export async function saveGitHubConnectionAction(formData: FormData) {
  await requireExtensionAction(PACKAGE_NAME, "manage");
  const parsed = githubConnectorSchema.parse({
    clientId: formData.get("clientId") ?? undefined,
    clientSecret: formData.get("clientSecret") ?? undefined,
  });
  // Only the WRITER is guarded — the auth gate and zod parse must still throw
  // (fail-closed on an unauthorized caller / malformed payload); a write
  // failure degrades to a friendly error toast instead of an unhandled 500.
  let ok = true;
  try {
    await getGitHubDeps().saveOAuthSettings({
      clientId: parsed.clientId,
      clientSecret: parsed.clientSecret,
    });
  } catch {
    ok = false;
  }
  // redirect() throws NEXT_REDIRECT — it MUST live outside the try above.
  redirect(ok ? noticeUrl("saved") : errorUrl("oauth-save-failed"));
}

const githubRepoSelectionSchema = z.object({
  repositoryFullName: z.string().optional(),
});

export async function saveGitHubRepositorySelectionAction(formData: FormData) {
  await requireExtensionAction(PACKAGE_NAME, "manage");
  const parsed = githubRepoSelectionSchema.parse({
    repositoryFullName:
      (formData.get("repositoryFullName") as string | null) ??
      (formData.get("repository") as string | null) ??
      undefined,
  });
  let ok = true;
  try {
    await getGitHubDeps().saveRepositorySelection({ repositoryFullName: parsed.repositoryFullName });
  } catch {
    ok = false;
  }
  redirect(ok ? noticeUrl("repo-saved") : errorUrl("repo-save-failed"));
}

// Disconnect the GitHub connection (destructive — confirmed by the setup page's
// AlertDialog before this action fires). Manage-gated, same posture as the
// writers above.
export async function disconnectGitHubConnectionAction() {
  await requireExtensionAction(PACKAGE_NAME, "manage");
  let ok = true;
  try {
    await getGitHubDeps().disconnect();
  } catch {
    ok = false;
  }
  redirect(ok ? noticeUrl("disconnected") : errorUrl("disconnect-failed"));
}

// Re-probe the live connection status for the setup page's "Check" action.
// Returns the badge-shaped status ("connected" | "disconnected") — never
// redirects, so the client island can swap its transient "Checking…" badge for
// the resolved one in place. Manage-gated: it is a control on the manage-gated
// settings surface.
export async function checkGitHubStatusAction(): Promise<"connected" | "disconnected"> {
  await requireExtensionAction(PACKAGE_NAME, "manage");
  const status = await getGitHubDeps().getStatus();
  return status.status === "connected" ? "connected" : "disconnected";
}
