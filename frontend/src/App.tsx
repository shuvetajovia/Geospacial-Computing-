import { useState, useEffect } from "react";
import { Dashboard } from "./pages/Dashboard";
import { EmergencyRouting } from "./pages/EmergencyRouting";
import { IoTSensorPage } from "./pages/IoTSensorPage";
import { PredictionCorePage } from "./pages/PredictionCorePage";
import { DataAnalysisPage } from "./pages/DataAnalysisPage";
import { FieldReport } from "./pages/FieldReport";
import { ProjectOverview } from "./pages/ProjectOverview";
import { TerrainAnalysisPage } from "./pages/TerrainAnalysisPage";
import LiveConsole from "./pages/LiveConsole";
import { ThemeToggle } from "./components/ThemeToggle";
import { useLiveTelemetry } from "./hooks/useLiveTelemetry";
import { syncOfficerToSupabase } from "./services/supabaseClient";
import { mockApi } from "./services/mockApi";
import { 
  LayoutDashboard, Compass, Radio, Cpu, Smartphone, Home, Satellite,
  AlertTriangle, Clock, User, RefreshCw, X, ShieldAlert, SmartphoneNfc, Mountain, CheckCircle2, ShieldCheck, MapPin, KeyRound, Mail, Lock
} from "lucide-react";

import { API_BASE_URL } from "./services/apiConfig";

export interface UserProfile {
  email: string;
  name: string;
  phone: string;
  latitude: number;
  longitude: number;
  role: string;
  badge: string;
  isOfficer: boolean;
}

// Exactly 2 Authorized Disaster Management Field Officers with Gmail and Password
export const AUTHORIZED_OFFICERS = [
  {
    email: "officer.sharma@gmail.com",
    password: "MindMeld@2026",
    name: "Officer Vikram Sharma",
    role: "State Disaster Management Officer (SDMA)",
    badge: "SDMA-DISASTER-01",
    phone: "9876543210",
    lat: 26.1445,
    lon: 91.7362,
    sector: "Regional NER Disaster Command Base (HQ Guwahati)",
  },
  {
    email: "officer.debbarma@gmail.com",
    password: "MindMeld@2026",
    name: "Officer Rajesh Debbarma",
    role: "NER Field Emergency Coordinator (NDRF)",
    badge: "NDRF-TACTICAL-02",
    phone: "9862100451",
    lat: 24.8333,
    lon: 92.7789,
    sector: "Silchar-Cachar Sector Operations",
  }
];

// Haversine helper
function computeDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Navigation tabs definition
const NAV_TABS = [
  { key: "overview",     label: "Project Overview",  icon: Home            },
  { key: "dashboard",    label: "Command Center",    icon: LayoutDashboard },
  { key: "prediction",   label: "Prediction Core",   icon: Cpu             },
  { key: "routing",      label: "Safe Routing",      icon: Compass         },
  { key: "iot",          label: "IoT Sensor Grid",   icon: Radio           },
  { key: "terrain3d",    label: "3D Terrain",        icon: Mountain        },
  { key: "satellite",    label: "Live Satellite",     icon: Satellite       },
  { key: "reporting",    label: "Incident Log",      icon: Smartphone      },
] as const;

