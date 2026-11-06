import { useState, useEffect, useCallback, useRef } from "react";
import { mockApi } from "../services/mockApi";
import { supabase, isSupabaseConfigured, SupabaseAlertRow } from "../services/supabaseClient";
import { fetchLiveMeteorologicalTelemetry } from "../services/liveWeatherService";
import { computeSensorRisk } from "../lib/riskUtils";

export interface SensorNodeData {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  soil_moisture: number;
  rain_24h_obs: number;
  rain_48h_prior: number;
  rain_72h_prior: number;
  rain_7d_prior: number;
  api_7d: number;
  r24_seasonal_anom: number;
  api_seasonal_anom: number;
  last_updated: string;
  weatherFallback?: boolean;
  sentinel?: {acquired_at:string; candidate_pct:number; mean_elevation_m:number; mean_slope_deg:number};
  persiann?: {period_start:string; value:number; units:string; file:string};
  hem?: {acquired_at:string; value:number; units:string};
}

export interface CorridorSection {
  id: number;
  section: string;
  length_km: number;
  risk_score: number;
  risk_probability: number;
  status: string;
  coordinates: [number, number][];
  slope_angle: number;
  elevation: number;
  distance_to_infrastructure: number;
  primary_shap_trigger: string;
  sensor_node_id: string;
}

export interface CorridorData {
  name: string;
  status: string;
  max_risk: number;
  average_risk: number;
  length_km: number;
  sections: CorridorSection[];
}

export interface CAPAlertData {
  identifier: string;
  sender: string;
  sent: string;
  status: string;
  msgType: string;
  scope: string;
  info: {
    category: string;
    event: string;
    urgency: string;
    severity: string;
    certainty: string;
    headline: string;
    description: string;
    instruction?: string;
    senderName: string;
    area: { areaDesc: string; polygon?: string }[];
  }[];
}

// Map Supabase alert row → CAPAlertData
function mapAlertRow(row: SupabaseAlertRow): CAPAlertData {
  return {
    identifier: row.identifier,
    sender: row.sender,
    sent: row.sent,
    status: row.status,
    msgType: row.msg_type,
    scope: row.scope,
    info: [{
      category: row.category,
      event: row.event,
      urgency: row.urgency,
      severity: row.severity,
      certainty: row.certainty,
      headline: row.headline,
      description: row.description ?? "",
      instruction: row.instruction ?? undefined,
      senderName: row.sender,
      area: [{ areaDesc: row.area_desc }],
    }],
  };
}

/**
 * Dynamically updates corridor sections based on live sensor risk scores.
 */
function computeDynamicCorridors(baseCorridors: CorridorData[], sensorList: SensorNodeData[]): CorridorData[] {
  const sensorMap = new Map<string, SensorNodeData>();
  for (const s of sensorList) {
    sensorMap.set(s.id, s);
  }

  return baseCorridors.map((c) => {
    let maxRisk = 0;
    let sumRisk = 0;

    const updatedSections = c.sections.map((sec) => {
      const matchedSensor = sec.sensor_node_id ? sensorMap.get(sec.sensor_node_id) : null;
      let secRiskScore = sec.risk_score;
      let secProb = sec.risk_probability;
      let secStatus = sec.status;

      if (matchedSensor) {
        const risk = computeSensorRisk(matchedSensor);
        secRiskScore = risk.score;
        secProb = risk.prob;
        if (risk.score >= 8.5) secStatus = "BLOCKED";
        else if (risk.score >= 6.8) secStatus = "HIGH RISK";
        else if (risk.score >= 4.0) secStatus = "CAUTION";
        else secStatus = "OPEN";
      }

      if (secRiskScore > maxRisk) maxRisk = secRiskScore;
      sumRisk += secRiskScore;

      return {
        ...sec,
        risk_score: secRiskScore,
        risk_probability: secProb,
        status: secStatus,
      };
    });

    const avgRisk = updatedSections.length > 0 ? sumRisk / updatedSections.length : 0;
    let corridorStatus = "OPEN";
    if (maxRisk >= 8.5) corridorStatus = "BLOCKED";
    else if (maxRisk >= 6.8) corridorStatus = "HIGH RISK";
    else if (maxRisk >= 4.0) corridorStatus = "CAUTION";

    return {
      ...c,
      status: corridorStatus,
      max_risk: Math.round(maxRisk * 10) / 10,
      average_risk: Math.round(avgRisk * 10) / 10,
      sections: updatedSections,
    };
  });
}

