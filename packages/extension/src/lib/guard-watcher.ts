import { getUnlockGuard, type UnlockGuardState } from "@/lib/unlock-guards";
import type { UnlockMethod } from "@/lib/challenges/manifest";

type GuardWatcherOptions = {
  method: UnlockMethod;
  settings: unknown;
  onState: (state: UnlockGuardState) => void;
  heartbeatMs?: number;
  pollIntervalMs?: number;
};

export type GuardWatcherHandle = {
  stop: () => void;
};

export function startGuardWatcher({
  method,
  settings,
  onState,
  heartbeatMs = 5000,
  pollIntervalMs,
}: GuardWatcherOptions): GuardWatcherHandle | null {
  const guard = getUnlockGuard(method);
  if (!guard) return null;

  let stopped = false;
  let socket: WebSocket | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let wsPingTimer: ReturnType<typeof setInterval> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectAttempts = 0;
  let lastState: UnlockGuardState | null = null;

  const emitState = (state: UnlockGuardState) => {
    if (stopped) return;
    lastState = state;
    onState(state);
  };

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (pollTimer) clearInterval(pollTimer);
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (wsPingTimer) clearInterval(wsPingTimer);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (socket) {
      socket.close();
      socket = null;
    }
  };

  const handleGuardState = (state: UnlockGuardState) => {
    emitState(state);
    if (!state.active) {
      stop();
    }
  };

  const runCheck = async () => {
    try {
      const state = await guard.check(settings as never);
      handleGuardState(state);
    } catch {
      handleGuardState({ active: false, reason: "offline" });
    }
  };

  const startPolling = () => {
    const interval = pollIntervalMs ?? guard.pollIntervalMs ?? 5000;
    void runCheck();
    pollTimer = setInterval(() => {
      void runCheck();
    }, interval);
  };

  const startHeartbeat = () => {
    heartbeatTimer = setInterval(() => {
      if (lastState?.active) {
        emitState(lastState);
      }
    }, heartbeatMs);
  };

  const wsUrl = guard.getWebSocketUrl?.(settings as never);
  if (wsUrl) {
    // WebSocket mode: keep a polling fallback and auto-reconnect the socket.
    // This avoids instantly revoking access on transient WS drops (common in MV3/offscreen).
    startPolling();

    const scheduleReconnect = () => {
      if (stopped) return;
      if (reconnectTimer) return;
      reconnectAttempts += 1;
      const backoffMs = Math.min(10_000, 500 * 2 ** Math.min(6, reconnectAttempts)); // 0.5s .. 10s
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, backoffMs);
    };

    const connect = () => {
      if (stopped) return;
      try {
        socket?.close();
      } catch {
        // ignore
      }
      socket = new WebSocket(wsUrl);

      socket.addEventListener("open", () => {
        reconnectAttempts = 0;
        void runCheck();
      });

      socket.addEventListener("message", (event) => {
        try {
          const payload = JSON.parse(event.data as string);
          const state = guard.parseWebSocketMessage?.(payload, settings as never);
          if (state) {
            handleGuardState(state);
          }
        } catch {
          // Ignore malformed messages
        }
      });

      socket.addEventListener("close", () => {
        scheduleReconnect();
      });
      socket.addEventListener("error", () => {
        scheduleReconnect();
      });
    };

    connect();

    // App-level ping to keep the server (and any intermediaries) from timing out idle connections.
    wsPingTimer = setInterval(() => {
      if (stopped) return;
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      try {
        socket.send(JSON.stringify({ type: "ping" }));
      } catch {
        // ignore; reconnect loop will handle close/error
      }
    }, 10_000);

    startHeartbeat();
  } else {
    startPolling();
  }

  return { stop };
}
