import type { SensorNodeData } from "../hooks/useLiveTelemetry";
import stations from "./stations.json";
export interface StationCoordinate { id: string; name: string; latitude: number; longitude: number }
export const NER_STATIONS: StationCoordinate[] = stations;
export type PointLayers = {
  weatherFallback?: boolean;
  weather?: Pick<SensorNodeData, "last_updated" | "soil_moisture" | "rain_24h_obs" | "rain_48h_prior" | "rain_72h_prior" | "rain_7d_prior" | "api_7d">;
  persiann?: {period_start:string; value:number; units:string; file:string};
  hem?: {value: number; units: string; acquired_at: string; filename: string};
  sentinel?: {scene_id: string; acquired_at: string; mean_slope_deg: number; mean_elevation_m: number; candidate_pct: number};
  screen_status?: string;
};
type Snapshot = { checked_at: string; status: {hem: string; weather: string}; points: Record<string, PointLayers> };
declare const __PACKAGED_POINT_SNAPSHOT__: Snapshot;
const packaged = __PACKAGED_POINT_SNAPSHOT__;
let latest: Snapshot = packaged;
let pending: Promise<Snapshot> | undefined;
let nextCheck = 0;

// A station's weather is stale when its timestamp is older than 6 hours.
// This is distinct from the network-level status string, which may say
// "Partial" even when every individual station record was successfully
// fetched and is current.
const STALE_MS = 6 * 60 * 60 * 1000; // 6 hours

function usableWeather(point?: PointLayers) {
  const w = point?.weather;
  return w && Number.isFinite(Date.parse(w.last_updated)) &&
    [w.soil_moisture,w.rain_24h_obs,w.rain_48h_prior,w.rain_72h_prior,w.rain_7d_prior,w.api_7d].every(Number.isFinite);
}

/** True only when the weather record for this specific station is genuinely
 *  stale (older than 6 h) — not because the network request had a partial
 *  error message on a different station. */
function isStaleWeather(w?: PointLayers["weather"]): boolean {
  if (!w) return true;
  const age = Date.now() - Date.parse(w.last_updated);
  return !Number.isFinite(age) || age > STALE_MS;
}

export function readPointSnapshot(): Promise<Snapshot> {
  if (Date.now() < nextCheck) return Promise.resolve(latest);
  if (pending) return pending;
  pending = (async () => {
    let fetched: Snapshot | undefined;
    try {
      const response = await fetch("https://raw.githubusercontent.com/shuvetajovia/Geospacial-Computing-/main/frontend/public/point-snapshot.json", {signal: AbortSignal.timeout(8000), cache:"no-store"});
      if (response.ok) {
        const data = await response.json();
        if (data?.points && Date.parse(data.checked_at) >= Date.parse(latest.checked_at)) fetched = data;
      }
    } catch { /* network unavailable — keep last good record */ }
    const points: Snapshot["points"] = {};
    for (const {id} of stations) {
      const old = latest.points[id] || packaged.points[id] || {};
      const fresh = fetched?.points[id];
      const accept = usableWeather(fresh) && (!usableWeather(old) ||
        Date.parse(fresh!.weather!.last_updated) >= Date.parse(old.weather!.last_updated));
      const chosenWeather = accept ? fresh!.weather : old.weather;
      // Only mark as fallback if the chosen record is actually stale (>6 h old).
      // A "Partial" network status does NOT make fresh per-station data a fallback.
      const isFallback = isStaleWeather(chosenWeather);
      points[id] = {...old, ...fresh, weather: chosenWeather, weatherFallback: isFallback};
    }
    latest = {...(fetched || latest), points};
    nextCheck = Date.now() + (fetched ? 300000 : 60000);
    return latest;
  })().finally(() => { pending = undefined; });
  return pending;
}

export async function fetchLiveMeteorologicalTelemetry(): Promise<SensorNodeData[]> {
  const snapshot = await readPointSnapshot();
  return stations.flatMap(site => {
    const point = snapshot.points[site.id];
    if (!point?.weather) return [];
    return [{...site, ...point.weather, weatherFallback:point.weatherFallback, sentinel:point.sentinel, hem:point.hem, persiann:point.persiann, r24_seasonal_anom: NaN, api_seasonal_anom: NaN}];
  });
}