// Global shared state across hooks to prevent duplicate fetches & flash of empty content
let globalSensors: SensorNodeData[] = [];
let globalCorridors: CorridorData[] = [];
let globalAlerts: CAPAlertData[] = [];

export function useLiveTelemetry(
  apiBaseUrl: string,
  refreshIntervalMs: number = 30000
) {
  const [sensors, setSensors] = useState<SensorNodeData[]>(() => globalSensors);
  const [corridors, setCorridors] = useState<CorridorData[]>(() => globalCorridors);
  const [alerts, setAlerts] = useState<CAPAlertData[]>(() => globalAlerts);
  const [loading, setLoading] = useState<boolean>(() => globalSensors.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [isOfflineFallback, setIsOfflineFallback] = useState<boolean>(false);
  const realtimeChannelRef = useRef<ReturnType<NonNullable<typeof supabase>["channel"]> | null>(null);

  // Clear stale persisted mock drift from localStorage
  useEffect(() => {
    try {
      localStorage.removeItem("mindmeld_sensors");
    } catch (_) {}
  }, []);

  // ── Unified live data fetch ──────────────────────────────
  const fetchTelemetry = useCallback(async () => {
    try {
      // 1. Fetch live real-time meteorological telemetry across all 41 stations
      const liveSensors = await fetchLiveMeteorologicalTelemetry();
      
      // 2. Fetch active CAP alerts from Supabase if configured
      let activeAlerts: CAPAlertData[] = [];
      if (supabase && isSupabaseConfigured) {
        try {
          const { data: alertRows } = await supabase
            .from("cap_alerts")
            .select("*")
            .eq("status", "Actual")
            .order("sent", { ascending: false });
          if (alertRows && alertRows.length > 0) {
            activeAlerts = (alertRows as SupabaseAlertRow[]).map(mapAlertRow);
          }
        } catch (_) {}
      }

      if (activeAlerts.length === 0) {
        activeAlerts = [];
      }

      // 3. Compute dynamic corridor statuses based on live station telemetry
      const baseCorridors = mockApi.getCorridors();
      const dynamicCorridors = computeDynamicCorridors(baseCorridors, liveSensors);

      globalSensors = liveSensors;
      globalCorridors = dynamicCorridors;
      globalAlerts = activeAlerts;

      setSensors(liveSensors);
      setCorridors(dynamicCorridors);
      setAlerts(activeAlerts);
      setIsOfflineFallback(false);
      setError(null);
      setLoading(false);
    } catch (err: any) {
      console.warn("[useLiveTelemetry] Fallback notice:", err?.message);
      
      const fallbackSensors = globalSensors;
      const fallbackCorridors = computeDynamicCorridors(mockApi.getCorridors(), fallbackSensors);
      const fallbackAlerts = globalAlerts;

      globalSensors = fallbackSensors;
      globalCorridors = fallbackCorridors;
      globalAlerts = fallbackAlerts;

      setSensors(fallbackSensors);
      setCorridors(fallbackCorridors);
      setAlerts(fallbackAlerts);
      setError("Showing latest stored point data where available.");
      setIsOfflineFallback(true);
      setLoading(false);
    }
  }, []);

  // ── Supabase Realtime subscription ──────────────────────
  useEffect(() => {
    if (!supabase || !isSupabaseConfigured) return;

    const channelId = `sensor-live-feed-${Math.random().toString(36).substring(7)}`;
    const channel = supabase!
      .channel(channelId)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cap_alerts" },
        () => {
          supabase!
            .from("cap_alerts")
            .select("*")
            .eq("status", "Actual")
            .order("sent", { ascending: false })
            .then(({ data }) => {
              if (data) setAlerts((data as SupabaseAlertRow[]).map(mapAlertRow));
            });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sensor_nodes" },
        () => {
          fetchTelemetry();
        }
      )
      .subscribe();

    realtimeChannelRef.current = channel;
    return () => {
      supabase!.removeChannel(channel);
    };
  }, [fetchTelemetry]);

  // ── Initial fetch + live polling interval ────────────────
  useEffect(() => {
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, refreshIntervalMs);
    return () => clearInterval(interval);
  }, [fetchTelemetry, refreshIntervalMs]);

  return {
    sensors,
    corridors,
    alerts,
    loading,
    error,
    isOfflineFallback,
    isSupabaseLive: isSupabaseConfigured && !isOfflineFallback,
    refresh: fetchTelemetry,
  };
}
