import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import { UI } from "@/lib/ui";

const PLUGIN_DIR = join(homedir(), ".config", "opencode", "plugin");
const PLUGIN_PATH = join(PLUGIN_DIR, "distracted.ts");

export async function setupOpenCode(port: number): Promise<void> {
  await mkdir(PLUGIN_DIR, { recursive: true });

  const pluginContent = generatePluginContent(port);
  await writeFile(PLUGIN_PATH, pluginContent);

  UI.println(UI.Style.TEXT_SUCCESS_BOLD + "OpenCode plugin configured." + UI.Style.TEXT_NORMAL);
  UI.println(UI.Style.TEXT_DIM + `Path: ${PLUGIN_PATH}` + UI.Style.TEXT_NORMAL);
  UI.println(UI.Style.TEXT_DIM + `Port: ${port}` + UI.Style.TEXT_NORMAL);
  UI.println(UI.Style.TEXT_DIM + "Next: Run 'bunx @distracted/server'" + UI.Style.TEXT_NORMAL);
  UI.empty();
}

export async function isOpenCodeConfigured(): Promise<boolean> {
  try {
    const s = await stat(PLUGIN_PATH);
    return s.isFile();
  } catch {
    return false;
  }
}

export async function removeOpenCode(): Promise<void> {
  const configured = await isOpenCodeConfigured();
  if (!configured) {
    UI.println(UI.Style.TEXT_DIM + "No OpenCode plugin found, nothing to remove." + UI.Style.TEXT_NORMAL);
    return;
  }

  await rm(PLUGIN_PATH);
  UI.println(UI.Style.TEXT_SUCCESS_BOLD + "OpenCode plugin removed." + UI.Style.TEXT_NORMAL);
  UI.println(UI.Style.TEXT_DIM + `Path: ${PLUGIN_PATH}` + UI.Style.TEXT_NORMAL);
  UI.empty();
}

export function generatePluginContent(port: number): string {
  return `// Distracted OpenCode Plugin - Auto-generated\n// This plugin sends session events to the Distracted server\n\nconst DISTRACTED_URL = \"http://localhost:${port}/hook\";\n\nasync function sendHook(payload) {\n  try {\n    fetch(DISTRACTED_URL, {\n      method: \"POST\",\n      headers: { \"Content-Type\": \"application/json\" },\n      body: JSON.stringify(payload),\n    }).catch(() => {});\n  } catch {}\n}\n\nlet currentSessionId = null;\n\nfunction getSessionId(event) {\n  if (event?.sessionId) {\n    currentSessionId = event.sessionId;\n    return event.sessionId;\n  }\n  if (currentSessionId) return currentSessionId;\n  currentSessionId = \"opencode-\" + Date.now();\n  return currentSessionId;\n}\n\nexport const DistractedPlugin = async ({ directory }) => {\n  return {\n    event: async ({ event }) => {\n      const sessionId = getSessionId(event);\n\n      if (event.type === \"session.created\") {\n        await sendHook({ session_id: sessionId, hook_event_name: \"SessionStart\", cwd: directory, source: \"opencode\" });\n      } else if (event.type === \"session.deleted\") {\n        await sendHook({ session_id: sessionId, hook_event_name: \"SessionEnd\", cwd: directory, source: \"opencode\" });\n        currentSessionId = null;\n      } else if (event.type === \"session.idle\") {\n        await sendHook({ session_id: sessionId, hook_event_name: \"Stop\", cwd: directory, source: \"opencode\" });\n      } else if (event.type === \"session.status\" && (event.status === \"running\" || event.status === \"active\")) {\n        await sendHook({ session_id: sessionId, hook_event_name: \"UserPromptSubmit\", cwd: directory, source: \"opencode\" });\n      }\n    },\n    \"tool.execute.before\": async (input) => {\n      const sessionId = currentSessionId || \"opencode-\" + Date.now();\n      await sendHook({ session_id: sessionId, hook_event_name: \"PreToolUse\", tool_name: input.tool, tool_input: input.args, source: \"opencode\" });\n    },\n  };\n};\n\nexport default DistractedPlugin;\n`;
}
