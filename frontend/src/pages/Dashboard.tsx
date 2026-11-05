import React, { useState, useEffect } from "react";
import { 
  Layers, Sliders, Database, Eye, CheckCircle2, ChevronRight, BarChart3, Radio, RefreshCw, Filter, X, Shield, AlertTriangle, Home, Users, Satellite, ChevronDown, ChevronUp, XCircle, Trash2, ShieldCheck, RotateCcw
} from "lucide-react";
import { useLiveTelemetry, CorridorData, SensorNodeData, CAPAlertData } from "../hooks/useLiveTelemetry";
import { AlertsBanner } from "../components/AlertsBanner";
import { GISMap } from "../components/GISMap";
import { RoadCorridorStatus } from "../components/RoadCorridorStatus";
import { RiskDial } from "../components/RiskDial";
import { StateResilienceWidget } from "../components/StateResilienceWidget";
import { SARInspector } from "../components/SARInspector";
import { mockApi } from "../services/mockApi";
import { computeSensorRisk } from "../lib/riskUtils";

interface DashboardProps {
  apiBaseUrl: string;
  onNavigateToRouting?: (params: { origin: string; destination: string; autoCalculate?: boolean }) => void;
}

interface DistrictCardMetadata {
  name: string;
  stateKey: string;
  associatedSensorId: string;
  populationAtRisk: number;
  shelterName: string;
  shelterStatus: "Active" | "Standby" | "Clear";
}

