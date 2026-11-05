import React, { useState, useMemo } from 'react';
import { Terrain3D, TerrainViewMode, WeatherMode, CameraPreset, computeRiskMetrics } from '../components/Terrain3D';
import { useLiveTelemetry, SensorNodeData } from '../hooks/useLiveTelemetry';
import {
  Layers,
  CloudRain,
  Sun,
  Cloud,
  Compass,
  Eye,
  Radio,
  RotateCw,
  Maximize2,
  ShieldAlert,
  Activity,
  Droplets,
  Gauge,
  MapPin,
  TrendingUp,
  AlertTriangle,
  Zap,
  Crosshair,
  Sliders,
  ChevronRight,
  Info
} from 'lucide-react';

import { API_BASE_URL } from "../services/apiConfig";

export const TerrainAnalysisPage: React.FC = () => {
  const { sensors, loading, refresh } = useLiveTelemetry(API_BASE_URL, 15000);
  const [viewMode, setViewMode] = useState<TerrainViewMode>('satellite');
  const [weatherMode, setWeatherMode] = useState<WeatherMode>('clear');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('cinematic');
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [selectedSensor, setSelectedSensor] = useState<SensorNodeData | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Compute overall network statistics
  const { criticalCount, highCount, moderateCount, safeCount, highestRiskSensor, sortedSensors } = useMemo(() => {
    let crit = 0, high = 0, mod = 0, safe = 0;
    let maxSensor: SensorNodeData | null = null;
    let maxProb = -1;

    const list = sensors.map((s) => {
      const metrics = computeRiskMetrics(s);
      if (metrics.level === 'CRITICAL') crit++;
      else if (metrics.level === 'HIGH') high++;
      else if (metrics.level === 'MODERATE') mod++;
      else safe++;

      if (metrics.prob > maxProb) {
        maxProb = metrics.prob;
        maxSensor = s;
      }
      return { sensor: s, metrics };
    });

    list.sort((a, b) => b.metrics.prob - a.metrics.prob);

    return {
      criticalCount: crit,
      highCount: high,
      moderateCount: mod,
      safeCount: safe,
      highestRiskSensor: maxSensor,
      sortedSensors: list,
    };
  }, [sensors]);

  const filteredSensors = useMemo(() => {
    if (!searchFilter.trim()) return sortedSensors;
    return sortedSensors.filter(({ sensor }) =>
      sensor.name.toLowerCase().includes(searchFilter.toLowerCase())
    );
  }, [sortedSensors, searchFilter]);

  const selectedMetrics = useMemo(() => {
    return selectedSensor ? computeRiskMetrics(selectedSensor) : null;
  }, [selectedSensor]);

  const handleFocusHighestRisk = () => {
    if (highestRiskSensor) {
      setSelectedSensor(highestRiskSensor);
      setCameraPreset('focus');
    }
  };

  return (
    <div className="h-[calc(100vh-80px)] min-h-[750px] p-4 flex flex-col gap-3 font-sans animate-fadeIn">
      {/* ── TOP CONTROL BAR ── */}
      <header className="bg-bgCard/90 border border-borderColor backdrop-blur-xl rounded-2xl px-5 py-3 flex flex-wrap items-center justify-between gap-4 shadow-sm shrink-0">
        {/* Title & Badge */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md shadow-blue-500/20">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-textPrimary tracking-tight">
                3D Northeast India (NER) Digital Twin GIS
              </h2>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Live {sensors.length}-Station Grid
              </span>
            </div>
            <p className="text-[11px] font-semibold text-textSecondary">
              Regional Topographic Relief of Northeast India (Survey of India datum) • Dynamic In-Situ Telemetry
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center flex-wrap gap-2">
          {/* View Mode Switcher */}
          <div className="flex items-center bg-bgPrimary border border-borderColor rounded-xl p-1 gap-1">
            <button
              onClick={() => setViewMode('satellite')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition ${
                viewMode === 'satellite'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-textSecondary hover:text-textPrimary'
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> Topo
            </button>
            <button
              onClick={() => setViewMode('heatmap')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition ${
                viewMode === 'heatmap'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-textSecondary hover:text-textPrimary'
              }`}
            >
              <Zap className="w-3.5 h-3.5" /> AI Thermal
            </button>
            <button
              onClick={() => setViewMode('lidar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition ${
                viewMode === 'lidar'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-textSecondary hover:text-textPrimary'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" /> LiDAR
            </button>
          </div>

          {/* Weather Mode Switcher */}
          <div className="flex items-center bg-bgPrimary border border-borderColor rounded-xl p-1 gap-1">
            <button
              onClick={() => setWeatherMode('clear')}
              title="Clear Daylight"
              className={`p-1.5 rounded-lg transition ${
                weatherMode === 'clear' ? 'bg-amber-500 text-white' : 'text-textSecondary hover:text-textPrimary'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setWeatherMode('overcast')}
              title="Overcast Fog"
              className={`p-1.5 rounded-lg transition ${
                weatherMode === 'overcast' ? 'bg-slate-600 text-white' : 'text-textSecondary hover:text-textPrimary'
              }`}
            >
              <Cloud className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setWeatherMode('monsoon')}
              title="Heavy Monsoon Storm"
              className={`p-1.5 rounded-lg transition ${
                weatherMode === 'monsoon' ? 'bg-blue-600 text-white animate-pulse' : 'text-textSecondary hover:text-textPrimary'
              }`}
            >
              <CloudRain className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Camera Presets */}
          <div className="flex items-center bg-bgPrimary border border-borderColor rounded-xl p-1 gap-1">
            <button
              onClick={() => setCameraPreset('cinematic')}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition ${
                cameraPreset === 'cinematic' ? 'bg-slate-700 text-white' : 'text-textSecondary hover:text-textPrimary'
              }`}
            >
              3D Orbit
            </button>
            <button
              onClick={() => setCameraPreset('topdown')}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition ${
                cameraPreset === 'topdown' ? 'bg-slate-700 text-white' : 'text-textSecondary hover:text-textPrimary'
              }`}
            >
              Top-Down
            </button>
            <button
              onClick={() => setCameraPreset('cross_section')}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition ${
                cameraPreset === 'cross_section' ? 'bg-slate-700 text-white' : 'text-textSecondary hover:text-textPrimary'
              }`}
            >
              Gorge
            </button>
          </div>

          {/* Auto Rotate Toggle */}
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase flex items-center gap-1.5 transition ${
              autoRotate
                ? 'bg-blue-600/15 border-blue-500 text-blue-600'
                : 'bg-bgPrimary border-borderColor text-textSecondary hover:text-textPrimary'
            }`}
          >
            <RotateCw className={`w-3 h-3 ${autoRotate ? 'animate-spin' : ''}`} />
            Auto-Fly
          </button>

          {/* Focus Critical Hotspot */}
          <button
            onClick={handleFocusHighestRisk}
            className="px-3 py-1.5 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-1.5 shadow-md shadow-red-500/20 transition"
          >
            <Crosshair className="w-3.5 h-3.5 animate-pulse" />
            Focus Hazard Hotspot
          </button>
        </div>
      </header>

      {/* ── MAIN 3D WORKSPACE & SIDE INSPECTOR ── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-3 min-h-[640px]">
        {/* 3D WebGL Canvas Viewport (Span 3 Cols) */}
        <div className="lg:col-span-3 bg-[#050811] rounded-3xl border border-borderColor shadow-xl overflow-hidden relative flex flex-col min-h-[600px] h-full">
          <Terrain3D
            sensors={sensors}
            viewMode={viewMode}
            weatherMode={weatherMode}
            selectedSensorId={selectedSensor?.id || null}
            onSelectSensor={(s) => {
              setSelectedSensor(s);
              if (s) setCameraPreset('focus');
            }}
            autoRotate={autoRotate}
            cameraPreset={cameraPreset}
          />

          {/* Top-Left HUD Info Badge */}
          <div className="absolute top-4 left-4 z-10 bg-slate-950/80 backdrop-blur-md border border-slate-700/80 rounded-2xl p-3 shadow-2xl pointer-events-none max-w-xs space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping" />
              <span className="text-[11px] font-black uppercase tracking-wider text-white">
                Interactive 3D Terrain Grid
              </span>
            </div>
            <p className="text-[10px] text-slate-300 font-semibold leading-relaxed">
              • Click any node beacon to focus & view geotechnical metrics.<br />
              • Drag to rotate camera • Scroll to zoom • Right-click to pan.
            </p>
          </div>

          {/* Bottom-Left Elevation / Risk Legend Overlay */}
          <div className="absolute bottom-4 left-4 z-10 bg-slate-950/85 backdrop-blur-md border border-slate-700/80 rounded-2xl p-3 shadow-2xl pointer-events-none flex flex-col gap-2">
            <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">
              {viewMode === 'heatmap' ? 'AI Hazard Threat Scale' : 'Elevation Gradient'}
            </div>
            {viewMode === 'heatmap' ? (
              <div className="flex items-center gap-2 text-[10px] font-bold font-mono">
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Safe &lt;20%</span>
                <span className="px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">Advisory 40%</span>
                <span className="px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">Watch 60%</span>
                <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">Critical &gt;75%</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-300">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#0d2319]"></span> Valley</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#1b4332]"></span> Forest</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#475569]"></span> Scree Ridge</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#e2e8f0]"></span> Peak</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Side Telemetry & Threat Inspector Panel (Span 1 Col) */}
        <aside className="lg:col-span-1 bg-bgCard rounded-3xl border border-borderColor shadow-sm p-4 flex flex-col gap-3 overflow-y-auto">
          {/* Network Risk Distribution Pills */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-2.5 text-center">
              <div className="text-[9px] font-black uppercase text-red-600 tracking-wider">Critical Warning</div>
              <div className="text-xl font-black text-red-600 mt-0.5">{criticalCount} Nodes</div>
            </div>
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-2.5 text-center">
              <div className="text-[9px] font-black uppercase text-orange-600 tracking-wider">High Watch</div>
              <div className="text-xl font-black text-orange-600 mt-0.5">{highCount} Nodes</div>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 text-center">
              <div className="text-[9px] font-black uppercase text-amber-600 tracking-wider">Advisory</div>
              <div className="text-xl font-black text-amber-600 mt-0.5">{moderateCount} Nodes</div>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5 text-center">
              <div className="text-[9px] font-black uppercase text-emerald-600 tracking-wider">Stable Normal</div>
              <div className="text-xl font-black text-emerald-600 mt-0.5">{safeCount} Nodes</div>
            </div>
          </div>

          {/* Selected Node Telemetry Deep-Dive */}
          {selectedSensor && selectedMetrics ? (
            <div className="bg-bgPrimary rounded-2xl border border-borderColor p-4 space-y-3 relative overflow-hidden animate-fadeIn">
              <div className="flex items-start justify-between gap-2 border-b border-borderColor pb-2">
                <div>
                  <div className="text-[9px] font-black uppercase text-textMuted tracking-wider">Selected Sensor Node</div>
                  <h3 className="text-sm font-extrabold text-slate-900 mt-0.5">{selectedSensor.name}</h3>
                  <p className="text-[10px] font-mono text-textSecondary">
                    Lat: {selectedSensor.latitude.toFixed(4)}° • Lon: {selectedSensor.longitude.toFixed(4)}°
                  </p>
                </div>
                <span
                  className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full shrink-0"
                  style={{
                    backgroundColor: `${selectedMetrics.color}15`,
                    color: selectedMetrics.color,
                    border: `1px solid ${selectedMetrics.color}40`,
                  }}
                >
                  {selectedMetrics.level}
                </span>
              </div>

              {/* Threat Gauge */}
              <div className="bg-bgCard rounded-xl p-3 border border-borderColor space-y-1.5">
                <div className="flex items-center justify-between text-xs font-extrabold">
                  <span className="text-textSecondary uppercase text-[10px]">AI Threat Probability</span>
                  <span className="font-mono font-black" style={{ color: selectedMetrics.color }}>
                    {(selectedMetrics.prob * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${selectedMetrics.prob * 100}%`,
                      backgroundColor: selectedMetrics.color,
                    }}
                  />
                </div>
              </div>

              {/* 4 In-Situ Telemetry Parameters */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-bgCard p-2 rounded-xl border border-borderColor">
                  <div className="flex items-center gap-1 text-[9px] font-bold text-textMuted uppercase">
                    <Droplets className="w-3 h-3 text-blue-500" /> 24h Rainfall
                  </div>
                  <div className="text-sm font-black font-mono text-slate-900 mt-1">
                    {selectedSensor.rain_24h_obs.toFixed(1)} <span className="text-[10px] font-normal text-textMuted">mm</span>
                  </div>
                </div>

                <div className="bg-bgCard p-2 rounded-xl border border-borderColor">
                  <div className="flex items-center gap-1 text-[9px] font-bold text-textMuted uppercase">
                    <Activity className="w-3 h-3 text-cyan-500" /> Soil Moisture
                  </div>
                  <div className="text-sm font-black font-mono text-slate-900 mt-1">
                    {selectedSensor.soil_moisture.toFixed(1)} <span className="text-[10px] font-normal text-textMuted">%</span>
                  </div>
                </div>

                <div className="bg-bgCard p-2 rounded-xl border border-borderColor">
                  <div className="flex items-center gap-1 text-[9px] font-bold text-textMuted uppercase">
                    <Gauge className="w-3 h-3 text-purple-500" /> Pore Pressure
                  </div>
                  <div className="text-sm font-black font-mono text-slate-900 mt-1">
                    {selectedMetrics.pore.toFixed(1)} <span className="text-[10px] font-normal text-textMuted">kPa</span>
                  </div>
                </div>

                <div className="bg-bgCard p-2 rounded-xl border border-borderColor">
                  <div className="flex items-center gap-1 text-[9px] font-bold text-textMuted uppercase">
                    <Compass className="w-3 h-3 text-emerald-500" /> Tilt Inclinometer
                  </div>
                  <div className="text-sm font-black font-mono text-slate-900 mt-1">
                    {(selectedMetrics.incl * 100).toFixed(2)} <span className="text-[10px] font-normal text-textMuted">deg/hr</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedSensor(null)}
                className="w-full py-2 bg-bgCard hover:bg-borderColor/50 border border-borderColor rounded-xl text-[10px] font-bold uppercase transition"
              >
                Clear Node Selection
              </button>
            </div>
          ) : (
            <div className="bg-bgPrimary/60 rounded-2xl border border-dashed border-borderColor p-4 text-center space-y-2">
              <div className="p-3 bg-blue-600/10 text-blue-600 rounded-full w-10 h-10 mx-auto flex items-center justify-center">
                <Crosshair className="w-5 h-5" />
              </div>
              <div className="text-xs font-bold text-slate-800">No Sensor Selected</div>
              <p className="text-[10px] text-textMuted">
                Click any glowing beacon pin on the 3D topography or select from the hazard list below.
              </p>
            </div>
          )}

          {/* Quick-Jump Ranked Hazard Node Feed */}
          <div className="flex-1 flex flex-col min-h-0 space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-textSecondary tracking-wider">
                Ranked Hazard Priority ({sensors.length})
              </span>
              <input
                type="text"
                placeholder="Filter node..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="px-2 py-1 bg-bgPrimary border border-borderColor rounded-lg text-[10px] text-textPrimary w-28 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {filteredSensors.map(({ sensor, metrics }) => (
                <div
                  key={sensor.id}
                  onClick={() => {
                    setSelectedSensor(sensor);
                    setCameraPreset('focus');
                  }}
                  className={`p-2.5 rounded-xl border cursor-pointer transition flex items-center justify-between gap-2 ${
                    selectedSensor?.id === sensor.id
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                      : 'bg-bgPrimary hover:bg-bgCard border-borderColor text-textPrimary'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: metrics.color }}
                    />
                    <div className="truncate">
                      <div className="text-xs font-bold truncate leading-tight">{sensor.name}</div>
                      <div className="text-[9px] opacity-75 font-mono">
                        Rain: {sensor.rain_24h_obs.toFixed(1)}mm • SM: {sensor.soil_moisture.toFixed(0)}%
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs font-mono font-black">
                      {(metrics.prob * 100).toFixed(0)}%
                    </div>
                    <span
                      className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: selectedSensor?.id === sensor.id ? '#ffffff30' : `${metrics.color}20`,
                        color: selectedSensor?.id === sensor.id ? '#ffffff' : metrics.color,
                      }}
                    >
                      {metrics.level}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
