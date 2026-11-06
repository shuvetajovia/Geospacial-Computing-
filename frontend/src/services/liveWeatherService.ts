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

function usableWeather(point?: PointLayers) {
  const w = point?.weather;
  return w && Number.isFinite(Date.parse(w.last_updated)) &&
    [w.soil_moisture,w.rain_24h_obs,w.rain_48h_prior,w.rain_72h_prior,w.rain_7d_prior,w.api_7d].every(Number.isFinite);
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
    } catch { /* Use the saved record for each station below. */ }
    const points: Snapshot["points"] = {};
    for (const {id} of stations) {
      const old = latest.points[id] || packaged.points[id] || {};
      const fresh = fetched?.points[id];
      const accept = usableWeather(fresh) && (!usableWeather(old) ||
        Date.parse(fresh!.weather!.last_updated) >= Date.parse(old.weather!.last_updated));
      points[id] = {...old, ...fresh, weather:accept ? fresh!.weather : old.weather,
        weatherFallback:!accept || (fresh?.weatherFallback ??
          (fetched?.status?.weather?.startsWith("Partial") && fresh?.weather?.last_updated === old.weather?.last_updated))};
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