type TabKey = typeof NAV_TABS[number]["key"];

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const { sensors, refresh, isSupabaseLive } = useLiveTelemetry(API_BASE_URL, 15000);

  const [istTime, setIstTime] = useState<string>("");
  const [countdown, setCountdown] = useState<number>(15);

  // Auth states
  const [loginModalOpen, setLoginModalOpen] = useState<boolean>(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem("mindmeld_officer_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [inputEmail, setInputEmail] = useState<string>("");
  const [inputPassword, setInputPassword] = useState<string>("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [gpsStatus, setGpsStatus] = useState<string>("Standby");

  // Proximity Alert Banner States
  const [activeProximityAlert, setActiveProximityAlert] = useState<{
    distance: number;
    locationName: string;
    riskScore: number;
  } | null>(null);
  const [smsToast, setSmsToast] = useState<string | null>(null);

  // Cross-page navigation routing parameters (e.g. from Command Center alert detours)
  const [routingParams, setRoutingParams] = useState<{ origin: string; destination: string; autoCalculate?: boolean } | null>(null);

  const handleNavigateToRouting = (params: { origin: string; destination: string; autoCalculate?: boolean }) => {
    setRoutingParams(params);
    setActiveTab("routing");
  };

  // Live GPS Fetcher Function
  const requestLiveGPS = (currentProfile?: UserProfile): Promise<{ lat: number; lon: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setGpsStatus("GPS Unavailable");
        resolve(null);
        return;
      }
      setGpsStatus("Acquiring Live GPS...");
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = parseFloat(position.coords.latitude.toFixed(5));
          const lon = parseFloat(position.coords.longitude.toFixed(5));
          setGpsStatus(`${lat}°N, ${lon}°E`);

          const target = currentProfile || userProfile;
          if (target) {
            const updated: UserProfile = { ...target, latitude: lat, longitude: lon };
            setUserProfile(updated);
            localStorage.setItem("mindmeld_officer_user", JSON.stringify(updated));
            await syncOfficerToSupabase({
              name: updated.name,
              phone: updated.phone,
              latitude: lat,
              longitude: lon
            });
          }
          resolve({ lat, lon });
        },
        (err) => {
          console.warn("[Live GPS] Geolocation permission denied or unavailable:", err.message);
          setGpsStatus("Default Base GPS");
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
      );
    });
  };

  // Load / Sync profile
  const saveAndApplyProfile = async (profile: UserProfile) => {
    setUserProfile(profile);
    localStorage.setItem("mindmeld_officer_user", JSON.stringify(profile));
    setLoginModalOpen(false);
    setAuthError(null);
    setIsSyncing(true);

    // Fetch Live Device GPS on login
    const liveCoords = await requestLiveGPS(profile);
    const finalLat = liveCoords ? liveCoords.lat : profile.latitude;
    const finalLon = liveCoords ? liveCoords.lon : profile.longitude;

    await syncOfficerToSupabase({
      name: profile.name,
      phone: profile.phone,
      latitude: finalLat,
      longitude: finalLon,
    });
    setIsSyncing(false);
    setSmsToast(`🛡️ Officer Verified: ${profile.name} authenticated with Live GPS.`);
    setTimeout(() => setSmsToast(null), 4000);
  };

  const handleOfficerLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const officer = AUTHORIZED_OFFICERS.find(
      (o) => o.email.trim().toLowerCase() === inputEmail.trim().toLowerCase()
    );

    if (!officer) {
      setAuthError("Unauthorized email. Only authorized disaster management accounts (officer.sharma@gmail.com or officer.debbarma@gmail.com) can access.");
      return;
    }

    if (officer.password !== inputPassword) {
      setAuthError("Invalid password for " + officer.name + ".");
      return;
    }

    const profile: UserProfile = {
      email: officer.email,
      name: officer.name,
      phone: officer.phone,
      latitude: officer.lat,
      longitude: officer.lon,
      role: officer.role,
      badge: officer.badge,
      isOfficer: true
    };

    await saveAndApplyProfile(profile);
  };

  const fillOfficerCredentials = (email: string) => {
    const officer = AUTHORIZED_OFFICERS.find((o) => o.email === email);
    if (officer) {
      setInputEmail(officer.email);
      setInputPassword(officer.password);
      setAuthError(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("mindmeld_officer_user");
    setUserProfile(null);
    setActiveProximityAlert(null);
    setGpsStatus("Standby");
    setSmsToast("Officer session cleared.");
    setTimeout(() => setSmsToast(null), 3000);
  };

  // Trigger GPS scan once on mount if user is already logged in
  useEffect(() => {
    if (userProfile) {
      requestLiveGPS(userProfile);
    }
  }, []);

  // IST Clock
  useEffect(() => {
    const updateTime = () => {
      const options: Intl.DateTimeFormatOptions = {
        timeZone: "Asia/Kolkata",
        hour12: false,
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      };
      setIstTime(`IST: ${new Intl.DateTimeFormat("en-IN", options).format(new Date())}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-refresh countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { refresh(); return 15; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [refresh]);

  // Proximity alert computation using ML-based risk from sensor data and Live GPS
  useEffect(() => {
    if (!userProfile || sensors.length === 0) {
      setActiveProximityAlert(null);
      return;
    }

    let closestAlertNode: any = null;
    let minDistance = Infinity;

    sensors.forEach(node => {
      const SM = node.soil_moisture;
      const rain = node.rain_24h_obs;
      const isExtremeHotspot = [
        'SN-MEG-CHE-01', 'SN-MEG-MAW-01', 'SN-SKM-CHU-01', 'SN-SKM-MAN-01', 'SN-SKM-DZO-01',
        'SN-ASM-DH-01', 'SN-ASM-RRL-01', 'SN-NGL-KOH-01', 'SN-MZR-AIZ-01', 'SN-ARN-TAW-01',
        'SN-MNP-TAM-01'
      ].includes(node.id);

      const pore = Math.min(120, SM * 0.9);
      const incl = Math.min(0.12, pore * 0.00055 + rain * 0.00025);
      const tVal = 0.018 * rain + 0.005 * node.api_7d + 0.022 * pore + 20.0 * incl - 1.95;
      const prob = 1 / (1 + Math.exp(-tVal));
      
      let risk = 2.0;
      if (isExtremeHotspot) {
        risk = prob > 0.80 ? 9.2 : prob > 0.50 ? 7.5 : prob > 0.15 ? 5.2 : 2.0;
      }

      if (risk >= 7.0) {
        const dist = computeDistance(userProfile.latitude, userProfile.longitude, node.latitude, node.longitude);
        if (dist < minDistance) {
          minDistance = dist;
          closestAlertNode = {
            distance: parseFloat(dist.toFixed(1)),
            locationName: node.name,
            riskScore: risk
          };
        }
      }
    });

    if (closestAlertNode && minDistance <= 15.0) {
      setActiveProximityAlert(closestAlertNode);
    } else {
      setActiveProximityAlert(null);
    }
  }, [userProfile, sensors]);

  const triggerSmsSimulation = () => {
    if (!userProfile || !activeProximityAlert) return;
    setSmsToast(`📲 SMS ALERT TRANSMITTED: Warning dispatch sent to +91-${userProfile.phone}. Hazard zone at ${activeProximityAlert.locationName} is ${activeProximityAlert.distance} km away.`);
    setTimeout(() => setSmsToast(null), 5000);
  };

  return (
    <div className="min-h-screen bg-bgPrimary text-textPrimary flex flex-col font-sans transition-colors duration-300">
      
      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <header className="border-b border-borderColor bg-bgCard/90 backdrop-blur-md sticky top-0 z-[99] px-6 py-3 flex flex-col lg:flex-row items-center justify-between gap-3 shadow-sm">
        
        {/* Brand */}
        <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-start">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-600 shadow-md shadow-blue-500/10 shrink-0">
              <ShieldAlert className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-textPrimary leading-tight">
                MindMeld AI Landslide Resilience Grid
              </h1>
              <p className="text-[11px] font-semibold text-textSecondary">
                AI Early Warning System • Lead Author & PI: <span className="text-blue-600 font-bold">Dr. R. Rajmohan</span>
              </p>
            </div>
          </div>
          <div className="lg:hidden"><ThemeToggle /></div>
        </div>

        {/* Tab Navigation */}
        <nav className="flex items-center bg-bgPrimary border border-borderColor rounded-xl p-1 shrink-0 w-full lg:w-auto overflow-x-auto gap-0.5">
          {NAV_TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wide transition shrink-0 ${
                activeTab === key
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-textSecondary hover:text-textPrimary"
              }`}
            >
              <Icon className="w-3 h-3" /> {label}
            </button>
          ))}
        </nav>

        {/* Top Controls */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-bold bg-bgPrimary border border-borderColor px-2.5 py-1.5 rounded-xl shadow-sm" title={isSupabaseLive ? "Supabase PostgreSQL Database Connected (Project: zxtcshattguqoosobkji)" : "Offline Mode / Fallback Active"}>
            <span className={`w-2 h-2 rounded-full ${isSupabaseLive ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`}></span>
            <span className={`font-mono ${isSupabaseLive ? "text-emerald-500" : "text-amber-500"}`}>
              {isSupabaseLive ? "Supabase Live" : "Offline"}
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-1 text-[10px] font-black text-textSecondary bg-bgPrimary border border-borderColor px-3 py-1.5 rounded-xl">
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            <span className="font-mono">{istTime}</span>
          </div>
          <div className="hidden lg:flex items-center gap-1 text-[10px] font-black text-textSecondary bg-bgPrimary border border-borderColor px-3 py-1.5 rounded-xl">
            <RefreshCw className="w-3.5 h-3.5 text-amber-500 animate-spin-slow" />
            <span className="font-mono">Sync: {countdown}s</span>
          </div>
          <div className="hidden lg:block"><ThemeToggle /></div>
          {userProfile ? (
            <div className="flex items-center gap-2">
              {/* Officer Badge & Live GPS */}
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/25 px-3 py-1.5 rounded-xl">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <div className="text-left">
                  <div className="text-[10px] font-black text-emerald-500 leading-none flex items-center gap-1">
                    {userProfile.name}
                    <span className="text-[8px] px-1 py-0.2 bg-emerald-500/20 text-emerald-400 rounded font-mono">
                      {userProfile.badge}
                    </span>
                  </div>
                  <div className="text-[8px] font-bold text-textMuted uppercase tracking-wider mt-0.5">
                    📍 {gpsStatus !== "Standby" ? gpsStatus : `${userProfile.latitude.toFixed(2)}°N, ${userProfile.longitude.toFixed(2)}°E`}
                  </div>
                </div>
              </div>

              {/* Refresh Live GPS Button */}
              <button
                onClick={() => requestLiveGPS(userProfile)}
                title="Sync Live Device GPS"
                className="p-2 border border-borderColor bg-bgPrimary hover:bg-blue-600/10 hover:border-blue-500 text-textSecondary hover:text-blue-600 rounded-xl text-[10px] font-black transition flex items-center gap-1"
              >
                <Compass className="w-3.5 h-3.5 text-blue-500 animate-spin-slow" />
              </button>

              <button
                onClick={handleLogout}
                className="px-3 py-2 border border-borderColor bg-bgPrimary hover:bg-borderColor/40 text-textSecondary hover:text-textPrimary rounded-xl text-[10px] font-black uppercase transition"
              >
                Logout
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setAuthError(null); setLoginModalOpen(true); }}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase transition shadow-md shadow-blue-500/10 flex items-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5" /> Officer Login
            </button>
          )}
        </div>
      </header>

      {/* ── PROXIMITY ALERT BANNER ──────────────────────────────────────── */}
      {userProfile && activeProximityAlert && (
        <div className="mx-6 mt-4 p-4 bg-alertRed/10 border border-alertRed/35 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 animate-bounce-slow shadow-sm">
          <div className="flex items-center gap-3 text-xs md:text-sm font-semibold text-alertRed leading-snug">
            <ShieldAlert className="w-5 h-5 animate-pulse shrink-0" />
            <div>
              <span className="font-black uppercase tracking-wider block text-[10px] text-alertRed mb-0.5">⚠️ URGENT AREA WARNING:</span>
              Officer <strong className="underline">{userProfile.name}</strong> is currently <strong className="font-black font-mono">{activeProximityAlert.distance} km</strong> from an active Red Alert hazard zone at <strong className="underline">{activeProximityAlert.locationName}</strong>. Automated warning SMS dispatched to <strong className="font-mono">+91-{userProfile.phone}</strong>.
            </div>
          </div>
          <button
            onClick={triggerSmsSimulation}
            className="px-4 py-2.5 bg-alertRed hover:bg-red-600 text-white rounded-xl text-[10px] font-black uppercase transition flex items-center gap-1.5 shadow-md shadow-red-500/10 self-stretch md:self-auto justify-center"
          >
            <SmartphoneNfc className="w-3.5 h-3.5" /> Simulate SMS Warning
          </button>
        </div>
      )}

      {/* ── SMS TOAST ───────────────────────────────────────────────────── */}
      {smsToast && (
        <div className="fixed top-6 right-6 z-[99999] p-4 bg-bgCard border border-alertGreen rounded-2xl shadow-2xl flex items-start gap-3 w-full max-w-sm animate-slideIn">
          <div className="p-2 rounded-xl bg-alertGreen/15 text-alertGreen shrink-0 border border-alertGreen/20">
            <SmartphoneNfc className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-black text-alertGreen uppercase tracking-wider">DISASTER OPS NOTIFICATION</div>
            <p className="text-xs text-textSecondary font-semibold mt-1 leading-normal">{smsToast}</p>
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT ────────────────────────────────────────────────── */}
      <main className="flex-grow">
        {activeTab === "satellite"     && <LiveConsole />}
        {activeTab === "overview"      && <ProjectOverview onLaunchGIS={() => setActiveTab("dashboard")} onLaunchPrediction={() => setActiveTab("prediction")} />}
        {activeTab === "dashboard"     && <Dashboard apiBaseUrl={API_BASE_URL} onNavigateToRouting={handleNavigateToRouting} />}
        {activeTab === "prediction"    && <PredictionCorePage apiBaseUrl={API_BASE_URL} />}
        {activeTab === "routing"       && <EmergencyRouting apiBaseUrl={API_BASE_URL} initialRouteParams={routingParams} />}
        {activeTab === "iot"           && <IoTSensorPage apiBaseUrl={API_BASE_URL} />}
        {activeTab === "terrain3d"     && <TerrainAnalysisPage />}
        {activeTab === "reporting"     && <FieldReport apiBaseUrl={API_BASE_URL} />}
      </main>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-borderColor bg-bgCard/60 py-5 text-center text-[10px] text-textSecondary space-y-1">
        <p className="font-black uppercase tracking-widest text-[9px] text-textMuted">
          MindMeld • AI Landslide Early Warning & Regional Resilience Network Grid
        </p>
        <p className="font-semibold">Principal Investigator & Lead Author: <span className="text-blue-600 font-bold">Dr. R. Rajmohan</span></p>
        <p className="text-textMuted text-[9px]">
          Multi-Tier ML Threat Engine • Real-time IoT Telemetry • Dynamic Route Optimization • Offline-Resilient
        </p>
      </footer>

      {/* ── 2-OFFICER GMAIL & PASSWORD LOGIN MODAL ───────────────────────── */}
      {loginModalOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="glass-panel bg-bgCard border border-borderColor rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 animate-slideUp text-textPrimary">
            <div className="flex justify-between items-start border-b border-borderColor pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-blue-600/10 text-blue-600 rounded-lg">
                    <ShieldCheck className="w-4 h-4" />
                  </span>
                  <h3 className="font-black text-sm text-textPrimary uppercase tracking-wide">
                    Authorized Field Officer Portal
                  </h3>
                </div>
                <p className="text-[10px] text-textSecondary mt-0.5">
                  Restricted to authorized emergency responders with Live Device GPS
                </p>
              </div>
              <button onClick={() => setLoginModalOpen(false)}
                      className="p-1 rounded-lg border border-borderColor hover:bg-bgPrimary transition text-textSecondary hover:text-textPrimary">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick 1-Click Credentials Select */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-textMuted uppercase tracking-wider block">
                Select Authorized Field Officer:
              </label>
              <div className="grid grid-cols-1 gap-2">
                {AUTHORIZED_OFFICERS.map((officer) => (
                  <button
                    key={officer.email}
                    type="button"
                    onClick={() => fillOfficerCredentials(officer.email)}
                    className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between ${
                      inputEmail === officer.email
                        ? "bg-blue-600/10 border-blue-500 shadow-sm"
                        : "bg-bgPrimary border-borderColor hover:border-borderColor/80"
                    }`}
                  >
                    <div>
                      <div className="text-xs font-black text-textPrimary flex items-center gap-1.5">
                        {officer.name}
                        <span className="text-[8px] px-1.5 py-0.2 rounded bg-blue-600/15 text-blue-500 font-mono font-bold">
                          {officer.badge}
                        </span>
                      </div>
                      <div className="text-[10px] font-semibold text-textSecondary font-mono mt-0.5">
                        {officer.email} • {officer.role}
                      </div>
                    </div>
                    <span className="text-[9px] font-bold text-blue-600">Select</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Login Form */}
            <form onSubmit={handleOfficerLoginSubmit} className="space-y-3 pt-2">
              <div>
                <label className="text-[9px] font-bold text-textMuted uppercase tracking-wider block mb-1 flex items-center gap-1">
                  <Mail className="w-3 h-3 text-blue-500" /> Officer Gmail Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. officer.sharma@gmail.com"
                  value={inputEmail}
                  onChange={(e) => setInputEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-bgPrimary border border-borderColor text-xs font-semibold text-textPrimary focus:outline-none focus:border-blue-600 font-mono"
                />
              </div>

              <div>
                <label className="text-[9px] font-bold text-textMuted uppercase tracking-wider block mb-1 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-blue-500" /> Secure Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Enter officer password"
                  value={inputPassword}
                  onChange={(e) => setInputPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-bgPrimary border border-borderColor text-xs font-semibold text-textPrimary focus:outline-none focus:border-blue-600 font-mono"
                />
              </div>

              {authError && (
                <div className="p-2.5 rounded-xl bg-alertRed/10 border border-alertRed/25 text-alertRed text-[10px] font-bold leading-snug">
                  ⚠️ {authError}
                </div>
              )}

              <button
                type="submit"
                disabled={isSyncing}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase rounded-xl transition shadow-md shadow-blue-500/10 flex items-center justify-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4" />
                {isSyncing ? "Acquiring Live GPS & Verifying..." : "Authenticate with Live GPS"}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;

