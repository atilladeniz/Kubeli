"use client";

import { PlugZap } from "lucide-react";

export interface SessionDroppedNoticeProps {
  /** Why the session was cut, as reported by the backend */
  reason: string;
  onReconnect: () => void;
}

/**
 * Inline notice for an exec session that was cut after it had been running.
 *
 * A session drops for entirely ordinary reasons - a network blip, an API
 * server restart, a rotated token - so this reads as a recoverable state
 * rather than an error. Reconnecting reuses the same tab, so the xterm
 * instance and its scrollback survive.
 *
 * ponytail: hardcoded English like the rest of PodTerminal/NodeTerminal
 * (their header labels are not translated either); worth wiring to next-intl
 * only when the whole terminal area gets localized.
 */
export function SessionDroppedNotice({ reason, onReconnect }: SessionDroppedNoticeProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-[#45475a] text-sm border-b border-[#313244]">
      <PlugZap className="size-4 shrink-0 text-[#f9e2af]" />
      <span className="text-[#cdd6f4]">Connection lost: {reason}</span>
      <button
        onClick={onReconnect}
        className="text-[#89b4fa] hover:underline"
      >
        Reconnect
      </button>
    </div>
  );
}
