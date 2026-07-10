"use client";

// Client islands for the GitHub connector setup page (the server component in
// ./settings-page renders the page chrome, form, and prose; these own the two
// interactive affordances that need client state):
//
//   ConnectionStatusPanel — the right-column Connection status card + its Check
//     action. Pressing Check swaps the badge for the transient indigo
//     "Checking…" (spinner) until the re-probe server action resolves, then
//     shows Connected / Disconnected (app-connectors.html §II · Check flow).
//
//   DisconnectAction — the destructive Disconnect button + its confirmation
//     AlertDialog. Disabled until the connector is connected (nothing to
//     disconnect otherwise). Confirming fires the manage-gated disconnect
//     server action, which redirects back with the outcome toast code.
//
//   ConnectGitHubButton — the Connect/Reconnect button (§II plug glyph). The
//     standalone "Save GitHub administration" button was removed per the owner
//     review on PR #45; persisting the OAuth-app credentials is now WIRED INTO
//     this button: on click it reads the Client ID / Client secret from the
//     setup form, persists them via the manage-gated `saveOAuthAction` (the
//     equivalent save), and only then launches the real Nango connect. The
//     connect itself REUSES the SDK's <NangoUserConnectButton> (rendered hidden
//     and driven programmatically) so the entire session / Connect-UI / save
//     flow stays in the SDK — the connector adds only the save-first step.

import * as React from "react";
import { Plug, RefreshCw, Unplug } from "lucide-react";
import { ConnectionStatusCard } from "@cinatra-ai/sdk-ui/connection-status-card";
import type { ConnectionStatus } from "@cinatra-ai/sdk-ui/connection-status-badge";
import { NangoUserConnectButton } from "@cinatra-ai/sdk-ui/nango";
import type { NangoFrontendConfig } from "@cinatra-ai/sdk-ui/nango";
import { Button } from "./components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./components/ui/dialog";

export function ConnectionStatusPanel({
  initialConnected,
  checkAction,
}: {
  initialConnected: boolean;
  /** Server action that re-probes the live connection status. */
  checkAction: () => Promise<"connected" | "disconnected">;
}) {
  const [status, setStatus] = React.useState<ConnectionStatus>(
    initialConnected ? "connected" : "disconnected",
  );
  const [isPending, startTransition] = React.useTransition();

  function onCheck() {
    // Guard against overlapping checks (the button is also disabled while
    // pending): a second probe must not race an in-flight one and let an older
    // response overwrite a newer result.
    if (status === "checking") return;
    // Capture the last-known status so a probe FAILURE restores it rather than
    // misreporting a network / auth / server error as "Disconnected" (only a
    // resolved probe changes the badge).
    const previous = status;
    setStatus("checking");
    startTransition(async () => {
      try {
        setStatus(await checkAction());
      } catch {
        setStatus(previous);
      }
    });
  }

  return (
    <ConnectionStatusCard
      status={status}
      action={
        <Button
          type="button"
          variant="outline"
          onClick={onCheck}
          disabled={isPending || status === "checking"}
        >
          <RefreshCw aria-hidden="true" />
          Check
        </Button>
      }
    />
  );
}

export function DisconnectAction({
  connected,
  disconnectAction,
  title = "Disconnect connector?",
  description = "Disconnect this connector and remove its saved configuration? It will stop working until you connect it again.",
}: {
  connected: boolean;
  /** Manage-gated server action; redirects back with the outcome toast code. */
  disconnectAction: () => Promise<void>;
  title?: string;
  description?: string;
}) {
  const [isPending, startTransition] = React.useTransition();

  return (
    <AlertDialog>
      {/* Disabled until connected — there is nothing to disconnect otherwise
          (app-connectors.html §II). Connect stays always-available (rendered
          separately by the server component). */}
      <AlertDialogTrigger asChild>
        <Button type="button" variant="destructive" disabled={!connected}>
          <Unplug aria-hidden="true" />
          Disconnect
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending}
              onClick={(event) => {
                // Keep the dialog controlling focus/close; run the redirecting
                // server action inside a transition.
                event.preventDefault();
                startTransition(() => {
                  void disconnectAction();
                });
              }}
            >
              <Unplug aria-hidden="true" />
              Disconnect
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ConnectGitHubButton({
  connectorKey,
  connected,
  reconnectConnectionId,
  formId,
  nangoFrontendConfig,
  saveOAuthAction,
}: {
  connectorKey: string;
  connected: boolean;
  reconnectConnectionId?: string;
  /** id of the setup field group holding the `clientId` / `clientSecret`
   *  inputs — read on click to persist the credentials before connecting. */
  formId: string;
  nangoFrontendConfig?: NangoFrontendConfig;
  /** Manage-gated writer — persists the OAuth-app credentials and RETURNS an
   *  outcome (never redirects) so a save failure aborts the connect and shows
   *  the error inline. */
  saveOAuthAction: (input: {
    clientId?: string;
    clientSecret?: string;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  // The real Nango connect trigger lives hidden inside this island and is
  // clicked programmatically once the credentials are saved — so the whole
  // session / Connect-UI / connection-save flow stays in the SDK button and the
  // connector only adds the save-first step.
  const connectRef = React.useRef<HTMLSpanElement>(null);

  async function handleConnect() {
    if (saving) return;
    setError(null);
    const form =
      typeof document !== "undefined"
        ? (document.getElementById(formId) as HTMLFormElement | null)
        : null;
    const clientId =
      (form?.elements.namedItem("clientId") as HTMLInputElement | null)?.value ?? "";
    const clientSecret =
      (form?.elements.namedItem("clientSecret") as HTMLInputElement | null)?.value ?? "";

    setSaving(true);
    try {
      const result = await saveOAuthAction({ clientId, clientSecret });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Credentials persisted — launch the real Nango connect. openConnectUI
      // mounts an in-page modal (not window.open), so triggering it after the
      // async save is not blocked as a non-gesture popup.
      connectRef.current?.querySelector("button")?.click();
    } catch {
      setError("Could not save the GitHub OAuth app credentials. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button type="button" onClick={handleConnect} disabled={saving}>
        <Plug aria-hidden="true" />
        {saving ? "Saving…" : connected ? "Reconnect" : "Connect"}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {/* Hidden real Nango connect trigger. Passing `onError` makes the SDK
          button render as a bare <button> (no wrapper / fallback UI), so the ref
          query resolves exactly one clickable control; its errors route to the
          inline surface above. */}
      <span ref={connectRef} className="hidden" aria-hidden="true">
        <NangoUserConnectButton
          connectorKey={connectorKey}
          connected={connected}
          reconnectConnectionId={reconnectConnectionId}
          nangoFrontendConfig={nangoFrontendConfig}
          onError={(message) => setError(message || null)}
        />
      </span>
    </div>
  );
}
