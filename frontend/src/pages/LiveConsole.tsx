import React, { useEffect, useState } from "react";
import { Activity, Clock3, Loader2, MapPin, Radio, Satellite } from "lucide-react";
import { MOSDACLiveCard } from "../components/MOSDACLiveCard";
import { SARInspector } from "../components/SARInspector";

import { API_BASE_URL } from "../services/apiConfig";
const NORTHEAST_STATES = ["Arunachal Pradesh", "Assam", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Sikkim", "Tripura"];

interface DistrictPlace {
  name: string;
  latitude: number;
  longitude: number;
}

export const LiveConsole: React.FC = () => {
  const [sentinelOpen, setSentinelOpen] = useState(false);
  const [selectedState, setSelectedState] = useState("");
  const [districts, setDistricts] = useState<DistrictPlace[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [districtsLoading, setDistrictsLoading] = useState(false);
  const [districtReference, setDistrictReference] = useState(false);
  const [districtRetry, setDistrictRetry] = useState(0);
  const [districtError, setDistrictError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setDistrictsLoading(false);
    setDistrictReference(false);
    setDistricts([]);
    setSelectedDistrict("");
    setDistrictError(null);
    if (!selectedState) return () => { active = false; };

    const loadDistricts = async () => {
      setDistrictsLoading(true);
      const timeout = window.setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetch(`/api/v1/districts?state=${encodeURIComponent(selectedState)}`, { signal: controller.signal });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.detail || `District lookup returned ${response.status}.`);
        if (!Array.isArray(payload?.districts) || !payload.districts.length) throw new Error("No district centers returned. Please retry.");
        if (active) setDistricts(payload.districts);
      } catch (cause) {
        try {
          const fallbackResponse = await fetch(`${import.meta.env.BASE_URL}districts-reference.json`);
          if (!fallbackResponse.ok) throw new Error("Reference map unavailable");
          const reference = await fallbackResponse.json();
          const items = reference.states?.[selectedState];
          if (!Array.isArray(items) || !items.length) throw new Error("Reference districts missing");
          if (active) {
            setDistricts(items);
            setDistrictReference(true);
            setDistrictError("Live district lookup unavailable. Showing reference map data retrieved 6 Nov 2026; names may lag administrative changes. Coordinates are approximate map centers, not verified district headquarters.");
          }
        } catch {
          if (active) setDistrictError(cause instanceof Error ? cause.message : "Could not load district list.");
        }
      } finally {
        window.clearTimeout(timeout);
        if (active) setDistrictsLoading(false);
      }
    };

    void loadDistricts();
    return () => { active = false; controller.abort(); };
  }, [selectedState, districtRetry]);

  const district = districts.find((item) => item.name === selectedDistrict);
  return (
    <main className="min-h-screen bg-bgPrimary px-4 py-6 text-textPrimary sm:px-7">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-borderColor bg-bgCard p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-3 text-blue-500"><Activity className="h-6 w-6" /></div>
            <div><div className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">MindMeld · live console</div><h1 className="mt-1 text-xl font-black">Northeast India landslide data watch</h1><p className="mt-1 text-xs text-textSecondary">Current-source status and on-demand satellite screening.</p></div>
          </div>
          <div className="rounded-full border border-alertOrange/30 bg-alertOrange/5 px-3 py-1.5 text-[9px] font-black uppercase text-alertOrange">Research use · no evacuation decisions</div>
        </header>

        <MOSDACLiveCard apiBaseUrl={API_BASE_URL} />

        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-borderColor bg-bgCard p-5">
            <div className="flex items-center gap-2 text-blue-500"><Satellite className="h-4 w-4" /><h2 className="text-xs font-black uppercase text-textPrimary">Sentinel‑2 screening</h2></div>
            <p className="mt-2 text-xs leading-relaxed text-textSecondary">Choose a state and district. District centers are requested from OpenStreetMap, with labeled reference map data during outages; Sentinel searches around that district center and runs the research model when its live scene inputs are available.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-[10px] font-bold uppercase text-textMuted">State
                <select value={selectedState} onChange={(event) => setSelectedState(event.target.value)} className="mt-1 block w-full rounded-lg border border-borderColor bg-bgPrimary px-3 py-2 text-xs text-textPrimary">
                  <option value="">Select a Northeast state</option>
                  {NORTHEAST_STATES.map((state) => <option key={state} value={state}>{state}</option>)}
                </select>
              </label>
              <label className="text-[10px] font-bold uppercase text-textMuted">District
                <select value={selectedDistrict} onChange={(event) => setSelectedDistrict(event.target.value)} disabled={!selectedState || districtsLoading || districts.length === 0} className="mt-1 block w-full rounded-lg border border-borderColor bg-bgPrimary px-3 py-2 text-xs text-textPrimary disabled:opacity-60">
                  <option value="">{districtsLoading ? "Loading districts…" : "Select a district"}</option>
                  {districts.map((place) => <option key={place.name} value={place.name}>{place.name}</option>)}
                </select>
              </label>
            </div>
            {districtsLoading && <div className="mt-3 flex items-center gap-2 text-[10px] font-semibold text-textMuted"><Loader2 className="h-3.5 w-3.5 animate-spin" />Loading current district boundaries from OpenStreetMap…</div>}
            {districtError && <p className="mt-3 rounded-lg border border-alertOrange/30 bg-alertOrange/5 p-2 text-[10px] font-semibold text-alertOrange">{districtError} <button type="button" onClick={() => setDistrictRetry(value => value + 1)} className="ml-2 underline">Retry district lookup</button></p>}
            <p className="mt-2 text-[9px] text-textMuted">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">OpenStreetMap contributors</a> · <a href={`${import.meta.env.BASE_URL}DISTRICT_DATA_ATTRIBUTION.md`} target="_blank" rel="noreferrer" className="underline">Reference map source & license</a></p>
            {district && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-borderColor bg-bgPrimary p-3">
              <div className="text-[10px] text-textSecondary"><strong className="text-textPrimary">{district.name}, {selectedState}</strong><br />{districtReference ? "Approximate reference center" : "Map boundary center"}: {district.latitude.toFixed(4)}°N, {district.longitude.toFixed(4)}°E</div>
              <button onClick={() => setSentinelOpen(true)} className="rounded-lg bg-blue-600 px-4 py-2.5 text-[10px] font-black uppercase text-white hover:bg-blue-700">Check live scene & screen</button>
            </div>}
            <p className="mt-3 text-[9px] font-semibold text-textMuted">Sentinel revisit and processing cadence is days, not 15 minutes. Candidate masks are not confirmed landslides.</p>
          </article>

          <article className="rounded-2xl border border-borderColor bg-bgCard p-5">
            <div className="flex items-center gap-2 text-cyan-500"><Radio className="h-4 w-4" /><h2 className="text-xs font-black uppercase text-textPrimary">Ground telemetry</h2></div>
            <p className="mt-2 text-xs leading-relaxed text-textSecondary">There is no physical IoT gateway connected. Soil moisture and pore pressure can be shown as derived estimates from live satellite rainfall plus terrain, clearly labeled as estimates rather than sensor measurements. This page currently reads MOSDAC catalog metadata only; it does not yet download or process the HDF rainfall raster needed to calculate those estimates.</p>
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-borderColor bg-bgPrimary p-3 text-[10px] font-bold text-textMuted"><Clock3 className="h-4 w-4" /> Derived estimates are approved; live raster ingestion is the remaining data step.</div>
          </article>
        </section>

        <section className="rounded-2xl border border-borderColor bg-bgCard p-5">
          <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-blue-500" /><h2 className="text-xs font-black uppercase">Source and model rules</h2></div>
          <ul className="mt-3 grid gap-2 text-[10px] leading-relaxed text-textSecondary sm:grid-cols-3">
            <li className="rounded-xl bg-bgPrimary p-3">District centers use OpenStreetMap geography. Reference map fallback is labeled and contains no live weather or sensor readings.</li>
            <li className="rounded-xl bg-bgPrimary p-3">The detector checks a small patch around the selected district center, not the entire district.</li>
            <li className="rounded-xl bg-bgPrimary p-3">Inference is withheld when source bands, cloud masks, or terrain inputs are missing.</li>
          </ul>
        </section>
        <footer className="px-2 text-[9px] font-semibold text-textMuted">Research console · live-source availability depends on upstream services.</footer>
      </div>
      {sentinelOpen && district && <SARInspector apiBaseUrl={API_BASE_URL} initialLocation={{ ...district, label: `${district.name}, ${selectedState}` }} onClose={() => setSentinelOpen(false)} />}
    </main>
  );
};

export default LiveConsole;
