import React, { useEffect, useState } from "react";
import { NER_STATIONS, readPointSnapshot } from "../services/liveWeatherService";
export function AcquisitionPanel({ stationId }: { stationId?: string }) {
  const [id,setId] = useState(NER_STATIONS[0].id);
  const [data,setData] = useState<Awaited<ReturnType<typeof readPointSnapshot>>>();
  const [error,setError] = useState("");
  useEffect(() => {
    let active=true;
    const load=()=>readPointSnapshot().then(v=>{if(active){setData(v); setError("");}}).catch(()=>{if(active)setError("Snapshot unavailable");});
    void load(); const tick=setInterval(load,300000);
    return ()=>{active=false;clearInterval(tick);};
  },[]);
  const p=data?.points[stationId || id];
  const age=(s:string)=>Date.now()-Date.parse(s)>3*3600000 ? " · older than 3 hours" : "";
  const time=(s:string)=>new Date(s).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})+" IST";
  return <section className="rounded-2xl border border-borderColor bg-bgCard p-5 space-y-3 text-xs text-textSecondary">
    <h2 className="font-bold text-textPrimary">Point acquisition workflow</h2>
    <p>Acquire rainfall and soil moisture → sample the satellite rainfall grid → screen a point with Sentinel‑2 → retain the newest successful record from each source.</p>
    {!stationId && <label>Monitoring point <select value={id} onChange={e=>setId(e.target.value)} className="block w-full rounded border border-borderColor bg-bgPrimary p-2">{NER_STATIONS.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
    {error && <p>{error}</p>}
    <p>{data ? 'Last acquisition attempt '+time(data.checked_at) : 'Loading acquisition record…'}</p>
    <p><strong>Weather model · Open-Meteo</strong><br/>{p?.weather ? p.weather.rain_24h_obs+' mm in 24 h · '+p.weather.soil_moisture+'% surface soil moisture (0–1 cm) · '+time(p.weather.last_updated)+age(p.weather.last_updated) : 'Awaiting a complete weather record.'}</p>
    <p><strong>Satellite rainfall · MOSDAC HEM</strong><br/>{p?.hem ? p.hem.value+' '+p.hem.units+' · '+time(p.hem.acquired_at) : data?.status.hem || 'Awaiting acquisition'}</p>
    <p><strong>Sentinel‑2 screening and terrain</strong><br/>{p?.sentinel ? p.sentinel.candidate_pct+'% candidate pixels in the screened patch · '+p.sentinel.mean_slope_deg+'° mean slope · '+p.sentinel.mean_elevation_m+' m mean elevation · scene acquired '+time(p.sentinel.acquired_at) : 'Awaiting successful screening at this point.'}{p?.screen_status && ' Latest attempt: '+p.screen_status}</p>
    <p>Ground instruments: disconnected. Pore pressure and tilt are unavailable. Estimating pore pressure in kPa requires groundwater or calibrated soil parameters.</p>
  </section>;
}
