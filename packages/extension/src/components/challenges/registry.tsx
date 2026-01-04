import type { UnlockMethod } from "@/lib/challenges/manifest";
import { timerChallenge } from "@/components/challenges/timer";
import { holdChallenge } from "@/components/challenges/hold";
import { typeChallenge } from "@/components/challenges/type";
import { aiAgentChallenge } from "@/components/challenges/ai-agent";
import { strictChallenge } from "@/components/challenges/strict";
import { mathsChallenge } from "@/components/challenges/maths";

export const CHALLENGE_UI = {
  timer: timerChallenge,
  hold: holdChallenge,
  type: typeChallenge,
  claude: aiAgentChallenge,
  strict: strictChallenge,
  maths: mathsChallenge,
} as const satisfies Record<UnlockMethod, unknown>;
