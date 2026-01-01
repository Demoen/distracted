import type { UnlockMethod } from "@/lib/storage";
import {
  getClaudeBlockerStatus,
  parseClaudeBlockerStateMessage,
  resolveClaudeBlockerWebSocketUrl,
} from "@/lib/claude-blocker";

export type UnlockGuardState = {
  active: boolean;
  reason?: "invalid_url" | "server_error" | "offline" | "idle";
  message?: string;
};

export type UnlockGuardDefinition<Settings = unknown> = {
  method: UnlockMethod;
  check: (settings: Settings) => Promise<UnlockGuardState>;
  getWebSocketUrl?: (settings: Settings) => string | null;
  parseWebSocketMessage?: (payload: unknown) => UnlockGuardState | null;
  pollIntervalMs?: number;
};

const CLAUDE_POLL_INTERVAL_MS = 5000;

export const UNLOCK_GUARDS: Partial<Record<UnlockMethod, UnlockGuardDefinition>> = {
  claude: {
    method: "claude",
    check: async (settings) => {
      const config = settings as { serverUrl?: string } | null | undefined;
      const result = await getClaudeBlockerStatus(config?.serverUrl ?? "");
      return {
        active: result.active,
        reason: result.reason,
        message:
          result.reason === "invalid_url"
            ? "Claude Blocker server URL is invalid."
            : result.reason === "server_error"
              ? `Claude Blocker server error${result.statusCode ? ` (${result.statusCode})` : ""}.`
              : result.reason === "offline"
                ? "Claude Blocker server is offline."
                : result.active
                  ? undefined
                  : "Claude Code is idle.",
      };
    },
    getWebSocketUrl: (settings) => {
      const config = settings as { serverUrl?: string } | null | undefined;
      return resolveClaudeBlockerWebSocketUrl(config?.serverUrl ?? "");
    },
    parseWebSocketMessage: (payload) => {
      const result = parseClaudeBlockerStateMessage(payload);
      if (!result) return null;
      return {
        active: result.active,
        reason: result.reason,
        message: result.active ? undefined : "Claude Code is idle.",
      };
    },
    pollIntervalMs: CLAUDE_POLL_INTERVAL_MS,
  },
};

export function getUnlockGuard(method: UnlockMethod): UnlockGuardDefinition | null {
  return UNLOCK_GUARDS[method] ?? null;
}

export function isContinuousUnlockMethod(method: UnlockMethod): boolean {
  return getUnlockGuard(method) !== null;
}
