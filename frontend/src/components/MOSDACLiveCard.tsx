import React, { useEffect, useState } from "react";
import { Clock3, ExternalLink, Radio } from "lucide-react";

interface FeedState {
  source: string;
  dataset_id: string;
  product: string;
  cadence_minutes: number;
  state: string;
  updated_at: string | null;
  age_minutes: number | null;
  filename: string | null;
  download_requires_registered_login: boolean;
}

export const MOSDACLiveCard: React.FC<{ apiBaseUrl: string }> = ({ apiBaseUrl }) => {
  const [feed, setFeed] = useState<FeedState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  useEffect(() => {
    let active = true;
    const fetchFeed = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/v1/mosdac/latest`, { cache: "no-store" });
        if (!response.ok) throw new Error(`MOSDAC API returned ${response.status}`);
        const value = await response.json();
        if (active) { setFeed(value); setError(null); setCheckedAt(new Date()); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Could not reach MOSDAC.");
      }
    };
    void fetchFeed();
    const interval = window.setInterval(fetchFeed, 15 * 60 * 1000);
    return () => { active = false; window.clearInterval(interval); };
  }, [apiBaseUrl]);

  const current = feed?.state === "CURRENT";
  return (
    <section className="rounded-2xl border border-borderColor bg-bgCard p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-2 text-cyan-500"><Radio className="h-4 w-4" /></div>
          <div>
            <h2 className="text-xs font-black uppercase text-textPrimary">Live MOSDAC · INSAT‑3DR</h2>
            <p className="mt-1 text-[10px] font-semibold text-textSecondary">{feed?.product || "Hydro-Estimator rainfall product"} · published every 30 minutes</p>
          </div>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase ${current ? "border-alertGreen/30 bg-alertGreen/10 text-alertGreen" : "border-alertOrange/30 bg-alertOrange/10 text-alertOrange"}`}>
          {error ? "API unavailable" : feed?.state?.replaceAll("_", " ") || "Checking catalog"}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-borderColor pt-3 text-[10px] text-textSecondary">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {feed?.filename && <span className="font-mono">{feed.filename}</span>}
          {feed?.updated_at && <span className="flex items-center gap-1"><Clock3 className="h-3 w-3" /> Source timestamp {new Date(feed.updated_at).toLocaleString("en-GB", { timeZone: "UTC", timeZoneName: "short" })} · {feed.age_minutes} min ago</span>}
          {error && <span>{error}</span>}
          {!error && !feed?.updated_at && <span>Waiting for a catalog granule in the Northeast search area.</span>}
        </div>
        <div className="flex items-center gap-3">
          {checkedAt && <span className="text-textMuted">Catalog checked {checkedAt.toLocaleTimeString()}</span>}
          <a href="https://mosdac.gov.in/doi/181/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-blue-500 underline">Product details <ExternalLink className="h-3 w-3" /></a>
        </div>
      </div>
      <p className="mt-2 text-[9px] font-semibold text-textMuted">Live catalog metadata only; registered MOSDAC login is required to download the HDF5 raster. This half-hourly satellite product is not a 15-minute ground sensor feed.</p>
    </section>
  );
};
