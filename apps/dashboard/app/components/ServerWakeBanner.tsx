"use client";

import { useEffect, useState } from "react";
import { SERVER_WAKING_EVENT, wakeApi } from "../../lib/api";

/** Wakes the API on load, and shows a notice while requests wait for it to start. */
export default function ServerWakeBanner() {
  const [waking, setWaking] = useState(false);

  useEffect(() => {
    wakeApi();
    const onChange = (e: Event) => setWaking((e as CustomEvent<boolean>).detail);
    window.addEventListener(SERVER_WAKING_EVENT, onChange);
    return () => window.removeEventListener(SERVER_WAKING_EVENT, onChange);
  }, []);

  if (!waking) return null;
  return (
    <div className="wake-banner inv" role="status" aria-live="polite">
      <i className="dot hollow" aria-hidden="true" />
      <p>
        <b>Starting the server…</b> This can take up to a minute. Your request will go through on its own.
      </p>
    </div>
  );
}
