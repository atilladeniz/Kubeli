"use client";

import { useEffect, useState } from "react";
import { getReconnectStartTime } from "@/lib/stores/portforward-store";

export function ReconnectingTimer({ forwardId }: { forwardId: string }) {
  const [elapsed, setElapsed] = useState(() => {
    const startTime = getReconnectStartTime(forwardId);
    return startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const startTime = getReconnectStartTime(forwardId);
      if (startTime) {
        setElapsed(Math.floor((Date.now() - startTime) / 1000));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [forwardId]);

  return (
    <span className="text-[10px] text-orange-400 leading-tight">
      Reconnecting… {elapsed}s
    </span>
  );
}
