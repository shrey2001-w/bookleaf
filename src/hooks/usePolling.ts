"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errMsg } from "@/lib/client";

/**
 * Fetches `url` immediately and then every `intervalMs` while the tab is visible.
 * This is the "near-real-time" mechanism: simple, works on serverless hosts (no sockets to keep alive),
 * and pauses when the tab is hidden to save requests.
 */
export function usePolling<T>(url: string | null, intervalMs = 0) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const alive = useRef(true);

  const load = useCallback(async () => {
    if (!url) return;
    try {
      const d = await api<T>(url);
      if (alive.current) { setData(d); setError(null); }
    } catch (e) {
      if (alive.current) setError(errMsg(e));
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    alive.current = true;
    setLoading(true);
    load();
    let id: ReturnType<typeof setInterval> | undefined;
    if (intervalMs > 0) id = setInterval(() => { if (!document.hidden) load(); }, intervalMs);
    const onVisible = () => { if (!document.hidden && intervalMs > 0) load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { alive.current = false; if (id) clearInterval(id); document.removeEventListener("visibilitychange", onVisible); };
  }, [load, intervalMs]);

  return { data, error, loading, reload: load, setData };
}
