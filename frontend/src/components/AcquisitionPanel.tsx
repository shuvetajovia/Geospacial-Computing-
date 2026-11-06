import React, { useEffect, useState } from "react";
import { NER_STATIONS, readPointSnapshot } from "../services/liveWeatherService";
export function AcquisitionPanel({ stationId }: { stationId?: string }) {
  const [id,setId] = useState(NER_STATIONS[0].id);
  const [data,setData] = useState<Awaited<ReturnType<typeof readPointSnapshot>>>();
  const [texture,setTexture] = useState("");
  const [error,setError] = useState("");
  useEffect(() => {
    let active=true;
    const load=()=>readPointSnapshot().then(v=>{if(active){setData(v); setError("");}}).catch(()=>{if(active)setError("Snapshot unavailable");});
    void load(); const tick=setInterval(load,300000);
    return ()=>{active=false;clearInterval(tick);};
  },[]);
  const p=data?.points[stationId || id];
  // Carsel & Parrish mean retention curves: theta_r, theta_s, alpha (1/cm), n.
  const curves: Record<string, number[]> = { "Sandy loam":[0.065,0.41,0.075,1.89], "Loam":[0.078,0.43,0.036,1.56], "Clay loam":[0.095,0.41,0.019,1.31] };
  const curve = curves[texture];
  const theta = p?.weather ? p.weather.soil_moisture/100 : undefined;
  let suction: number | undefined;
  if (curve && theta !== undefined) {
    const [residual, saturated, alpha, n] = curve;
    const saturation = (theta-residual)/(saturated-residual);
    if (saturation > 0 && saturation < 1) {
      const headCm = (saturation ** (-1/(1-1/n)) - 1) ** (1/n) / alpha;
      suction = headCm * 0.0980665;
    }
  }
  const age=(s:string)=>Date.now()-Date.parse(s)>3*3600000 ? " · older than 3 hours" : "";
  const time=(s:string)=>new Date(s).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})+" IST";
  return <section className="rounded-2xl border border-borderColor bg-bgCard p-5 space-y-3 text-xs text-textSecondary">
    <h2 className="font-bold text-textPrimary">Point acquisition workflow</h2>
    <p>Acquire rainfall and soil moisture → sample the satellite rainfall grid → screen a point with Sentinel‑2 → retain the newest successful record from each source.</p>
    {!stationId && <label>Monitoring point <select value={id} onChange={e=>setId(e.target.value)} className="block w-full rounded border border-borderColor bg-bgPrimary p-2">{NER_STATIONS.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
    {error && <p>{error}</p>}
    <p>{data ? 'Last acquisition attempt '+time(data.checked_at) : 'Loading acquisition record…'}</p>
    <p><strong>Weather model · Open-Meteo</strong><br/>{p?.weather ? p.weather.rain_24h_obs+' mm in 24 h · '+p.weather.soil_moisture+'% surface soil moisture (0–1 cm) · '+time(p.weather.last_updated)+age(p.weather.last_updated) : 'Awaiting a complete weather record.'}</p>
    <p><strong>Satellite rainfall · UCI PERSIANN</strong><br/>{p?.persiann ? p.persiann.value+" mm in 24 h · "+p.persiann.period_start.slice(0,10)+" UTC · 0.25° grid" : "Awaiting a valid rainfall pixel."} <a className="underline" href="https://persiann.eng.uci.edu/CHRSdata/PERSIANN/daily/">Source archive</a></p>
    <p><strong>Additional satellite source · MOSDAC HEM</strong><br/>{p?.hem ? p.hem.value+' '+p.hem.units+' · '+time(p.hem.acquired_at) : data?.status.hem || 'Awaiting acquisition'}</p>
    <p><strong>Sentinel‑2 screening and terrain</strong><br/>{p?.sentinel ? p.sentinel.candidate_pct+'% candidate pixels in the screened patch · '+p.sentinel.mean_slope_deg+'° mean slope · '+p.sentinel.mean_elevation_m+' m mean elevation · scene acquired '+time(p.sentinel.acquired_at) : 'Awaiting successful screening at this point.'}{p?.screen_status && ' Latest attempt: '+p.screen_status}</p>
    <div><strong>Surface soil suction scenario</strong>
      <p>Use the modeled moisture in the top centimetre to explore an assumed soil texture. The result describes unsaturated surface soil. Deep slope pressure needs groundwater data.</p>
      <label>Assumed texture <select className="rounded border border-borderColor bg-bgPrimary p-1" value={texture} onChange={e=>setTexture(e.target.value)}><option value="">Choose a texture</option>{Object.keys(curves).map(t=><option key={t}>{t}</option>)}</select></label>
      {texture && <p>{suction === undefined ? "Moisture lies outside this curve or is missing." : "Estimated matric suction: "+suction.toPrecision(3)+" kPa (positive suction magnitude)."}</p>}
      <a className="underline" href="https://www.ars.usda.gov/arsuserfiles/20360500/pdf_pubs/P1228.pdf">Soil retention parameters · Table 4</a>
    </div>
  </section>;
}
