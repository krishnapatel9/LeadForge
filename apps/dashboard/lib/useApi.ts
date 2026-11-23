"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiErrorMessage, apiFetch } from "./api";

/**
 * Loads JSON from the API. There is deliberately no fallback data: when the
 * request fails the page shows `error`, never made-up rows.
 */
export function useApi<T>(path: string | null, opts: { pollMs?: number } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(path !== null);
  const pathRef = useRef(path);
  pathRef.current = path;

  const load = useCallback(async (silent = false) => {
    const current = pathRef.current;
    if (!current) return;
    if (!silent) setLoading(true);
    try {
      const res = await apiFetch(current);
      if (pathRef.current !== current) return; // a newer request superseded this one
      if (!res.ok) {
        setError(await apiErrorMessage(res, `Couldn't load data (${res.status}).`));
        return;
      }
      setData((await res.json()) as T);
      setError(null);
    } catch {
      if (pathRef.current === current) setError("Can't reach the LeadForge API. Check that it is running.");
    } finally {
      if (pathRef.current === current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!path) {
      setData(null);
      setLoading(false);
      return;
    }
    load();
    if (!opts.pollMs) return;
    const id = setInterval(() => load(true), opts.pollMs);
    return () => clearInterval(id);
  }, [path, opts.pollMs, load]);

  return { data, error, loading, reload: load, setData };
}

/** POST/PATCH helper: returns parsed JSON, or throws an Error with the API's message. */
export async function apiSend<T = unknown>(
  path: string,
  method: "POST" | "PATCH" = "POST",
  body?: unknown,
  fallback = "Request failed."
): Promise<T> {
  let res: Response;
  try {
    res = await apiFetch(path, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error("Can't reach the LeadForge API. Check that it is running.");
  }
  if (!res.ok) throw new Error(await apiErrorMessage(res, fallback));
  return (await res.json()) as T;
}

/** Tells the header (approval badge, status) that leads or drafts just changed. */
export const PIPELINE_EVENT = "lf-pipeline-change";
export function notifyPipelineChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(PIPELINE_EVENT));
}
