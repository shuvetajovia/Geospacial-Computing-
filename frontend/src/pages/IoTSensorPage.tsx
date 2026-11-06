import React, { useState } from "react";
import { Radio, RefreshCw } from "lucide-react";
import { useLiveTelemetry } from "../hooks/useLiveTelemetry";
import { AlertsBanner } from "../components/AlertsBanner";
import { AcquisitionPanel } from "../components/AcquisitionPanel";
import { computeSensorRisk, summarizeRiskCounts } from "../lib/riskUtils";

interface IoTSensorPageProps {
  apiBaseUrl: string;
}

export const IoTSensorPage: React.FC<IoTSensorPageProps> = ({ apiBaseUrl }) => {
  const { sensors, alerts, loading, refresh } = useLiveTelemetry(apiBaseUrl, 10000);
  const [selectedSensorId, setSelectedSensorId] = useState<string>("SN-ASM-GUA-01");

  const selectedSensor = sensors.find(s => s.id === selectedSensorId) || sensors[0] || null;

  const handleRefresh = () => {
    refresh();
  };

  // Network-wide risk breakdown
  const riskSummary = summarizeRiskCounts(sensors);

  // Use shared risk engine — consistent with map and dashboard
  const alertStatus = selectedSensor
    ? (() => {
        const r = computeSensorRisk(selectedSensor);
        return { label: r.label, color: r.tailwindText, bg: `${r.tailwindBg} ${r.tailwindBorder}`, score: r.score };
      })()
    : { label: "No Data", color: "text-textMuted", bg: "bg-bgPrimary", score: 0 };

  // Group sensors by state for the dropdown
  const stateGroups: Record<string, typeof sensors> = {};
  sensors.forEach(s => {
    const parts = s.id.split("-");
    const key = parts[1] || "OTHER";
    if (!stateGroups[key]) stateGroups[key] = [];
    stateGroups[key].push(s);
  });

  const stateLabels: Record<string, string> = {
    ASM: "Assam", MEG: "Meghalaya", SKM: "Sikkim", NGL: "Nagaland",
    MZR: "Mizoram", MNP: "Manipur", ARN: "Arunachal Pradesh", TPR: "Tripura"
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto text-textPrimary">
      {/* Alerts Banner */}
      <AlertsBanner alerts={alerts} />

      {/* Page Header + Station Selector */}
      <div className="glass-panel rounded-2xl p-5 bg-bgCard border border-borderColor shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-blue-600/10 text-blue-600 border border-blue-600/15 shadow-sm shrink-0">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-textPrimary uppercase tracking-tight">
                IoT Sensor Grid & Telemetry
              </h2>
              <p className="text-[10px] text-textSecondary leading-snug mt-0.5">
                {sensors.length} monitoring points with stored weather-model readings across Northeast India
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Station Selector */}
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-textMuted uppercase mb-1">Select Monitoring Station</span>
              <select
                value={selectedSensorId}
                onChange={(e) => setSelectedSensorId(e.target.value)}
                className="bg-bgPrimary border border-borderColor rounded-xl px-3 py-1.5 text-xs font-semibold text-textPrimary focus:outline-none focus:border-blue-600 min-w-[240px]"
              >
                {Object.entries(stateGroups).map(([code, nodes]) => (
                  <optgroup key={code} label={`── ${stateLabels[code] || code} (${nodes.length} nodes) ──`}>
                    {nodes.map(s => {
                      const r = computeSensorRisk(s);
                      const icon = r.score >= 8.5 ? "🔴" : r.score >= 6.8 ? "🟠" : r.score >= 4.0 ? "🟡" : "🟢";
                      return (
                        <option key={s.id} value={s.id}>
                          {icon} {s.name} ({r.shortLabel})
                        </option>
                      );
                    })}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Alert Status Badge */}
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-textMuted uppercase mb-1">Station Status</span>
              <div className={`px-3 py-1.5 rounded-xl border text-[9px] font-black uppercase tracking-wider ${alertStatus.bg} ${alertStatus.color}`}>
                {alertStatus.label}
              </div>
            </div>

            <button
              onClick={handleRefresh}
              className="px-3 py-2 border border-borderColor bg-bgPrimary hover:bg-borderColor/40 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm self-end mt-[18px]"
              title="Poll sensor stream"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Sync
            </button>
          </div>
        </div>

        {/* Network-Wide Status Distribution Pill Bar */}
        <div className="pt-3 border-t border-borderColor flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black uppercase text-textMuted tracking-wider">
              Network Health Grid:
            </span>
          </div>
          <div className="flex items-center flex-wrap gap-2">
            <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
              {riskSummary.nominal} Safe (Nominal)
            </span>
            <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
              {riskSummary.caution} Caution
            </span>
            <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-orange-500 inline-block"></span>
              {riskSummary.high} High Warning
            </span>
            <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 flex items-center gap-1 animate-pulse-slow">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>
              {riskSummary.critical} Critical Alert
            </span>
          </div>
        </div>

      </div>

      <AcquisitionPanel stationId={selectedSensorId} />
    </div>
  );
};
