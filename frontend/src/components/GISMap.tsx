import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, WMSTileLayer, Polyline, CircleMarker, Popup, Marker, Polygon, useMap } from "react-leaflet";
import L from "leaflet";
import { CorridorData, SensorNodeData } from "../hooks/useLiveTelemetry";
import { SafeRouteResponse } from "../types/routing";
import { computeSensorRisk } from "../lib/riskUtils";

// Helper component to smoothly zoom & fit map bounds to active OpenStreetMap route
const RouteBoundsAdjuster: React.FC<{ activeRoute: SafeRouteResponse | null }> = ({ activeRoute }) => {
  const map = useMap();
  useEffect(() => {
    if (activeRoute && activeRoute.waypoints && activeRoute.waypoints.length > 0) {
      try {
        const bounds = L.latLngBounds(activeRoute.waypoints);
        if (activeRoute.blocked_waypoints && activeRoute.blocked_waypoints.length > 0) {
          bounds.extend(L.latLngBounds(activeRoute.blocked_waypoints));
        }
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
      } catch (_) {}
    }
  }, [activeRoute, map]);
  return null;
};

// Overrides default Leaflet marker assets hash resolution in React SPA build contexts
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Custom Icons for Origin / Destination
const greenIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const redIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface GISMapProps {
  corridors: CorridorData[];
  sensors: SensorNodeData[];
  activeRoute: SafeRouteResponse | null;
  onSegmentSelect?: (segmentId: number) => void;
  onSensorSelect?: (sensorId: string) => void;
}

// NERDRR Multi-Hazard Susceptibility Polygon perimeters
interface HazardZoneMetadata {
  name: string;
  state: string;
  coords: [number, number][];
  severity: "EXTREME" | "HIGH";
  description: string;
}

const HAZARD_PERIMETERS: HazardZoneMetadata[] = [
  {
    name: "Sikkim Central Alpine Fault Zone",
    state: "Sikkim",
    coords: [[27.15, 88.30], [27.65, 88.35], [27.65, 88.70], [27.15, 88.70]],
    severity: "EXTREME",
    description: "Highly vulnerable slopes covering Mangan, Dzongu reserves, Namchi, and NH-10 Teesta corridors."
  },
  {
    name: "Nagaland Central Ridges Zone",
    state: "Nagaland",
    coords: [[25.70, 93.85], [25.85, 93.90], [25.80, 94.20], [25.60, 94.15]],
    severity: "EXTREME",
    description: "Steep tectonic fault zones flanking Kohima Town municipal ridgelines and Chumoukedima road bypass."
  },
  {
    name: "Mizoram Aizawl Municipal Slump Escarpment",
    state: "Mizoram",
    coords: [[23.65, 92.65], [23.80, 92.68], [23.80, 92.78], [23.65, 92.75]],
    severity: "EXTREME",
    description: "Steep sedimentary urban cuts vulnerable to monsoonal pore-water pressure spikes."
  },
  {
    name: "Assam Dima Hasao Railway Cut Corridor",
    state: "Assam",
    coords: [[25.10, 92.95], [25.25, 92.98], [25.22, 93.10], [25.08, 93.08]],
    severity: "HIGH",
    description: "Critical railway infrastructure linking Lumding to Badarpur. Active mudslumps and rockfall prone."
  },
  {
    name: "Arunachal Tawang Alpine Fault Block",
    state: "Arunachal",
    coords: [[27.20, 91.80], [27.65, 91.80], [27.65, 92.50], [27.20, 92.50]],
    severity: "EXTREME",
    description: "High altitude alpine slopes extending via Sela pass to Tawang valley settlements."
  },
  {
    name: "Meghalaya Southern Escarpment Block",
    state: "Meghalaya",
    coords: [[25.20, 91.50], [25.35, 91.50], [25.35, 91.80], [25.20, 91.80]],
    severity: "HIGH",
    description: "Extreme precipitation belt spanning Cherrapunji and Mawsynram terraced valleys."
  }
];