// Breakdown dataset covering districts/villages mapped to EWS monitoring points
const DISTRICT_BREAKDOWNS: DistrictCardMetadata[] = [
  // ASSAM
  { name: "Kamrup Metro (Guwahati Slopes)", stateKey: "ASSAM", associatedSensorId: "SN-ASM-GUA-01", populationAtRisk: 18500, shelterName: "Guwahati Municipal Hall", shelterStatus: "Active" },
  { name: "Cachar District (Silchar Hillocks)", stateKey: "ASSAM", associatedSensorId: "SN-ASM-SIL-01", populationAtRisk: 9200, shelterName: "Silchar College Camp", shelterStatus: "Standby" },
  { name: "Dima Hasao (Rural Settlements)", stateKey: "ASSAM", associatedSensorId: "SN-ASM-DH-01", populationAtRisk: 34000, shelterName: "Haflong Stadium Center", shelterStatus: "Active" },
  { name: "Haflong Hills (Tribal Slopes)", stateKey: "ASSAM", associatedSensorId: "SN-ASM-HAF-01", populationAtRisk: 22000, shelterName: "Tribal Welfare Bhavan", shelterStatus: "Active" },
  { name: "Karbi Anglong (Remote Hamlets)", stateKey: "ASSAM", associatedSensorId: "SN-ASM-KA-01", populationAtRisk: 12500, shelterName: "Diphu Community School", shelterStatus: "Standby" },
  { name: "Lumding-Badarpur (Railway Cut)", stateKey: "ASSAM", associatedSensorId: "SN-ASM-RRL-01", populationAtRisk: 28800, shelterName: "Railway Station Shelters", shelterStatus: "Active" },

  // MEGHALAYA
  { name: "East Khasi Hills (Shillong Slopes)", stateKey: "MEG", associatedSensorId: "SN-MEG-SHI-01", populationAtRisk: 26000, shelterName: "Shillong Indoor Stadium", shelterStatus: "Standby" },
  { name: "West Garo Hills (Tura Town)", stateKey: "MEG", associatedSensorId: "SN-MEG-TUR-01", populationAtRisk: 14500, shelterName: "Tura Government School", shelterStatus: "Standby" },
  { name: "Cherrapunji (Terraced Valleys)", stateKey: "MEG", associatedSensorId: "SN-MEG-CHE-01", populationAtRisk: 18000, shelterName: "Sohra Emergency Shelter", shelterStatus: "Active" },
  { name: "Mawsynram (Tribal Hamlets)", stateKey: "MEG", associatedSensorId: "SN-MEG-MAW-01", populationAtRisk: 19500, shelterName: "Mawsynram Community Hall", shelterStatus: "Active" },

  // SIKKIM
  { name: "East Sikkim (Gangtok City)", stateKey: "SIKKIM", associatedSensorId: "SN-SKM-GAN-01", populationAtRisk: 24000, shelterName: "Gangtok Paljor Stadium", shelterStatus: "Active" },
  { name: "South Sikkim (Namchi Ridge)", stateKey: "SIKKIM", associatedSensorId: "SN-SKM-NAM-01", populationAtRisk: 11000, shelterName: "Namchi Community Center", shelterStatus: "Standby" },
  { name: "North Sikkim (Mangan Slopes)", stateKey: "SIKKIM", associatedSensorId: "SN-SKM-MAN-01", populationAtRisk: 5500, shelterName: "Mangan District Office", shelterStatus: "Active" },
  { name: "Dzongu Reserve (Tribal Hamlet)", stateKey: "SIKKIM", associatedSensorId: "SN-SKM-DZO-01", populationAtRisk: 4200, shelterName: "Dzongu Primary Clinic", shelterStatus: "Active" },
  { name: "Chungthang (Valley Cuttings)", stateKey: "SIKKIM", associatedSensorId: "SN-SKM-CHU-01", populationAtRisk: 3100, shelterName: "Chungthang Hydro Barracks", shelterStatus: "Active" },

  // NAGALAND
  { name: "Kohima District (Town Ridges)", stateKey: "NGL", associatedSensorId: "SN-NGL-KOH-01", populationAtRisk: 31000, shelterName: "Kohima Red Cross Hall", shelterStatus: "Active" },
  { name: "Mokokchung (Urban Slopes)", stateKey: "NGL", associatedSensorId: "SN-NGL-MOK-01", populationAtRisk: 12400, shelterName: "Mokokchung Youth Center", shelterStatus: "Standby" },
  { name: "Phek District (Farming Villages)", stateKey: "NGL", associatedSensorId: "SN-NGL-PHE-01", populationAtRisk: 8500, shelterName: "Phek Panchayat Hall", shelterStatus: "Clear" },
  { name: "Wokha District (Terraced Hamlets)", stateKey: "NGL", associatedSensorId: "SN-NGL-WOK-01", populationAtRisk: 12000, shelterName: "Wokha Sports Complex", shelterStatus: "Standby" },
  { name: "Kiphire District (Border Tracks)", stateKey: "NGL", associatedSensorId: "SN-NGL-KIP-01", populationAtRisk: 10100, shelterName: "Kiphire Government Bhavan", shelterStatus: "Active" },

  // MIZORAM
  { name: "Aizawl District (Capital Ridge)", stateKey: "MIZORAM", associatedSensorId: "SN-MZR-AIZ-01", populationAtRisk: 38000, shelterName: "Aizawl Assembly Hall", shelterStatus: "Active" },
  { name: "Lunglei District (Municipal Zone)", stateKey: "MIZORAM", associatedSensorId: "SN-MZR-LUN-01", populationAtRisk: 17000, shelterName: "Lunglei Public Auditorium", shelterStatus: "Standby" },
  { name: "Champhai (Agricultural Slopes)", stateKey: "MIZORAM", associatedSensorId: "SN-MZR-CHA-01", populationAtRisk: 9500, shelterName: "Champhai Agri Complex", shelterStatus: "Clear" },
  { name: "Serchhip (Rural Clusters)", stateKey: "MIZORAM", associatedSensorId: "SN-MZR-SER-01", populationAtRisk: 8200, shelterName: "Serchhip Block HQ", shelterStatus: "Standby" },
  { name: "Lawngtlai (Hill Settlements)", stateKey: "MIZORAM", associatedSensorId: "SN-MZR-LAW-01", populationAtRisk: 12400, shelterName: "Lawngtlai Relief Camp", shelterStatus: "Active" },

  // MANIPUR
  { name: "Imphal West (Valley Cuttings)", stateKey: "MANIPUR", associatedSensorId: "SN-MNP-IMP-01", populationAtRisk: 14000, shelterName: "Imphal Stadium Bhavan", shelterStatus: "Clear" },
  { name: "Ukhrul District (Rural Hamlets)", stateKey: "MANIPUR", associatedSensorId: "SN-MNP-UKH-01", populationAtRisk: 24500, shelterName: "Ukhrul Parish Hall", shelterStatus: "Active" },
  { name: "Tamenglong (Tribal Reserve)", stateKey: "MANIPUR", associatedSensorId: "SN-MNP-TAM-01", populationAtRisk: 28000, shelterName: "Tamenglong Town Hall", shelterStatus: "Active" },
  { name: "Senapati District (Feeder Roads)", stateKey: "MANIPUR", associatedSensorId: "SN-MNP-SEN-01", populationAtRisk: 12000, shelterName: "Senapati Welfare School", shelterStatus: "Standby" },
  { name: "Churachandpur (Hill Clusters)", stateKey: "MANIPUR", associatedSensorId: "SN-MNP-CHU-01", populationAtRisk: 15500, shelterName: "CC-Pur Relief Camp", shelterStatus: "Standby" },

  // ARUNACHAL
  { name: "Papum Pare (Itanagar Slopes)", stateKey: "ARUNACHAL", associatedSensorId: "SN-ARN-ITA-01", populationAtRisk: 18000, shelterName: "Itanagar Banquet Hall", shelterStatus: "Standby" },
  { name: "East Siang (Pasighat Slopes)", stateKey: "ARUNACHAL", associatedSensorId: "SN-ARN-PAS-01", populationAtRisk: 12500, shelterName: "Pasighat Relief Depot", shelterStatus: "Clear" },
  { name: "Tawang District (Valley Slopes)", stateKey: "ARUNACHAL", associatedSensorId: "SN-ARN-TAW-01", populationAtRisk: 24500, shelterName: "Tawang Monastery Dorms", shelterStatus: "Active" },
  { name: "West Kameng (Bomdila Hamlets)", stateKey: "ARUNACHAL", associatedSensorId: "SN-ARN-BOM-01", populationAtRisk: 15000, shelterName: "Bomdila Community Club", shelterStatus: "Active" },
  { name: "Lower Subansiri (Ziro Valley)", stateKey: "ARUNACHAL", associatedSensorId: "SN-ARN-ZIR-01", populationAtRisk: 9500, shelterName: "Ziro Welfare Bhavan", shelterStatus: "Standby" },
  { name: "Anjaw District (Border Hamlets)", stateKey: "ARUNACHAL", associatedSensorId: "SN-ARN-ANJ-01", populationAtRisk: 6200, shelterName: "Anjaw Border Relief Post", shelterStatus: "Active" },

  // TRIPURA
  { name: "West Tripura (Agartala Ridges)", stateKey: "TRIPURA", associatedSensorId: "SN-TPR-AGA-01", populationAtRisk: 5200, shelterName: "Agartala Town Club", shelterStatus: "Clear" },
  { name: "North Tripura (Jampui Slopes)", stateKey: "TRIPURA", associatedSensorId: "SN-TPR-JAM-01", populationAtRisk: 15800, shelterName: "Jampui Tourist Lodge", shelterStatus: "Standby" },
  { name: "Unakoti District (Dharmanagar)", stateKey: "TRIPURA", associatedSensorId: "SN-TPR-DHA-01", populationAtRisk: 8200, shelterName: "Dharmanagar Degree College", shelterStatus: "Clear" },
  { name: "Dhalai District (Hill Clusters)", stateKey: "TRIPURA", associatedSensorId: "SN-TPR-DHL-01", populationAtRisk: 12200, shelterName: "Dhalai Block Shelter", shelterStatus: "Standby" }
];

