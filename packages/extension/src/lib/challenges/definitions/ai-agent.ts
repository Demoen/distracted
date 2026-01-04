import type { ChallengeDefinition } from "@/lib/challenges/options";

export const aiAgentDefinition = {
  label: "AI Coding Agent",
  description: "Unlock only while an AI coding agent is actively working",
  title: "AI Coding Agent",
  instructions: {
    title: "AI Coding Agent setup",
    summary:
      "This unlock method only succeeds while an AI coding agent (Claude Code, OpenCode, etc.) is actively running inference.",
    steps: [
      "Install and start the local Distracted server (this also configures agent hooks).",
      "Keep the server running while you work with your AI coding agent.",
      "If you change the server port, update the Server URL below.",
    ],
    commands: ["bunx @distracted/server --setup"],
    note: "If the server is offline or no agent is working, the site stays locked.",
  },
  options: {
    serverUrl: {
      type: "text",
      label: "Distracted Server URL",
      default: "http://localhost:8765",
    },
    allowWhileWaitingForInput: {
      type: "checkbox",
      label: "Allow while waiting for input",
      default: false,
      description: "Keep access open when an agent is waiting for your reply",
    },
  },
} as const satisfies ChallengeDefinition;
