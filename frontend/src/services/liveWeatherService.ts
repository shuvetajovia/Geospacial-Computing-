import type { SensorNodeData } from "../hooks/useLiveTelemetry";
import stations from "./stations.json";
export interface StationCoordinate { id: string; name: string; latitude: number; longitude: number }
export const NER_STATIONS: StationCoordinate[] = stations;
export type PointLayers = {
  weather?: Pick<SensorNodeData, "last_updated" | "soil_moisture" | "rain_24h_obs" | "rain_48h_prior" | "rain_72h_prior" | "rain_7d_prior" | "api_7d">;
  persiann?: {period_start:string; value:number; units:string; file:string};
  hem?: {value: number; units: string; acquired_at: string; filename: string};
  sentinel?: {scene_id: string; acquired_at: string; mean_slope_deg: number; mean_elevation_m: number; candidate_pct: number};
  screen_status?: string;
};
type Snapshot = { checked_at: string; status: {hem: string; weather: string}; points: Record<string, PointLayers> };
let latest: Snapshot | undefined;
let pending: Promise<Snapshot> | undefined;
let nextCheck = 0;
export async function readPointSnapshot(): Promise<Snapshot> {
  if (latest && Date.now() < nextCheck) return latest;
  if (pending) return pending;
  pending = (async () => {
    for (const url of ["https://raw.githubusercontent.com/shuvetajovia/Geospacial-Computing-/main/frontend/public/point-snapshot.json", import.meta.env.BASE_URL + "point-snapshot.json"]) {
      try {
        const response = await fetch(url, {signal: AbortSignal.timeout(8000)});
        if (!response.ok) continue;
        const value: Snapshot = await response.json();
        if (!value.points || !Number.isFinite(Date.parse(value.checked_at))) continue;
        if (!latest || Date.parse(value.checked_at) >= Date.parse(latest.checked_at)) latest = value;
        nextCheck = Date.now() + 300000;
        return latest;
      } catch { /* Try the deployed snapshot. */ }
    }
    if (latest) return latest;
    throw new Error("Point acquisition snapshot unavailable");
  })().finally(() => { pending = undefined; });
  return pending;
}
export async function fetchLiveMeteorologicalTelemetry(): Promise<SensorNodeData[]> {
  const snapshot = await readPointSnapshot();
  return stations.flatMap(site => {
    const point = snapshot.points[site.id];
    if (!point?.weather) return [];
    return [{...site, ...point.weather, sentinel:point.sentinel, hem:point.hem, persiann:point.persiann, r24_seasonal_anom: NaN, api_seasonal_anom: NaN}];
  });
}
