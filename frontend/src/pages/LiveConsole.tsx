import React, { useState } from "react";
import { Activity, Clock3, MapPin, Radio, Satellite } from "lucide-react";
import { MOSDACLiveCard } from "../components/MOSDACLiveCard";
import { SARInspector } from "../components/SARInspector";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const LiveConsole: React.FC = () => {
  const [sentinelOpen, setSentinelOpen] = useState(false);
  return (
    <main className="min-h-screen bg-bgPrimary px-4 py-6 text-textPrimary sm:px-7">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-borderColor bg-bgCard p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-3 text-blue-500"><Activity className="h-6 w-6" /></div>
            <div><div className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">MindMeld · Local live console</div><h1 className="mt-1 text-xl font-black">Northeast India landslide data watch</h1><p className="mt-1 text-xs text-textSecondary">Current-source status and on-demand satellite screening.</p></div>
          </div>
          <div className="rounded-full border border-alertOrange/30 bg-alertOrange/5 px-3 py-1.5 text-[9px] font-black uppercase text-alertOrange">Research use · no evacuation decisions</div>
        </header>

        <MOSDACLiveCard apiBaseUrl={API_BASE_URL} />

        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-borderColor bg-bgCard p-5">
            <div className="flex items-center gap-2 text-blue-500"><Satellite className="h-4 w-4" /><h2 className="text-xs font-black uppercase text-textPrimary">Sentinel‑2 screening</h2></div>
            <p className="mt-2 text-xs leading-relaxed text-textSecondary">Search the live public scene catalog for a Northeast location, read the scene rasters, then run the local research segmentation model when the complete input stack is available.</p>
            <button onClick={() => setSentinelOpen(true)} className="mt-4 rounded-lg bg-blue-600 px-4 py-2.5 text-[10px] font-black uppercase text-white hover:bg-blue-700">Check scene & run screening</button>
            <p className="mt-3 text-[9px] font-semibold text-textMuted">Sentinel revisit and processing cadence is days, not 15 minutes. Candidate masks are not confirmed landslides.</p>
          </article>

          <article className="rounded-2xl border border-borderColor bg-bgCard p-5">
            <div className="flex items-center gap-2 text-cyan-500"><Radio className="h-4 w-4" /><h2 className="text-xs font-black uppercase text-textPrimary">Ground telemetry</h2></div>
            <p className="mt-2 text-xs leading-relaxed text-textSecondary">No physical IoT gateway is configured in this local clone. The screen will not invent piezometer, inclinometer, or rainfall-station readings.</p>
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-borderColor bg-bgPrimary p-3 text-[10px] font-bold text-textMuted"><Clock3 className="h-4 w-4" /> Waiting for a live station endpoint and validated field mapping</div>
          </article>
        </section>

        <section className="rounded-2xl border border-borderColor bg-bgCard p-5">
          <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-blue-500" /><h2 className="text-xs font-black uppercase">Source and model rules</h2></div>
          <ul className="mt-3 grid gap-2 text-[10px] leading-relaxed text-textSecondary sm:grid-cols-3">
            <li className="rounded-xl bg-bgPrimary p-3">Only the Northeast India bounds are accepted by the detector.</li>
            <li className="rounded-xl bg-bgPrimary p-3">Live source timestamps remain attached to every displayed observation.</li>
            <li className="rounded-xl bg-bgPrimary p-3">Inference is withheld when source bands, cloud masks, or terrain inputs are missing.</li>
          </ul>
        </section>
        <footer className="px-2 text-[9px] font-semibold text-textMuted">Research console · live-source availability depends on upstream services.</footer>
      </div>
      {sentinelOpen && <SARInspector apiBaseUrl={API_BASE_URL} onClose={() => setSentinelOpen(false)} />}
    </main>
  );
};

export default LiveConsole;
