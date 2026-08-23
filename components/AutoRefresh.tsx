"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "./Icon";

const OPTIONS = [0, 15, 30, 60];

/**
 * Re-runs the server components on an interval. Data fetching stays
 * entirely server-side; the browser only triggers a refresh.
 */
export default function AutoRefresh() {
  const router = useRouter();
  const [seconds, setSeconds] = useState(30);

  useEffect(() => {
    if (!seconds) return;
    const id = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(id);
  }, [seconds, router]);

  return (
    <label className="autorefresh">
      <Icon name={seconds ? "sync" : "synced"} size={16} />
      Live refresh
      <select
        value={seconds}
        onChange={(e) => setSeconds(Number(e.target.value))}
      >
        {OPTIONS.map((o) => (
          <option key={o} value={o}>
            {o === 0 ? "Off" : `${o}s`}
          </option>
        ))}
      </select>
    </label>
  );
}