export const GISMap: React.FC<GISMapProps> = ({ 
  corridors, 
  sensors, 
  activeRoute,
  onSegmentSelect,
  onSensorSelect
}) => {
  const mapCenter: [number, number] = [26.2, 92.9]; // Center over Northeast India
  const defaultZoom = 7.5;
  const [basemap, setBasemap] = useState<"dark" | "satellite" | "topo" | "osm">("dark");
  const [showRadar, setShowRadar] = useState<boolean>(false);
  const [showHazardZones, setShowHazardZones] = useState<boolean>(true);

  // Threat colors hierarchy
  const getAlertColor = (riskScore: number) => {
    if (riskScore >= 9.0) return "#EF4444"; // Level 9-10 (Critical / Red Alert)
    if (riskScore >= 7.0) return "#F97316"; // Level 7-8 (High / Orange Alert)
    if (riskScore >= 4.0) return "#F59E0B"; // Level 4-6 (Moderate / Yellow Advisory)
    return "#10B981"; // Level 1-3 (Low / Green Baseline)
  };

  const getAlertHaloClass = (riskScore: number) => {
    if (riskScore >= 9.0) return "halo-red";
    if (riskScore >= 7.0) return "halo-orange";
    if (riskScore >= 4.0) return "halo-yellow";
    return "halo-green";
  };

  return (
    <div className="w-full h-full rounded-3xl overflow-hidden border border-borderColor shadow-2xl min-h-[560px] flex flex-col bg-bgCard">
      
      {/* ── TOP MAP CONTROLS TOOLBAR (OUTSIDE MAP) ── */}
      <div className="px-5 py-3.5 bg-bgCard border-b border-borderColor flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="p-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg font-black text-xs uppercase flex items-center gap-1.5 border border-blue-500/20">
            🛰️ Regional GIS Grid
          </span>
          <span className="text-xs font-black text-textPrimary">
            Northeast India Command Network
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Basemap Switcher Chips */}
          <div className="flex items-center bg-bgPrimary border border-borderColor rounded-xl p-1 gap-1 shadow-sm">
            <button
              onClick={() => setBasemap("dark")}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all tracking-wider flex items-center gap-1 ${
                basemap === "dark"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-textSecondary hover:text-textPrimary"
              }`}
            >
              🌑 Dark
            </button>
            <button
              onClick={() => setBasemap("satellite")}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all tracking-wider flex items-center gap-1 ${
                basemap === "satellite"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-textSecondary hover:text-textPrimary"
              }`}
            >
              🛰️ Satellite
            </button>
            <button
              onClick={() => setBasemap("topo")}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all tracking-wider flex items-center gap-1 ${
                basemap === "topo"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-textSecondary hover:text-textPrimary"
              }`}
            >
              ⛰️ Topo
            </button>
            <button
              onClick={() => setBasemap("osm")}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all tracking-wider flex items-center gap-1 ${
                basemap === "osm"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-textSecondary hover:text-textPrimary"
              }`}
            >
              🗺️ Street
            </button>
          </div>

          {/* Layer Toggles */}
          <div className="flex items-center bg-bgPrimary border border-borderColor rounded-xl p-1 gap-1 shadow-sm">
            <button
              onClick={() => setShowRadar(!showRadar)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all tracking-wider flex items-center gap-1 ${
                showRadar
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-textSecondary hover:text-textPrimary"
              }`}
            >
              🌧️ Radar WMS
            </button>
            <button
              onClick={() => setShowHazardZones(!showHazardZones)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all tracking-wider flex items-center gap-1 ${
                showHazardZones
                  ? "bg-amber-600 text-white shadow-sm"
                  : "text-textSecondary hover:text-textPrimary"
              }`}
            >
              ⚠️ Hazard Zones
            </button>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="w-full flex-grow relative" style={{ minHeight: "480px" }}>
        <MapContainer 
          center={mapCenter} 
          zoom={defaultZoom} 
          scrollWheelZoom={true} 
          className="w-full h-full"
        >
          {/* Automatic Route Bounds Adjuster when Safe Route is active */}
          <RouteBoundsAdjuster activeRoute={activeRoute} />

          {/* Watermark-Free High-Performance Basemaps */}
          {basemap === "dark" && (
            <TileLayer
              attribution='&copy; <a href="https://www.esri.com">Esri</a> &mdash; Esri Dark Canvas'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
              maxZoom={16}
            />
          )}
          {basemap === "satellite" && (
            <TileLayer
              attribution='&copy; <a href="https://www.esri.com">Esri</a>, Earthstar Geographics'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={18}
            />
          )}
          {basemap === "topo" && (
            <TileLayer
              attribution='&copy; <a href="https://www.esri.com">Esri</a> &mdash; World Topo Map'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
              maxZoom={18}
            />
          )}
          {basemap === "osm" && (
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />
          )}

          {/* Renders live weather rain radar clouds */}
          {showRadar && (
            <WMSTileLayer
              url="https://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0r.cgi"
              layers="nexrad-n0r-900913"
              format="image/png"
              transparent={true}
              opacity={0.6}
              attribution="Live Weather Radar Overlay"
            />
          )}

          {/* Renders NERDRR Multi-Hazard Zones polygons */}
          {showHazardZones && (
            HAZARD_PERIMETERS.map((h, idx) => (
              <Polygon
                key={idx}
                positions={h.coords}
                pathOptions={{
                  color: h.severity === "EXTREME" ? "#EF4444" : "#F97316",
                  fillColor: h.severity === "EXTREME" ? "#EF4444" : "#F97316",
                  fillOpacity: 0.22,
                  weight: 2,
                  dashArray: "6, 6"
                }}
              >
                <Popup>
                  <div className="font-sans p-1 bg-bgCard text-textPrimary text-xs leading-normal">
                    <span className="font-black text-alertRed block uppercase text-[9px] mb-1">
                      ⚠️ NERDRR Hazard Vulnerability Perimeter
                    </span>
                    <strong className="block text-textPrimary text-xs">{h.name} ({h.state})</strong>
                    <p className="text-[10px] text-textSecondary mt-1 font-semibold">{h.description}</p>
                    <div className="mt-2 text-[9px] font-black uppercase text-alertOrange">
                      Vulnerability: {h.severity} Risk
                    </div>
                  </div>
                </Popup>
              </Polygon>
            ))
          )}

          {/* Render National Highway Corridors */}
          {corridors.map((c) =>
            c.sections.map((sec) => {
              if (!sec.coordinates || sec.coordinates.length === 0) return null;
              return (
                <Polyline
                  key={sec.id}
                  positions={sec.coordinates}
                  pathOptions={{
                    color: getAlertColor(sec.risk_score),
                    weight: 5,
                    opacity: 0.85,
                  }}
                  eventHandlers={{
                    click: () => {
                      if (onSegmentSelect) onSegmentSelect(sec.id);
                    },
                    mouseover: (e) => {
                      const layer = e.target;
                      layer.setStyle({ weight: 7, opacity: 1.0 });
                    },
                    mouseout: (e) => {
                      const layer = e.target;
                      layer.setStyle({ weight: 5, opacity: 0.85 });
                    }
                  }}
                >
                  <Popup>
                    <div className="p-1.5 font-sans text-textPrimary leading-snug bg-bgCard rounded-lg">
                      <div className="font-extrabold text-sm border-b border-borderColor pb-1 mb-1">
                        {c.name} - {sec.section}
                      </div>
                      <div className="text-xs space-y-1 mt-1.5 font-medium">
                        <p>
                          Status:{" "}
                          <span 
                            className="font-black uppercase"
                            style={{ color: getAlertColor(sec.risk_score) }}
                          >
                            {sec.status}
                          </span>
                        </p>
                        <p>Length: <strong>{sec.length_km} km</strong></p>
                        <p>Risk Score: <strong>{sec.risk_score.toFixed(1)}/10</strong></p>
                        <p>Failure Prob: <strong>{(sec.risk_probability * 100).toFixed(0)}%</strong></p>
                      </div>
                      <button 
                        onClick={() => onSegmentSelect && onSegmentSelect(sec.id)}
                        className="mt-3 w-full py-1.5 text-center bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold transition"
                      >
                        Show Detailed AI Forecast & SHAP
                      </button>
                    </div>
                  </Popup>
                </Polyline>
              );
            })
          )}

          {/* Draw Alternate Detour Safe Routing paths from OpenStreetMap */}
          {activeRoute && activeRoute.waypoints && activeRoute.waypoints.length > 0 && (
            <>
              {activeRoute.alternative_available && activeRoute.blocked_waypoints && (
                <Polyline
                  positions={activeRoute.blocked_waypoints}
                  pathOptions={{
                    color: "#EF4444",
                    weight: 5,
                    dashArray: "8, 8",
                    opacity: 0.85,
                  }}
                >
                  <Popup>
                    <div className="font-sans text-xs p-1 bg-bgCard">
                      <span className="font-black text-alertRed block uppercase text-[9px] mb-0.5">⚠️ Primary Highway Path</span>
                      <strong className="text-textPrimary block text-xs">High Landslide Risk Corridor</strong>
                      <p className="text-[10px] text-textSecondary mt-0.5">Active landslide risk detected along standard corridor. Traffic detoured to safety.</p>
                    </div>
                  </Popup>
                </Polyline>
              )}

              <Polyline
                positions={activeRoute.waypoints}
                pathOptions={{
                  color: "#10B981",
                  weight: 6,
                  opacity: 0.95,
                }}
              >
                <Popup>
                  <div className="font-sans text-xs p-1 bg-bgCard">
                    <span className="font-black text-alertGreen block uppercase text-[9px] mb-0.5">🛣️ Verified Safe Road Route</span>
                    <strong className="text-textPrimary block text-xs">{activeRoute.origin} ➔ {activeRoute.destination}</strong>
                    <div className="text-[10px] text-textSecondary mt-1 space-y-0.5">
                      <div>Total Distance: <strong className="text-textPrimary">{activeRoute.total_distance_km} km</strong></div>
                      <div>Average Risk: <strong className="text-alertGreen">{activeRoute.average_risk.toFixed(1)}/10</strong></div>
                      <div className="text-[9px] text-blue-500 font-semibold mt-1">OpenStreetMap (OSRM) Road Routing Active</div>
                    </div>
                  </div>
                </Popup>
              </Polyline>

              <Marker position={activeRoute.waypoints[0]} icon={greenIcon}>
                <Popup>
                  <div className="font-bold text-xs text-textPrimary text-center bg-bgCard p-1 rounded">
                    ORIGIN JUNCTION<br />
                    <span className="font-black text-sm text-alertGreen">{activeRoute.origin}</span>
                  </div>
                </Popup>
              </Marker>

              <Marker position={activeRoute.waypoints[activeRoute.waypoints.length - 1]} icon={redIcon}>
                <Popup>
                  <div className="font-bold text-xs text-textPrimary text-center bg-bgCard p-1 rounded">
                    DESTINATION TARGET<br />
                    <span className="font-black text-sm text-alertRed">{activeRoute.destination}</span>
                  </div>
                </Popup>
              </Marker>
            </>
          )}

          {/* Render 40 dynamic stations with pulsing halos */}
          {sensors.map((s) => {
            // Use the single shared risk engine — consistent with Dashboard, IoT page, etc.
            const risk = computeSensorRisk(s);
            const color = risk.color;
            const haloClass = getAlertHaloClass(risk.score);

            return (
              <React.Fragment key={s.id}>
                {/* Dynamic Pulsing Halo Layer */}
                <CircleMarker
                  center={[s.latitude, s.longitude]}
                  radius={15}
                  className={haloClass}
                  pathOptions={{
                    fillColor: color,
                    fillOpacity: 0.16,
                    stroke: false
                  }}
                />

                {/* Core Circle Marker */}
                <CircleMarker
                  center={[s.latitude, s.longitude]}
                  radius={7}
                  pathOptions={{
                    color: "#FFFFFF",
                    fillColor: color,
                    fillOpacity: 0.95,
                    weight: 1.5
                  }}
                  eventHandlers={{
                    click: () => {
                      if (onSensorSelect) onSensorSelect(s.id);
                    }
                  }}
                >
                  <Popup>
                    <div className="p-1.5 font-sans bg-bgCard text-textPrimary leading-snug rounded-lg">
                      <div className="font-black text-xs border-b border-borderColor pb-1 mb-1 text-blue-700">
                        {s.name}
                      </div>
                      <div className="text-[10px] space-y-0.5 mt-1 font-bold text-textSecondary">
                        <p>ID: <strong className="font-mono text-textPrimary">{s.id}</strong></p>
                        <p>Open-Meteo weather model · {new Date(s.last_updated).toLocaleString()}</p><p>Surface soil moisture: <strong className="text-blue-600">{s.soil_moisture.toFixed(1)}%</strong></p>
                        <p>24h Rain Accumulation: <strong className="text-indigo-600">{s.rain_24h_obs.toFixed(1)} mm</strong></p>
                        <p>API 7d Index: <strong>{s.api_7d.toFixed(1)} mm</strong></p>
                        <p>Sentinel screening: {s.sentinel ? s.sentinel.candidate_pct + "% candidate pixels · " + new Date(s.sentinel.acquired_at).toLocaleDateString() : "Awaiting scene"}</p>
                        <p>Satellite rainfall: {s.hem ? s.hem.value + " " + s.hem.units + " · " + new Date(s.hem.acquired_at).toLocaleString() : "Awaiting HEM raster"}</p>
                        <p className="border-t border-borderColor/60 mt-1 pt-1">
                          Alert: <strong style={{ color: color }}>{risk.label}</strong>
                        </p>
                      </div>
                      <button
                        onClick={() => onSensorSelect && onSensorSelect(s.id)}
                        className="mt-2.5 w-full py-1 text-center bg-blue-600 hover:bg-blue-700 text-white rounded text-[9px] font-bold transition"
                      >
                        Inspect Node Analytics
                      </button>
                    </div>
                  </Popup>
                </CircleMarker>
              </React.Fragment>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
};
