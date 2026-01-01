import { useCallback, useEffect, useState, memo } from "react";
import { Button } from "@/components/ui/button";
import { IconAlertTriangle, IconCheck, IconRefresh } from "@tabler/icons-react";
import { getUnlockGuard } from "@/lib/unlock-guards";
import type { ChallengeComponentProps } from "./index";

type ClaudeBlockerSettings = {
  serverUrl: string;
  allowWhileWaitingForInput?: boolean;
};

type ClaudeBlockerStatus = "idle" | "checking" | "active" | "inactive" | "error";

type DebugState = {
  label: string;
  tone: "success" | "warning" | "error";
};

const guard = getUnlockGuard("claude");

const getDebugState = (state: { active: boolean; reason?: string }): DebugState => {
  if (state.active) {
    return { label: "Unblocked", tone: "success" };
  }
  if (
    state.reason === "offline" ||
    state.reason === "invalid_url" ||
    state.reason === "server_error"
  ) {
    return { label: "Disconnected", tone: "error" };
  }
  if (state.reason === "waiting") {
    return { label: "Blocked (waiting for input)", tone: "warning" };
  }
  return { label: "Blocked", tone: "warning" };
};

export const ClaudeBlockerChallenge = memo(
  ({ settings, onComplete }: ChallengeComponentProps<ClaudeBlockerSettings>) => {
    const [status, setStatus] = useState<ClaudeBlockerStatus>("idle");
    const [message, setMessage] = useState<string | null>(null);
    const [completed, setCompleted] = useState(false);

    const checkStatus = useCallback(async () => {
      if (completed) return;

      setStatus("checking");
      setMessage(null);

      if (!guard) {
        setStatus("error");
        setMessage("Claude Code guard unavailable.");
        return;
      }

      const result = await guard.check(settings);
      if (result.active) {
        setStatus("active");
        setCompleted(true);
        onComplete();
        return;
      }

      if (result.reason === "invalid_url") {
        setStatus("error");
        setMessage("Enter a valid server URL.");
        return;
      }

      if (result.reason === "server_error") {
        setStatus("error");
        setMessage("Server error.");
        return;
      }

      if (result.reason === "offline") {
        setStatus("error");
        setMessage("Server offline or unreachable.");
        return;
      }

      setStatus("inactive");
      if (result.reason === "waiting") {
        setMessage("Claude Code is waiting for your input.");
      }
    }, [completed, onComplete, settings]);

    useEffect(() => {
      setCompleted(false);
      setStatus("idle");
      setMessage(null);
    }, [settings.serverUrl]);

    useEffect(() => {
      void checkStatus();
    }, [checkStatus]);

    return (
      <div className="space-y-4">
        {status === "active" && (
          <div className="flex items-center justify-center gap-2 text-green-500">
            <IconCheck className="size-5" />
            <span>Claude Code is working. You can continue.</span>
          </div>
        )}

        {status === "inactive" && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <IconAlertTriangle className="size-5" />
            <span>Claude Code is idle. Start a session to unlock.</span>
          </div>
        )}

        {status === "error" && (
          <div className="flex items-center justify-center gap-2 text-destructive">
            <IconAlertTriangle className="size-5" />
            <span>Unable to reach the server.</span>
          </div>
        )}

        <Button
          onClick={checkStatus}
          className="w-full"
          variant={completed ? "outline" : "default"}
          disabled={status === "checking" || completed}
        >
          <IconRefresh className={`size-4 ${status === "checking" ? "animate-spin" : ""}`} />
          {status === "checking"
            ? "Checking..."
            : completed
              ? "Claude Code Active"
              : "Check Claude Code Status"}
        </Button>

        {message && <p className="text-xs text-center text-muted-foreground">{message}</p>}
      </div>
    );
  },
);

ClaudeBlockerChallenge.displayName = "ClaudeBlockerChallenge";

export const ClaudeBlockerDebug = memo(
  ({ settings }: ChallengeComponentProps<ClaudeBlockerSettings>) => {
    const [state, setState] = useState<{ active: boolean; reason?: string } | null>(null);

    const checkStatus = useCallback(async () => {
      if (!guard) return;
      const result = await guard.check(settings);
      setState({ active: result.active, reason: result.reason });
    }, [settings]);

    useEffect(() => {
      void checkStatus();
      const interval = setInterval(checkStatus, 3000);
      return () => clearInterval(interval);
    }, [checkStatus]);

    const debug = state ? getDebugState(state) : null;

    return (
      <div className="rounded-md border border-border/40 bg-muted/30 p-2 text-[11px]">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="font-medium">Debug</span>
          {debug ? (
            <span
              className={
                debug.tone === "success"
                  ? "text-green-500"
                  : debug.tone === "error"
                    ? "text-destructive"
                    : "text-yellow-600"
              }
            >
              {debug.label}
            </span>
          ) : (
            <span className="text-muted-foreground">Checking…</span>
          )}
        </div>
        <div className="mt-1 text-muted-foreground">
          <span className="font-medium">URL:</span>{" "}
          <span className="font-mono break-all">{settings.serverUrl || "Not configured"}</span>
        </div>
      </div>
    );
  },
);

ClaudeBlockerDebug.displayName = "ClaudeBlockerDebug";
