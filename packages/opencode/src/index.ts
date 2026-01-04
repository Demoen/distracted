import type { Plugin } from "@opencode-ai/plugin";

const DISTRACTED_PORT = process.env.DISTRACTED_PORT ? parseInt(process.env.DISTRACTED_PORT, 10) : 8765;
const DISTRACTED_URL = `http://localhost:${DISTRACTED_PORT}/hook`;

type HookPayload = {
  session_id: string;
  hook_event_name: "UserPromptSubmit" | "PreToolUse" | "Stop" | "SessionStart" | "SessionEnd";
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  cwd?: string;
  source: "opencode";
};

async function sendHook(payload: HookPayload): Promise<void> {
  try {
    fetch(DISTRACTED_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch {}
}

let currentSessionId: string | null = null;

function getSessionId(event: { sessionId?: string }): string {
  if (event.sessionId) {
    currentSessionId = event.sessionId;
    return event.sessionId;
  }
  if (currentSessionId) return currentSessionId;
  currentSessionId = `opencode-${Date.now()}`;
  return currentSessionId;
}

export const DistractedPlugin: Plugin = async ({ directory }) => {
  return {
    event: async ({ event }) => {
      const sessionId = getSessionId(event as { sessionId?: string });

      switch (event.type) {
        case "session.created":
          await sendHook({
            session_id: sessionId,
            hook_event_name: "SessionStart",
            cwd: directory,
            source: "opencode",
          });
          break;

        case "session.deleted":
          await sendHook({
            session_id: sessionId,
            hook_event_name: "SessionEnd",
            cwd: directory,
            source: "opencode",
          });
          currentSessionId = null;
          break;

        case "session.idle":
          await sendHook({
            session_id: sessionId,
            hook_event_name: "Stop",
            cwd: directory,
            source: "opencode",
          });
          break;

        case "session.status": {
          const statusEvent = event as { status?: string };
          if (statusEvent.status === "running" || statusEvent.status === "active") {
            await sendHook({
              session_id: sessionId,
              hook_event_name: "UserPromptSubmit",
              cwd: directory,
              source: "opencode",
            });
          }
          break;
        }
      }
    },

    "tool.execute.before": async (input) => {
      const sessionId = currentSessionId || `opencode-${Date.now()}`;
      await sendHook({
        session_id: sessionId,
        hook_event_name: "PreToolUse",
        tool_name: input.tool,
        tool_input: input.args as Record<string, unknown>,
        source: "opencode",
      });
    },
  };
};

export default DistractedPlugin;