export const Dashboard: React.FC<DashboardProps> = ({ apiBaseUrl, onNavigateToRouting }) => {
  const { sensors, corridors, alerts, loading, refresh } = useLiveTelemetry(apiBaseUrl, 15000);
  
  // Filtering state
  const [filterAlert, setFilterAlert] = useState<string>("ALL");
  const [filterState, setFilterState] = useState<string>("ALL");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [sarOpen, setSarOpen] = useState<boolean>(false);

  // Selection states for inspector modal
  const [inspectorOpen, setInspectorOpen] = useState<boolean>(false);
  const [isAlertDrawerOpen, setIsAlertDrawerOpen] = useState<boolean>(true);
  const [selectedSegmentDetail, setSelectedSegmentDetail] = useState<any>(null);
  const [selectedSensorDetail, setSelectedSensorDetail] = useState<SensorNodeData | null>(null);

  // Detour routing navigator for alerts
  const handleViewDetourOnMap = (alert: CAPAlertData) => {
    if (!onNavigateToRouting) return;
    const info = alert.info[0];
    const text = `${info.headline || ""} ${info.event || ""} ${info.description || ""} ${info.area?.[0]?.areaDesc || ""}`.toLowerCase();

    let origin = "Guwahati";
    let destination = "Kohima";

    if (text.includes("aizawl") || text.includes("serchhip") || text.includes("mizoram") || text.includes("lunglei")) {
      origin = "Aizawl";
      destination = "Serchhip";
    } else if (text.includes("dima hasao") || text.includes("haflong") || text.includes("lumding")) {
      origin = "Guwahati";
      destination = "Haflong";
    } else if (text.includes("sikkim") || text.includes("gangtok") || text.includes("nh-10") || text.includes("teesta") || text.includes("kalimpong")) {
      origin = "Siliguri";
      destination = "Gangtok";
    } else if (text.includes("imphal") || text.includes("manipur") || text.includes("senapati")) {
      origin = "Guwahati";
      destination = "Imphal";
    } else if (text.includes("kohima") || text.includes("nh-29") || text.includes("chumoukedima") || text.includes("nagaland")) {
      origin = "Guwahati";
      destination = "Kohima";
    }

    onNavigateToRouting({ origin, destination, autoCalculate: true });
  };

  // Crowdsourced incidents
  const [citizenReports, setCitizenReports] = useState<any[]>([]);
  const [reportsLoading, setReportsLoading] = useState<boolean>(false);

  const fetchReports = async () => {
    setReportsLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/reports/list`);
      if (response.ok) {
        setCitizenReports(await response.json());
      } else {
        throw new Error();
      }
    } catch {
      setCitizenReports(mockApi.getReports());
    } finally {
      setReportsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [apiBaseUrl]);

  const handleVerifyReport = async (reportId: number) => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/reports/${reportId}/verify?verified=true`, {
        method: "POST",
      });
      if (response.ok) {
        fetchReports();
        refresh();
      } else {
        throw new Error();
      }
    } catch {
      mockApi.verifyReport(reportId, true);
      fetchReports();
      refresh();
    }
  };

  const handleRevokeReport = async (reportId: number) => {
    try {
      await fetch(`${apiBaseUrl}/api/v1/reports/${reportId}/verify?verified=false`, {
        method: "POST",
      });
    } catch {}
    mockApi.verifyReport(reportId, false);
    fetchReports();
    refresh();
  };

  const handleRejectReport = async (reportId: number) => {
    try {
      await fetch(`${apiBaseUrl}/api/v1/reports/${reportId}/reject`, {
        method: "POST",
      });
    } catch {}
    mockApi.rejectReport(reportId);
    fetchReports();
    refresh();
  };

  const handleDeleteReport = async (reportId: number) => {
    if (!window.confirm(`Are you sure you want to permanently delete Incident #${reportId}?`)) return;
    try {
      await fetch(`${apiBaseUrl}/api/v1/reports/${reportId}`, {
        method: "DELETE",
      });
    } catch {}
    mockApi.deleteReport(reportId);
    fetchReports();
    refresh();
  };

  const handleSegmentSelect = (segmentId: number) => {
    const detail = mockApi.getSegmentForecast(segmentId);
    if (detail) {
      // Calibrated geomorphic values matching segment IDs
      let slope = 32.5;
      let elevation = 1200;
      let dist = 30;
      let type = "Lifeline Corridor";
      let state = "Assam";
      let district = "Dima Hasao";
      let curvature = 0.082;

      if (segmentId === 101) { slope = 28.5; elevation = 650; dist = 150; type = "Lifeline Corridor"; state = "Sikkim"; district = "Kalimpong"; curvature = 0.042; }
      else if (segmentId === 102) { slope = 42.0; elevation = 1650; dist = 50; type = "Urban Center"; state = "Sikkim"; district = "East Sikkim"; curvature = 0.125; }
      else if (segmentId === 201) { slope = 18.0; elevation = 250; dist = 350; type = "Lifeline Corridor"; state = "Nagaland"; district = "Dimapur"; curvature = -0.015; }
      else if (segmentId === 202) { slope = 39.5; elevation = 1440; dist = 20; type = "Urban Center"; state = "Nagaland"; district = "Kohima"; curvature = 0.095; }
      else if (segmentId === 401) { slope = 12.0; elevation = 320; dist = 450; type = "Lifeline Corridor"; state = "Assam"; district = "Kamrup Metro"; curvature = -0.024; }
      else if (segmentId === 402) { slope = 24.5; elevation = 1520; dist = 120; type = "Urban Center"; state = "Meghalaya"; district = "East Khasi Hills"; curvature = 0.038; }
      else if (segmentId === 403) { slope = 31.0; elevation = 1380; dist = 80; type = "Rural Village"; state = "Meghalaya"; district = "West Khasi Hills"; curvature = 0.054; }
      else if (segmentId === 404) { slope = 46.5; elevation = 1100; dist = 40; type = "Lifeline Corridor"; state = "Assam"; district = "Dima Hasao"; curvature = 0.142; }
      else if (segmentId === 501) { slope = 22.0; elevation = 1150; dist = 180; type = "Lifeline Corridor"; state = "Mizoram"; district = "Serchhip"; curvature = 0.012; }
      else if (segmentId === 502) { slope = 38.0; elevation = 1220; dist = 60; type = "Rural Village"; state = "Mizoram"; district = "Lunglei"; curvature = 0.088; }
      else if (segmentId === 601) { slope = 15.4; elevation = 480; dist = 380; type = "Lifeline Corridor"; state = "Arunachal"; district = "East Siang"; curvature = -0.005; }
      else if (segmentId === 602) { slope = 44.5; elevation = 2200; dist = 40; type = "Rural Village"; state = "Arunachal"; district = "Tawang"; curvature = 0.112; }
      else if (segmentId === 701) { slope = 14.5; elevation = 780; dist = 420; type = "Lifeline Corridor"; state = "Manipur"; district = "Senapati"; curvature = -0.012; }
      else if (segmentId === 702) { slope = 42.5; elevation = 1680; dist = 50; type = "Rural Village"; state = "Manipur"; district = "Ukhrul"; curvature = 0.098; }
      else if (segmentId === 801) { slope = 10.5; elevation = 180; dist = 480; type = "Lifeline Corridor"; state = "Tripura"; district = "Unakoti"; curvature = -0.035; }
      else if (segmentId === 802) { slope = 35.8; elevation = 930; dist = 80; type = "Rural Village"; state = "Tripura"; district = "North Tripura"; curvature = 0.075; }

      setSelectedSegmentDetail({
        ...detail,
        slope,
        elevation,
        dist,
        type,
        state,
        district,
        curvature,
        sop: getSopInstructions(detail.forecast.risk_score)
      });
      setSelectedSensorDetail(null);
      setInspectorOpen(true);
    }
  };

  const handleSensorSelect = (sensorId: string) => {
    const sensor = sensors.find(s => s.id === sensorId);
    if (sensor) {
      setSelectedSensorDetail(sensor);
      setSelectedSegmentDetail(null);
      setInspectorOpen(true);
    }
  };

  const getSopInstructions = (riskScore: number) => {
    if (riskScore >= 9.0) {
      return {
        tier: "Critical Red Alert",
        color: "text-alertRed border-alertRed/35 bg-alertRed/5 animate-pulse",
        text: "🚨 SOP MANDATE: Mobilize NDRF/SDRF emergency evac. Suspend all transit routes. Initiate village evacuation."
      };
    }
    if (riskScore >= 7.0) {
      return {
        tier: "High Orange Warning",
        color: "text-alertOrange border-alertOrange/30 bg-alertOrange/5",
        text: "⚠️ HIGH PRECAUTION: Halt commercial transport. Stage border clearing machinery. Place local rescue cells on standby."
      };
    }
    if (riskScore >= 4.0) {
      return {
        tier: "Moderate Yellow Advisory",
        color: "text-alertYellow border-alertYellow/30 bg-alertYellow/5",
        text: "📢 CAUTION ADVISORY: Restrict high-speed transit. Deploy regional weather sweep patrols. Monitor soil VWC closely."
      };
    }
    return {
      tier: "Low Green Baseline",
      color: "text-alertGreen border-alertGreen/30 bg-alertGreen/5",
      text: "✅ NOMINAL baseline: Continue routine EWS monitoring on piezometer and inclinometers. Dry slope status."
    };
  };

  const getDistrictAlertLevel = (sensorId: string) => {
    const s = sensors.find(node => node.id === sensorId);
    if (!s) return { label: "Low", color: "text-alertGreen bg-alertGreen/10 border-alertGreen/20", score: 2.0 };
    const r = computeSensorRisk(s);
    return { label: r.shortLabel, color: `${r.tailwindText} ${r.tailwindBg} ${r.tailwindBorder}`, score: r.score };
  };

  // Filter application
  const filteredSensors = sensors.filter(s => {
    const risk = computeSensorRisk(s).score;

    if (filterAlert === "RED" && risk < 9.0) return false;
    if (filterAlert === "ORANGE" && (risk < 7.0 || risk >= 9.0)) return false;
    if (filterAlert === "YELLOW" && (risk < 4.0 || risk >= 7.0)) return false;
    if (filterAlert === "GREEN" && risk >= 4.0) return false;

    // Filter State
    if (filterState !== "ALL") {
      const code = filterState === "ASSAM" ? "ASM" 
                 : filterState === "MEG" ? "MEG"
                 : filterState === "SIKKIM" ? "SKM"
                 : filterState === "NGL" ? "NGL"
                 : filterState === "MIZORAM" ? "MZR"
                 : filterState === "MANIPUR" ? "MNP"
                 : filterState === "ARUNACHAL" ? "ARN"
                 : "TPR";
      if (!s.id.includes(`-${code}-`)) return false;
    }

    // Filter Type
    if (filterType === "URBAN" && !s.name.toLowerCase().includes("municipal") && !s.name.toLowerCase().includes("city") && !s.name.toLowerCase().includes("town") && !s.name.toLowerCase().includes("capital")) return false;
    if (filterType === "RURAL" && !s.name.toLowerCase().includes("rural") && !s.name.toLowerCase().includes("tribal") && !s.name.toLowerCase().includes("farming") && !s.name.toLowerCase().includes("hamlet") && !s.name.toLowerCase().includes("valley") && !s.name.toLowerCase().includes("settlement")) return false;
    if (filterType === "INFRASTRUCTURE" && !s.name.toLowerCase().includes("slope") && !s.name.toLowerCase().includes("cutting") && !s.name.toLowerCase().includes("corridor") && !s.name.toLowerCase().includes("line") && !s.name.toLowerCase().includes("link") && !s.name.toLowerCase().includes("road")) return false;

    return true;
  });

  const filteredCorridors = corridors.map(c => {
    const filteredSections = c.sections.filter(sec => {
      const risk = sec.risk_score;
      if (filterAlert === "RED" && risk < 9.0) return false;
      if (filterAlert === "ORANGE" && (risk < 7.0 || risk >= 9.0)) return false;
      if (filterAlert === "YELLOW" && (risk < 4.0 || risk >= 7.0)) return false;
      if (filterAlert === "GREEN" && risk >= 4.0) return false;

      // State matching
      if (filterState !== "ALL") {
        if (filterState === "SIKKIM" && !c.name.includes("Gangtok")) return false;
        if (filterState === "NGL" && !c.name.includes("Kohima")) return false;
        if (filterState === "MEG" && !c.name.includes("Shillong") && !c.name.includes("Tura")) return false;
        if (filterState === "MIZORAM" && !c.name.includes("Aizawl")) return false;
        if (filterState === "ASSAM" && !c.name.includes("Silchar") && !c.name.includes("Guwahati") && !sec.section.includes("Hasao")) return false;
        if (filterState === "ARUNACHAL" && !c.name.includes("Itanagar")) return false;
        if (filterState === "MANIPUR" && !c.name.includes("Imphal")) return false;
        if (filterState === "TRIPURA" && !c.name.includes("Agartala")) return false;
      }

      // Type matching
      if (filterType === "URBAN" && !sec.section.toLowerCase().includes("town") && !sec.section.toLowerCase().includes("city") && !sec.section.toLowerCase().includes("municipal")) return false;
      if (filterType === "RURAL" && !sec.section.toLowerCase().includes("village") && !sec.section.toLowerCase().includes("tribal") && !sec.section.toLowerCase().includes("hamlet")) return false;
      if (filterType === "INFRASTRUCTURE" && !sec.section.toLowerCase().includes("cut") && !sec.section.toLowerCase().includes("bypass") && !sec.section.toLowerCase().includes("link") && !sec.section.toLowerCase().includes("corridor") && !sec.section.toLowerCase().includes("road")) return false;

      return true;
    });

    return {
      ...c,
      sections: filteredSections
    };
  }).filter(c => c.sections.length > 0);

  // Filter District cards
  const filteredDistricts = DISTRICT_BREAKDOWNS.filter(d => {
    if (filterState !== "ALL" && d.stateKey !== filterState) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto text-textPrimary">
      {/* Aggregate State Resilience Index widget */}
      <div className="glass-panel rounded-2xl p-4 bg-bgCard shadow-sm">
        <StateResilienceWidget 
          sensors={sensors}
          selectedState={filterState}
          onStateSelect={(st) => setFilterState(st)}
        />
      </div>

      {/* Filters Command Controls Bar */}
      <div className="glass-panel rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm bg-bgCard">
        <div className="flex items-center gap-2 text-xs font-black uppercase text-textSecondary shrink-0">
          <Filter className="w-4 h-4 text-blue-600" /> Command Filter Controls:
        </div>
        
        <div className="grid grid-cols-2 md:flex items-center gap-3 w-full justify-end">
          {/* Alert Level Filter */}
          <div className="flex flex-col w-full md:w-auto">
            <span className="text-[9px] font-bold text-textMuted uppercase mb-1">Alert Level</span>
            <select
              value={filterAlert}
              onChange={(e) => setFilterAlert(e.target.value)}
              className="bg-bgPrimary border border-borderColor rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none"
            >
              <option value="ALL">All Alert Levels</option>
              <option value="GREEN">Green (Low Risk)</option>
              <option value="YELLOW">Yellow (Caution)</option>
              <option value="ORANGE">Orange (Warning)</option>
              <option value="RED">Red (Critical)</option>
            </select>
          </div>

          {/* State Filter */}
          <div className="flex flex-col w-full md:w-auto">
            <span className="text-[9px] font-bold text-textMuted uppercase mb-1">State Selection</span>
            <select
              value={filterState}
              onChange={(e) => setFilterState(e.target.value)}
              className="bg-bgPrimary border border-borderColor rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none"
            >
              <option value="ALL">All 8 States</option>
              <option value="ASSAM">Assam</option>
              <option value="MEG">Meghalaya</option>
              <option value="SIKKIM">Sikkim</option>
              <option value="NGL">Nagaland</option>
              <option value="MIZORAM">Mizoram</option>
              <option value="MANIPUR">Manipur</option>
              <option value="ARUNACHAL">Arunachal Pradesh</option>
              <option value="TRIPURA">Tripura</option>
            </select>
          </div>

          {/* Terrain / Settlement Type */}
          <div className="flex flex-col w-full md:w-auto">
            <span className="text-[9px] font-bold text-textMuted uppercase mb-1">Terrain Category</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-bgPrimary border border-borderColor rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none"
            >
              <option value="ALL">All Categories</option>
              <option value="URBAN">Urban Municipal Slopes</option>
              <option value="RURAL">Rural / Tribal Settlements</option>
              <option value="INFRASTRUCTURE">Critical Feeder Tracks / Bypasses</option>
            </select>
          </div>

          <div className="col-span-2 md:col-span-1 flex items-end">
            <button
              onClick={refresh}
              className="w-full md:w-auto px-4 py-2 border border-borderColor bg-bgPrimary hover:bg-borderColor/30 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Sync Grid
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Columns: GIS Map Container & Citizen Reports */}
        <div className="lg:col-span-2 space-y-6 flex flex-col">
          <div className="glass-panel rounded-2xl p-4 flex-grow relative min-h-[520px] flex flex-col bg-bgCard">
            <div className="flex items-center justify-between mb-3 border-b border-borderColor pb-2">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-blue-600/10 text-blue-600 shrink-0">
                  <Layers className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-sm font-extrabold tracking-tight">Geo-AI Command Grid</h2>
                  <p className="text-[10px] text-textSecondary">Use top map overlays to toggle cloudburst feeds or NERDRR perimeters. Pulsing rings show dynamic IoT threat status.</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <div className="hidden sm:flex items-center gap-3 text-[10px] font-bold text-textSecondary bg-bgPrimary px-3 py-1 rounded-lg border border-borderColor shadow-sm">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-alertGreen inline-block"></span> Low</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-alertYellow inline-block"></span> Caution</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-alertOrange inline-block"></span> Warning</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-alertRed inline-block"></span> Critical</span>
                </div>
              </div>
            </div>
            
            {/* Alert Drawer */}
            <div className="mb-4 bg-bgPrimary border border-borderColor rounded-xl overflow-hidden shadow-sm">
              <button 
                onClick={() => setIsAlertDrawerOpen(!isAlertDrawerOpen)}
                className="w-full flex items-center justify-between p-3 bg-bgCard hover:bg-bgPrimary transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-alertRed/10 text-alertRed shrink-0">
                    <AlertTriangle className="w-4 h-4 animate-pulse" />
                  </span>
                  <span className="text-xs font-extrabold uppercase tracking-widest text-textPrimary">
                    🚨 Active Regional Hazard Advisories ({alerts.length} Alerts)
                  </span>
                </div>
                {isAlertDrawerOpen ? <ChevronUp className="w-4 h-4 text-textSecondary" /> : <ChevronDown className="w-4 h-4 text-textSecondary" />}
              </button>
              
              {isAlertDrawerOpen && (
                <div className="p-3 border-t border-borderColor space-y-2 bg-bgPrimary max-h-60 overflow-y-auto">
                  {alerts.length === 0 ? (
                    <div className="text-center py-4 text-textMuted text-xs font-bold">No active hazard advisories.</div>
                  ) : (
                    alerts.map(alert => {
                      const info = alert.info[0];
                      let badge = "";
                      let color = "";
                      if (info.severity === "Extreme") {
                        badge = "[CRITICAL RED ALERT]";
                        color = "bg-alertRed/10 text-alertRed border-alertRed/30";
                      } else if (info.severity === "Severe") {
                        badge = "[HIGH ORANGE WARNING]";
                        color = "bg-alertOrange/10 text-alertOrange border-alertOrange/30";
                      } else {
                        badge = "[MODERATE YELLOW CAUTION]";
                        color = "bg-alertYellow/10 text-alertYellow border-alertYellow/30";
                      }

                      return (
                        <div key={alert.identifier} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border border-borderColor bg-bgCard hover:border-borderColor/80 transition">
                          <div className="flex items-start gap-3">
                            <span className={`px-2 py-1 rounded-md text-[9px] font-black tracking-widest uppercase border shrink-0 ${color}`}>
                              {badge}
                            </span>
                            <div>
                              <div className="text-xs font-bold text-textPrimary">{info.headline || info.event}</div>
                              <div className="text-[10px] text-textSecondary mt-0.5 line-clamp-1">{info.description}</div>
                            </div>
                          </div>
                          <button 
                            onClick={() => handleViewDetourOnMap(alert)}
                            className="shrink-0 px-3.5 py-1.5 bg-blue-600/10 hover:bg-blue-600 border border-blue-600/30 hover:border-blue-600 text-blue-500 hover:text-white text-[9px] font-black uppercase rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                            title="Open Safe Routing and compute detour bypass for this hazard"
                          >
                            <span>View Detour Route on Map</span>
                            <span className="text-[11px]">──►</span>
                          </button>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>
            
            {/* GIS Map */}
            <div className="flex-grow min-h-[460px] rounded-xl overflow-hidden relative border border-borderColor">
              <GISMap 
                corridors={filteredCorridors}
                sensors={filteredSensors}
                activeRoute={null}
                onSegmentSelect={handleSegmentSelect}
                onSensorSelect={handleSensorSelect}
              />
            </div>
          </div>

          {/* Citizen Feeds */}
          <div className="glass-panel rounded-2xl p-5 bg-bgCard">
            <div className="flex items-center justify-between mb-4 border-b border-borderColor pb-2">
              <div>
                <h3 className="text-sm font-extrabold text-textPrimary flex items-center gap-2">
                  <Database className="w-5 h-5 text-blue-600" /> Crowdsourced Incident Feeds
                </h3>
                <p className="text-[10px] text-textSecondary">Community reports update routing bypass calculations in real-time</p>
              </div>
              <button 
                onClick={fetchReports}
                className="p-1.5 rounded-lg bg-bgPrimary border border-borderColor hover:bg-borderColor/50 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${reportsLoading ? "animate-spin" : ""}`} />
              </button>
            </div>

            <div className="overflow-x-auto max-h-[220px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-borderColor text-textSecondary font-bold uppercase tracking-wider text-[9px]">
                    <th className="py-2.5 px-3">Location</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Proximity</th>
                    <th className="py-2.5 px-3">Crack Metrics</th>
                    <th className="py-2.5 px-3">Severity</th>
                    <th className="py-2.5 px-3">Details</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borderColor/60 font-semibold text-textSecondary">
                  {citizenReports.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-4 text-center text-textMuted font-bold">No active community blockage submissions.</td>
                    </tr>
                  ) : (
                    citizenReports.map((report) => (
                      <tr key={report.id} className="hover:bg-bgPrimary/20 transition">
                        <td className="py-2.5 px-3 font-mono font-bold text-textPrimary text-[10px]">
                          {report.latitude.toFixed(4)}, {report.longitude.toFixed(4)}
                        </td>
                        <td className="py-2.5 px-3 text-textPrimary">{report.category || "Slope Slump"}</td>
                        <td className="py-2.5 px-3">{report.settlement_proximity || "N/A"}</td>
                        <td className="py-2.5 px-3 font-mono text-[10px]">
                          {report.crack_length > 0 ? `${report.crack_length}m × ${report.crack_depth}m` : "None"}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black ${
                            report.severity === "CRITICAL" || report.severity === "HIGH" 
                              ? "bg-alertRed/10 text-alertRed border border-alertRed/20" 
                              : "bg-alertYellow/10 text-alertYellow border border-alertYellow/20"
                          }`}>
                            {report.severity}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 max-w-[150px] truncate" title={report.description}>
                          {report.description || "No description"}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {report.verified ? (
                              <>
                                <span className="text-alertGreen font-black flex items-center gap-1 text-[9px] bg-alertGreen/10 border border-alertGreen/20 px-2 py-0.5 rounded">
                                  <CheckCircle2 className="w-3 h-3" /> VERIFIED
                                </span>
                                <button
                                  onClick={() => handleRevokeReport(report.id)}
                                  className="px-2 py-0.5 bg-bgCard hover:bg-borderColor/50 border border-borderColor text-textSecondary rounded text-[9px] font-bold transition flex items-center gap-1"
                                  title="Revoke verification"
                                >
                                  <RotateCcw className="w-2.5 h-2.5" /> Revoke
                                </button>
                              </>
                            ) : report.rejected ? (
                              <>
                                <span className="text-alertRed font-black flex items-center gap-1 text-[9px] bg-alertRed/10 border border-alertRed/20 px-2 py-0.5 rounded">
                                  <XCircle className="w-3 h-3" /> REJECTED
                                </span>
                                <button
                                  onClick={() => handleRevokeReport(report.id)}
                                  className="px-2 py-0.5 bg-bgCard hover:bg-borderColor/50 border border-borderColor text-textSecondary rounded text-[9px] font-bold transition flex items-center gap-1"
                                  title="Restore to pending"
                                >
                                  <RotateCcw className="w-2.5 h-2.5" /> Reopen
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => handleVerifyReport(report.id)}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[9px] font-bold transition flex items-center gap-1 shadow-sm"
                                title="Verify Report"
                              >
                                <ShieldCheck className="w-3 h-3" /> Verify
                              </button>
                            )}

                            {!report.rejected && (
                              <button
                                onClick={() => handleRejectReport(report.id)}
                                className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded text-[9px] font-bold transition flex items-center gap-1"
                                title="Reject Report"
                              >
                                <XCircle className="w-3 h-3" /> Reject
                              </button>
                            )}

                            <button
                              onClick={() => handleDeleteReport(report.id)}
                              className="p-1 hover:bg-alertRed/15 text-textMuted hover:text-alertRed rounded transition"
                              title="Permanently Delete Report"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Breakdown Cards & Corridor Status */}
        <div className="space-y-6 flex flex-col justify-between">
          
          {/* Dynamic District & Village Breakdown Cards */}
          <div className="glass-panel rounded-2xl p-5 bg-bgCard border border-borderColor flex-grow flex flex-col">
            <div className="border-b border-borderColor pb-2.5 mb-3 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-xs text-textPrimary uppercase flex items-center gap-1.5">
                  <Home className="w-4 h-4 text-blue-600" /> District & Village Breakdowns
                </h3>
                <p className="text-[9px] text-textSecondary">State aggregate status updates based on local IoT telemetry</p>
              </div>
              <span className="px-2 py-0.5 bg-blue-600/10 text-blue-600 border border-blue-600/20 rounded text-[9px] font-black uppercase">
                {filteredDistricts.length} Listed
              </span>
            </div>

            {/* Scrollable grid container for breakdowns */}
            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1 flex-grow">
              {filteredDistricts.length === 0 ? (
                <div className="py-8 text-center text-textMuted text-xs font-bold border border-dashed border-borderColor rounded-xl">
                  No districts matching the active state filter.
                </div>
              ) : (
                filteredDistricts.map((d, idx) => {
                  const alert = getDistrictAlertLevel(d.associatedSensorId);

                  return (
                    <div 
                      key={idx} 
                      className="p-3 rounded-xl bg-bgPrimary border border-borderColor hover:border-borderColor/80 transition flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1 text-left min-w-0">
                        <strong className="text-textPrimary font-extrabold block truncate text-[11px]">{d.name}</strong>
                        <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[9px] font-semibold text-textSecondary">
                          <span className="flex items-center gap-0.5 text-textMuted"><Users className="w-3 h-3 text-textMuted" /> Risk: <strong className="text-textPrimary">{(d.populationAtRisk / 1000).toFixed(1)}k</strong></span>
                          <span className="flex items-center gap-0.5 text-textMuted"><Home className="w-3 h-3 text-textMuted" /> Shelter: <strong className={d.shelterStatus === "Active" ? "text-blue-600" : "text-textPrimary"}>{d.shelterName}</strong></span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black border uppercase tracking-wider ${alert.color}`}>
                          {alert.label}
                        </span>
                        <div className="text-[9px] font-bold text-textMuted font-mono mt-1">Node: {d.associatedSensorId.split("-")[2] || d.associatedSensorId}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          
          {/* Corridor status overview */}
          <RoadCorridorStatus 
            corridors={filteredCorridors}
            apiBaseUrl={apiBaseUrl}
            onRefresh={refresh}
            isAdmin={true}
          />

          {/* ISRO MOSDAC info summary */}
          <div className="glass-panel rounded-2xl p-5 bg-bgCard border border-borderColor bg-gradient-to-br from-blue-600/5 to-transparent">
            <div className="flex items-center justify-between mb-3 border-b border-borderColor pb-2">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-blue-600/10 text-blue-600 shrink-0">
                  <Radio className="w-5 h-5 animate-pulse" />
                </span>
                <div>
                  <h3 className="font-extrabold text-xs text-textPrimary uppercase">Weather Satellite Sync</h3>
                  <p className="text-[9px] text-textSecondary">Precipitation Ingestion & Cloudburst Indicators</p>
                </div>
              </div>
              <span className="px-2 py-0.5 bg-blue-600/10 text-blue-600 border border-blue-600/20 rounded text-[9px] font-black uppercase">
                Active Feed
              </span>
            </div>
            
            <div className="space-y-2 text-xs leading-relaxed font-semibold text-textSecondary">
              <div className="flex justify-between border-b border-borderColor pb-1.5">
                <span className="text-textMuted">Live Precipitation Grid</span>
                <span className="text-textPrimary font-bold">GSMap ISRO Rain (GS-Rain-01)</span>
              </div>
              <div className="flex justify-between border-b border-borderColor pb-1.5">
                <span className="text-textMuted">Landslide Baseline Layer</span>
                <span className="text-textPrimary font-bold">GSI Susceptibility (1:50,000)</span>
              </div>
              <div className="flex justify-between pb-0.5">
                <span className="text-textMuted">Satellite Sync Status</span>
                <span className="text-alertGreen font-black flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 15m Auto Sync OK
                </span>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* ==========================================
          INSPECTOR MODAL / SLIDE OVERLAY PANEL
         ========================================== */}
      {inspectorOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="glass-panel bg-bgCard border border-borderColor rounded-3xl p-6 w-full max-w-lg shadow-2xl relative flex flex-col space-y-4 text-textPrimary animate-slideUp">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-borderColor pb-3">
              <div>
                <h3 className="font-black text-base text-textPrimary uppercase">
                  {selectedSegmentDetail ? selectedSegmentDetail.segment_name : selectedSensorDetail?.name}
                </h3>
                <p className="text-[10px] text-textSecondary font-bold">
                  {selectedSegmentDetail ? `Sector: ${selectedSegmentDetail.section}` : `IoT Station ID: ${selectedSensorDetail?.id}`}
                </p>
              </div>
              <button 
                onClick={() => setInspectorOpen(false)}
                className="p-1.5 rounded-lg border border-borderColor hover:bg-bgPrimary transition text-textSecondary hover:text-textPrimary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content - Geomorphic and Hydrological metrics */}
            {selectedSegmentDetail && (
              <div className="space-y-4">
                
                {/* 1. Risk Gauge Score Dial */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <RiskDial score={selectedSegmentDetail.forecast.risk_score} />
                  
                  {/* Geographic Stats Card */}
                  <div className="p-4 bg-bgCard border border-borderColor rounded-2xl shadow-sm flex flex-col justify-center space-y-2 text-xs font-semibold">
                    <div className="text-[10px] text-textMuted uppercase font-black border-b border-borderColor pb-1.5 mb-1 flex items-center justify-between">
                      <span>Terrain Geomorphics</span>
                      <span className="text-blue-600 font-bold">30m SRTM DEM</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-textSecondary font-bold">Slope Angle:</span>
                      <span className="text-textPrimary font-black">{selectedSegmentDetail.slope.toFixed(1)}°</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-textSecondary font-bold">Elevation MSL:</span>
                      <span className="text-textPrimary font-black">{selectedSegmentDetail.elevation} m</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-textSecondary font-bold">Infra Distance:</span>
                      <span className="text-textPrimary font-black">{selectedSegmentDetail.dist} m</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-textSecondary font-bold">Slope Curvature:</span>
                      <span className="text-textPrimary font-black">{selectedSegmentDetail.curvature.toFixed(3)}</span>
                    </div>
                  </div>
                </div>

                {/* 2. SOP Action Protocol Card */}
                <div className={`p-4 rounded-2xl border ${selectedSegmentDetail.sop.color} text-xs font-semibold shadow-sm`}>
                  <div className="flex items-center gap-1.5 uppercase font-black tracking-wider text-[10px] mb-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    Action Protocol Card: {selectedSegmentDetail.sop.tier}
                  </div>
                  <p className="text-textPrimary font-bold leading-relaxed">
                    {selectedSegmentDetail.sop.text}
                  </p>
                </div>

                {/* 3. Hydrological metrics */}
                <div className="p-4 bg-bgCard rounded-2xl border border-borderColor text-xs space-y-2.5 shadow-sm">
                  <div className="text-[10px] text-textMuted font-black uppercase tracking-wider border-b border-borderColor pb-1.5 flex items-center justify-between">
                    <span>Hydrological Metrics (In-Situ)</span>
                    <span className="text-emerald-600 font-bold">Telemetry Live</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-textSecondary font-semibold">
                    <div className="p-2 bg-bgPrimary rounded-xl border border-borderColor">
                      <div className="text-[9px] text-textMuted uppercase font-bold">24h Rain Gauge</div>
                      <div className="text-xs font-black text-textPrimary">{selectedSegmentDetail.telemetry.rain_24h_obs.toFixed(1)} mm</div>
                    </div>
                    <div className="p-2 bg-bgPrimary rounded-xl border border-borderColor">
                      <div className="text-[9px] text-textMuted uppercase font-bold">7-Day API Index</div>
                      <div className="text-xs font-black text-textPrimary">{selectedSegmentDetail.telemetry.api_7d.toFixed(1)} mm</div>
                    </div>
                    <div className="p-2 bg-bgPrimary rounded-xl border border-borderColor">
                      <div className="text-[9px] text-textMuted uppercase font-bold">Soil Moisture VWC</div>
                      <div className="text-xs font-black text-blue-600 dark:text-blue-400">{selectedSegmentDetail.telemetry.soil_moisture.toFixed(1)}%</div>
                    </div>
                    <div className="p-2 bg-bgPrimary rounded-xl border border-borderColor">
                      <div className="text-[9px] text-textMuted uppercase font-bold">Seasonal Anomaly</div>
                      <div className="text-xs font-black text-textPrimary">{selectedSegmentDetail.telemetry.r24_seasonal_anom.toFixed(1)} mm</div>
                    </div>
                  </div>
                </div>

                {/* 4. SHAP Explainer */}
                <div className="space-y-2.5">
                  <h4 className="text-[10px] font-bold text-textMuted uppercase tracking-wider flex items-center gap-1">
                    <BarChart3 className="w-4 h-4 text-blue-600" /> SHAP Trigger Contributions
                  </h4>
                  <div className="space-y-2">
                    {Object.entries(selectedSegmentDetail.shap_values).map(([feat, val]: [string, any]) => {
                      const percent = Math.min(100, Math.max(5, (Math.abs(val) / 0.5) * 100));
                      const isPositive = val >= 0;

                      return (
                        <div key={feat} className="text-[10px] leading-snug font-semibold text-textSecondary">
                          <div className="flex justify-between text-textPrimary mb-0.5">
                            <span>{feat.replace(/_/g, " ").toUpperCase()}</span>
                            <span className={isPositive ? "text-alertRed" : "text-alertGreen"}>
                              {isPositive ? "+" : ""}{val.toFixed(3)}
                            </span>
                          </div>
                          <div className="w-full bg-bgPrimary rounded-full h-1.5 overflow-hidden border border-borderColor">
                            <div 
                              className={`h-full rounded-full ${isPositive ? "bg-alertRed" : "bg-alertGreen"}`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            )}

            {/* Modal Content - Sensor Node details */}
            {selectedSensorDetail && (
              <div className="space-y-4">
                <div className="p-4 bg-bgPrimary border border-borderColor rounded-2xl text-xs space-y-2 font-semibold text-textSecondary">
                  <div className="text-[9px] font-black uppercase text-textMuted border-b border-borderColor pb-1">Sensor Ingest Readouts</div>
                  <div className="flex justify-between">
                    <span>Soil Volumetric Water (VWC %):</span>
                    <span className="text-blue-600 font-bold">{selectedSensorDetail.soil_moisture.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>24h Rain Accumulation:</span>
                    <span className="text-textPrimary font-bold">{selectedSensorDetail.rain_24h_obs.toFixed(1)} mm</span>
                  </div>
                  <div className="flex justify-between">
                    <span>48h Prior Rain:</span>
                    <span className="text-textPrimary font-bold">{selectedSensorDetail.rain_48h_prior.toFixed(1)} mm</span>
                  </div>
                  <div className="flex justify-between">
                    <span>7-Day Prior Accumulation:</span>
                    <span className="text-textPrimary font-bold">{selectedSensorDetail.rain_7d_prior.toFixed(1)} mm</span>
                  </div>
                  <div className="flex justify-between">
                    <span>7d API Index:</span>
                    <span className="text-textPrimary font-bold">{selectedSensorDetail.api_7d.toFixed(1)} mm</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Precipitation Seasonal Anomaly:</span>
                    <span className="text-alertOrange font-bold">{selectedSensorDetail.r24_seasonal_anom.toFixed(1)} mm</span>
                  </div>
                  <div className="flex justify-between">
                    <span>API Seasonal Anomaly Z-score:</span>
                    <span className="text-textPrimary font-bold">{selectedSensorDetail.api_seasonal_anom.toFixed(1)} mm</span>
                  </div>
                </div>

                <div className="p-3 bg-blue-500/5 border border-blue-500/15 rounded-2xl text-[11px] font-semibold leading-relaxed text-textSecondary">
                  💡 This IoT weather station logs meteorological and sub-surface moisture anomalies continuously. Readouts are ingested every 15 minutes by the two-tier AI predictor to compute dynamic slope trigger probabilities.
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <button
              onClick={() => setInspectorOpen(false)}
              className="w-full py-2 bg-bgPrimary hover:bg-borderColor/40 border border-borderColor rounded-xl text-xs font-bold transition text-textPrimary"
            >
              Close Inspector
            </button>

          </div>
        </div>
      )}

      {/* Live Sentinel-2 model screening modal */}
      {sarOpen && <SARInspector apiBaseUrl={apiBaseUrl} onClose={() => setSarOpen(false)} />}

    </div>
  );
};
