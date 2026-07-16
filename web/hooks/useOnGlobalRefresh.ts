"use client";

import { useEffect } from "react";
import { GRAMPULSE_REFRESHED_EVENT } from "@/components/BulkRefreshProvider";

export function useOnGlobalRefresh(callback: () => void) {
  useEffect(() => {
    const handler = () => callback();
    window.addEventListener(GRAMPULSE_REFRESHED_EVENT, handler);
    return () => window.removeEventListener(GRAMPULSE_REFRESHED_EVENT, handler);
  }, [callback]);
}
