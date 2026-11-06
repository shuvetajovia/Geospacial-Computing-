// Mock API Server for Client-Side Offline Resilience
// Stores state in localStorage and implements Landslide risk models and routing.

import { SensorNodeData, CorridorData, CAPAlertData } from "../hooks/useLiveTelemetry";
import { SafeRouteResponse } from "../types/routing";

// --- HELPERS ---
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// --- INITIAL SEED DATA (40 STATIONS SPANNING ALL 8 NER STATES) ---
const INITIAL_SENSORS: SensorNodeData[] = [
  // 1. ASSAM
  {
    id: "SN-ASM-GUA-01",
    name: "Guwahati Hill Slopes (Kamrup Metro)",
    latitude: 26.1445,
    longitude: 91.7362,
    soil_moisture: 28.5,
    rain_24h_obs: 25.0,
    rain_48h_prior: 18.0,
    rain_72h_prior: 12.0,
    rain_7d_prior: 60.0,
    api_7d: 65.4,
    r24_seasonal_anom: 2.5,
    api_seasonal_anom: 5.2,
    last_updated: new Date().toISOString()
  },
  {
    id: "SN-ASM-SIL-01",
    name: "Silchar Hillocks (Cachar)",
    latitude: 24.8333,
    longitude: 92.7789,
    soil_moisture: 32.1,
    rain_24h_obs: 40.0,
    rain_48h_prior: 30.0,
    rain_72h_prior: 15.0,
    rain_7d_prior: 90.0,
    api_7d: 98.4,
    r24_seasonal_anom: 10.4,
    api_seasonal_anom: 15.6,
    last_updated: new Date().toISOString()
  },
  {
    id: "SN-ASM-DH-01",
    name: "Dima Hasao Rural Settlements",
    latitude: 25.1833,
    longitude: 93.0167,
    soil_moisture: 58.4,
    rain_24h_obs: 195.0,
    rain_48h_prior: 130.0,
    rain_72h_prior: 90.0,
    rain_7d_prior: 320.0,
    api_7d: 350.5,
    r24_seasonal_anom: 98.5,
    api_seasonal_anom: 142.4,
    last_updated: new Date().toISOString()
  },
  {
    id: "SN-ASM-HAF-01",
    name: "Haflong Tribal Slopes",
    latitude: 25.1667,
    longitude: 93.0300,
    soil_moisture: 49.5,
    rain_24h_obs: 110.0,
    rain_48h_prior: 85.0,
    rain_72h_prior: 55.0,
    rain_7d_prior: 220.0,
    api_7d: 238.2,
    r24_seasonal_anom: 45.2,
    api_seasonal_anom: 62.4,
    last_updated: new Date().toISOString()
  },
  {
    id: "SN-ASM-KA-01",
    name: "Karbi Anglong Remote Hamlets",
    latitude: 25.8489,
    longitude: 93.4385,
    soil_moisture: 35.2,
    rain_24h_obs: 38.0,
    rain_48h_prior: 28.0,
    rain_72h_prior: 20.0,
    rain_7d_prior: 110.0,
    api_7d: 122.5,
    r24_seasonal_anom: 8.2,
    api_seasonal_anom: 18.5,
    last_updated: new Date().toISOString()
  },
  {
    id: "SN-ASM-RRL-01",
    name: "Lumding–Badarpur Hill Railway Line",
    latitude: 25.0210,
    longitude: 93.0230,
    soil_moisture: 62.4,
    rain_24h_obs: 215.0,
    rain_48h_prior: 145.0,
    rain_72h_prior: 110.0,
    rain_7d_prior: 380.0,
    api_7d: 410.2,
    r24_seasonal_anom: 112.5,
    api_seasonal_anom: 165.4,
    last_updated: new Date().toISOString()
  },

  // 2. MEGHALAYA
  {
    id: "SN-MEG-SHI-01",
    name: "Shillong Municipal Cuts",
    latitude: 25.5788,
    longitude: 91.8831,
    soil_moisture: 30.5,
    rain_24h_obs: 18.0,
    rain_48h_prior: 15.0,
    rain_72h_prior: 10.0,
    rain_7d_prior: 55.0,
    api_7d: 62.4,
    r24_seasonal_anom: -2.4,
    api_seasonal_anom: -5.6,
    last_updated: new Date().toISOString()
  },
  {
    id: "SN-MEG-TUR-01",
    name: "Tura Town Slopes",
    latitude: 25.5140,
    longitude: 90.2200,
    soil_moisture: 34.2,
    rain_24h_obs: 35.0,
    rain_48h_prior: 25.0,
    rain_72h_prior: 18.0,
    rain_7d_prior: 95.0,
    api_7d: 108.2,
    r24_seasonal_anom: 4.8,
    api_seasonal_anom: 12.4,
    last_updated: new Date().toISOString()
  },
  {
    id: "SN-MEG-CHE-01",
    name: "Cherrapunji Terraced Valleys",
    latitude: 25.2702,
    longitude: 91.7323,
    soil_moisture: 42.1,
    rain_24h_obs: 125.0,
    rain_48h_prior: 110.0,
    rain_72h_prior: 95.0,
    rain_7d_prior: 480.0,
    api_7d: 512.4,
    r24_seasonal_anom: 52.4,
    api_seasonal_anom: 110.2,
    last_updated: new Date().toISOString()
  },
  {
    id: "SN-MEG-MAW-01",
    name: "Mawsynram Tribal Hamlets",
    latitude: 25.3000,
    longitude: 91.5833,
    soil_moisture: 45.6,
    rain_24h_obs: 135.0,
    rain_48h_prior: 115.0,
    rain_72h_prior: 98.0,
    rain_7d_prior: 510.0,
    api_7d: 542.8,
    r24_seasonal_anom: 58.5,
    api_seasonal_anom: 120.6,
    last_updated: new Date().toISOString()
  },
  {
    id: "SN-MEG-EKH-01",
    name: "East Khasi Hills Connectors",
    latitude: 25.4200,
    longitude: 91.9000,
    soil_moisture: 33.1,
    rain_24h_obs: 22.0,
    rain_48h_prior: 18.0,
    rain_72h_prior: 12.0,
    rain_7d_prior: 70.0,
    api_7d: 79.5,
    r24_seasonal_anom: 1.5,
    api_seasonal_anom: 4.8,
    last_updated: new Date().toISOString()
  },

  // 3. SIKKIM
  {
    id: "SN-SKM-GAN-01",
    name: "Gangtok Municipal Slopes",
    latitude: 27.3314,
    longitude: 88.6138,
    soil_moisture: 52.4,
    rain_24h_obs: 135.0,
    rain_48h_prior: 110.0,
    rain_72h_prior: 80.0,
    rain_7d_prior: 280.0,
    api_7d: 310.2,
    r24_seasonal_anom: 68.5,
    api_seasonal_anom: 104.2,
    last_updated: new Date().toISOString()
  },
  {
    id: "SN-SKM-NAM-01",
    name: "Namchi Urban Ridge",
    latitude: 27.1667,
    longitude: 88.3500,
    soil_moisture: 39.2,
    rain_24h_obs: 55.0,
    rain_48h_prior: 45.0,
    rain_72h_prior: 32.0,
    rain_7d_prior: 140.0,
    api_7d: 154.6,
    r24_seasonal_anom: 12.4,
    api_seasonal_anom: 22.5,
    last_updated: new Date().toISOString()
  },
  {
    id: "SN-SKM-MAN-01",
    name: "Mangan Rural Farming Slopes",
    latitude: 27.5000,
    longitude: 88.5167,
    soil_moisture: 59.8,
    rain_24h_obs: 178.0,
    rain_48h_prior: 140.0,
    rain_72h_prior: 105.0,
    rain_7d_prior: 340.0,
    api_7d: 375.4,
    r24_seasonal_anom: 82.6,
    api_seasonal_anom: 125.4,
    last_updated: new Date().toISOString()
  },
  {
    id: "SN-SKM-DZO-01",
    name: "Dzongu Tribal Reserve",
    latitude: 27.5300,
    longitude: 88.4800,
    soil_moisture: 61.2,
    rain_24h_obs: 185.0,
    rain_48h_prior: 150.0,
    rain_72h_prior: 120.0,
    rain_7d_prior: 360.0,
    api_7d: 398.2,
    r24_seasonal_anom: 90.5,
    api_seasonal_anom: 138.6,
    last_updated: new Date().toISOString()
  },
  {
    id: "SN-SKM-CHU-01",
    name: "Chungthang Valley Slope",
    latitude: 27.6042,
    longitude: 88.6472,
    soil_moisture: 64.5,
    rain_24h_obs: 220.0,
    rain_48h_prior: 175.0,
    rain_72h_prior: 140.0,
    rain_7d_prior: 410.0,
    api_7d: 448.5,
    r24_seasonal_anom: 118.4,
    api_seasonal_anom: 172.5,
    last_updated: new Date().toISOString()
  },

  // 4. NAGALAND
  {
    id: "SN-NGL-KOH-01",
    name: "Kohima Town Ridges",
    latitude: 25.6751,
    longitude: 94.1116,
    soil_moisture: 48.2,
    rain_24h_obs: 115.0,
    rain_48h_prior: 90.0,
    rain_72h_prior: 60.0,
    rain_7d_prior: 210.0,
    api_7d: 232.5,
    r24_seasonal_anom: 52.4,
    api_seasonal_anom: 78.6,
    last_updated: new Date().toISOString()
  },
  {
    id: "SN-NGL-MOK-01",
    name: "Mokokchung Urban Slopes",
    latitude: 26.3263,
    longitude: 94.5200,
    soil_moisture: 38.5,
    rain_24h_obs: 48.0,
    rain_48h_prior: 38.0,
    rain_72h_prior: 25.0,
    rain_7d_prior: 110.0,
    api_7d: 124.6,
    r24_seasonal_anom: 8.5,
    api_seasonal_anom: 15.4,
    last_updated: new Date().toISOString()
  },
  {
    id: "SN-NGL-PHE-01",
    name: "Phek Hill Farming Villages",
    latitude: 25.6667,
    longitude: 94.5000,
    soil_moisture: 35.4,
    rain_24h_obs: 32.0,
    rain_48h_prior: 28.0,
    rain_72h_prior: 20.0,
    rain_7d_prior: 95.0,
    api_7d: 104.5,
    r24_seasonal_anom: 2.1,
    api_seasonal_anom: 8.2,
    last_updated: new Date().toISOString()
  },
  {
    id: "SN-NGL-WOK-01",
    name: "Wokha Terraced Hamlets",
    latitude: 26.0833,
    longitude: 94.2500,
    soil_moisture: 42.6,
    rain_24h_obs: 68.0,
    rain_48h_prior: 52.0,
    rain_72h_prior: 35.0,
    rain_7d_prior: 145.0,
    api_7d: 162.8,
    r24_seasonal_anom: 18.4,
    api_seasonal_anom: 29.5,
    last_updated: new Date().toISOString()
  },
  {
    id: "SN-NGL-KIP-01",
    name: "Kiphire Remote Border Tracks",
    latitude: 25.9000,
    longitude: 94.7833,
    soil_moisture: 52.1,
    rain_24h_obs: 122.0,
    rain_48h_prior: 98.0,
    rain_72h_prior: 70.0,
    rain_7d_prior: 240.0,
    api_7d: 268.4,
    r24_seasonal_anom: 61.2,
    api_seasonal_anom: 88.5,
    last_updated: new Date().toISOString()
  },

  // 5. MIZORAM
  {
    id: "SN-MZR-AIZ-01",
    name: "Aizawl Capital Ridge Slopes",
    latitude: 23.7307,
    longitude: 92.7173,
    soil_moisture: 50.4,
    rain_24h_obs: 125.0,
    rain_48h_prior: 95.0,
    rain_72h_prior: 65.0,
    rain_7d_prior: 260.0,
    api_7d: 288.6,
    r24_seasonal_anom: 59.8,
    api_seasonal_anom: 92.4,
    last_updated: new Date().toISOString()
  },
  {
    id: "SN-MZR-LUN-01",
    name: "Lunglei Municipal Zone",
    latitude: 22.8864,
    longitude: 92.7483,
    soil_moisture: 44.5,
    rain_24h_obs: 78.0,
    rain_48h_prior: 58.0,
    rain_72h_prior: 40.0,
    rain_7d_prior: 175.0,
    api_7d: 195.4,
    r24_seasonal_anom: 22.4,
    api_seasonal_anom: 39.5,
    last_updated: new Date().toISOString()
  },
  {
    id: "SN-MZR-CHA-01",
    name: "Champhai Agricultural Slopes",
    latitude: 23.4757,
    longitude: 93.3277,
    soil_moisture: 38.6,
    rain_24h_obs: 42.0,
    rain_48h_prior: 32.0,
    rain_72h_prior: 22.0,
    rain_7d_prior: 115.0,
    api_7d: 128.5,
    r24_seasonal_anom: 8.5,
    api_seasonal_anom: 18.2,
    last_updated: new Date().toISOString()
  },
  {
    id: "SN-MZR-SER-01",
    name: "Serchhip Rural Clusters",
    latitude: 23.3000,
    longitude: 92.8333,
    soil_moisture: 35.8,
    rain_24h_obs: 35.0,
    rain_48h_prior: 25.0,
    rain_72h_prior: 18.0,
    rain_7d_prior: 98.0,
    api_7d: 108.4,
    r24_seasonal_anom: 4.2,
    api_seasonal_anom: 11.2,
    last_updated: new Date().toISOString()
  },
  {
    id: "SN-MZR-LAW-01",
    name: "Lawngtlai Hill Settlements",
    latitude: 22.5333,
    longitude: 92.9000,
    soil_moisture: 48.9,
    rain_24h_obs: 95.0,
    rain_48h_prior: 72.0,
    rain_72h_prior: 48.0,
    rain_7d_prior: 190.0,
    api_7d: 215.6,
    r24_seasonal_anom: 32.4,
    api_seasonal_anom: 49.5,
    last_updated: new Date().toISOString()
  },

  // 6. MANIPUR
  {
    id: "SN-MNP-IMP-01",
    name: "Imphal Valley Border Cuts",
    latitude: 24.8170,
    longitude: 93.9368,
    soil_moisture: 29.5,
    rain_24h_obs: 28.0,
    rain_48h_prior: 22.0,
    rain_72h_prior: 15.0,
    rain_7d_prior: 68.0,
    api_7d: 74.2,
    r24_seasonal_anom: 1.5,
    api_seasonal_anom: 4.2,
    last_updated: new Date().toISOString()
  },
  {
    id: "SN-MNP-UKH-01",
    name: "Ukhrul Rural Hamlets",
    latitude: 25.1167,
    longitude: 94.4333,
    soil_moisture: 52.4,
    rain_24h_obs: 145.0,
    rain_48h_prior: 110.0,
    rain_72h_prior: 82.0,
    rain_7d_prior: 275.0,
    api_7d: 304.5,
    r24_seasonal_anom: 62.4,
    api_seasonal_anom: 98.4,
    last_updated: new Date().toISOString()
  },
  {
    id: "SN-MNP-TAM-01",
    name: "Tamenglong Tribal Slopes",
    latitude: 24.9833,
    longitude: 93.5000,
    soil_moisture: 56.8,
    rain_24h_obs: 168.0,
    rain_48h_prior: 125.0,
    rain_72h_prior: 95.0,
    rain_7d_prior: 320.0,
    api_7d: 352.4,
    r24_seasonal_anom: 85.2,
    api_seasonal_anom: 124.6,
    last_updated: new Date().toISOString()
  },
  {
    id: "SN-MNP-SEN-01",
    name: "Senapati Feeder Tracks",
    latitude: 25.2667,
    longitude: 94.0667,
    soil_moisture: 38.6,
    rain_24h_obs: 48.0,
    rain_48h_prior: 38.0,
    rain_72h_prior: 25.0,
    rain_7d_prior: 120.0,
    api_7d: 132.8,
    r24_seasonal_anom: 10.4,
    api_seasonal_anom: 18.5,
    last_updated: new Date().toISOString()
  },
  {
    id: "SN-MNP-CHU-01",
    name: "Churachandpur Hill Clusters",
    latitude: 24.3333,
    longitude: 93.6833,
    soil_moisture: 42.5,
    rain_24h_obs: 72.0,
    rain_48h_prior: 54.0,
    rain_72h_prior: 36.0,
    rain_7d_prior: 155.0,
    api_7d: 172.4,
    r24_seasonal_anom: 22.4,
    api_seasonal_anom: 35.8,
    last_updated: new Date().toISOString()
  },

  // 7. ARUNACHAL PRADESH
  {
    id: "SN-ARN-ITA-01",
    name: "Itanagar Capital Slopes",
    latitude: 27.0844,
    longitude: 93.6053,
    soil_moisture: 38.2,
    rain_24h_obs: 45.0,
    rain_48h_prior: 38.0,
    rain_72h_prior: 24.0,
    rain_7d_prior: 110.0,
    api_7d: 124.2,
    r24_seasonal_anom: 12.4,
    api_seasonal_anom: 22.5,
    last_updated: new Date().toISOString()
  },
  {
    id: "SN-ARN-PAS-01",
    name: "Pasighat Hill Slopes",
    latitude: 28.0667,
    longitude: 95.3333,
    soil_moisture: 40.5,
    rain_24h_obs: 60.0,
    rain_48h_prior: 48.0,
    rain_72h_prior: 30.0,
    rain_7d_prior: 130.0,
    api_7d: 145.4,
    r24_seasonal_anom: 15.6,
    api_seasonal_anom: 25.8,
    last_updated: new Date().toISOString()
  },
  {
    id: "SN-ARN-TAW-01",
    name: "Tawang Valley Settlements",
    latitude: 27.5849,
    longitude: 91.8623,
    soil_moisture: 52.4,
    rain_24h_obs: 145.0,
    rain_48h_prior: 110.0,
    rain_72h_prior: 80.0,
    rain_7d_prior: 290.0,
    api_7d: 320.2,
    r24_seasonal_anom: 72.4,
    api_seasonal_anom: 112.5,
    last_updated: new Date().toISOString()
  },
  {
    id: "SN-ARN-BOM-01",
    name: "Bomdila Alpine Hamlets",
    latitude: 27.2667,
    longitude: 92.4000,
    soil_moisture: 44.5,
    rain_24h_obs: 88.0,
    rain_48h_prior: 68.0,
    rain_72h_prior: 45.0,
    rain_7d_prior: 180.0,
    api_7d: 202.4,
    r24_seasonal_anom: 28.5,
    api_seasonal_anom: 45.6,
    last_updated: new Date().toISOString()
  },
  {
    id: "SN-ARN-ZIR-01",
    name: "Ziro Valley Terraces",
    latitude: 27.5900,
    longitude: 93.8400,
    soil_moisture: 38.6,
    rain_24h_obs: 42.0,
    rain_48h_prior: 32.0,
    rain_72h_prior: 20.0,
    rain_7d_prior: 105.0,
    api_7d: 118.5,
    r24_seasonal_anom: 5.6,
    api_seasonal_anom: 12.4,
    last_updated: new Date().toISOString()
  },
  {
    id: "SN-ARN-ANJ-01",
    name: "Anjaw Remote Border Hamlets",
    latitude: 28.0167,
    longitude: 96.5000,
    soil_moisture: 58.4,
    rain_24h_obs: 185.0,
    rain_48h_prior: 140.0,
    rain_72h_prior: 110.0,
    rain_7d_prior: 350.0,
    api_7d: 385.2,
    r24_seasonal_anom: 95.0,
    api_seasonal_anom: 148.6,
    last_updated: new Date().toISOString()
  },

  // 8. TRIPURA
  {
    id: "SN-TPR-AGA-01",
    name: "Agartala Border Ridges",
    latitude: 23.8315,
    longitude: 91.2868,
    soil_moisture: 26.5,
    rain_24h_obs: 12.0,
    rain_48h_prior: 8.0,
    rain_72h_prior: 5.0,
    rain_7d_prior: 30.0,
    api_7d: 34.5,
    r24_seasonal_anom: -8.5,
    api_seasonal_anom: -12.4,
    last_updated: new Date().toISOString()
  },
  {
    id: "SN-TPR-JAM-01",
    name: "Jampui Hills Tribal Slopes",
    latitude: 23.9500,
    longitude: 92.2667,
    soil_moisture: 48.5,
    rain_24h_obs: 92.0,
    rain_48h_prior: 70.0,
    rain_72h_prior: 45.0,
    rain_7d_prior: 195.0,
    api_7d: 218.4,
    r24_seasonal_anom: 35.8,
    api_seasonal_anom: 52.4,
    last_updated: new Date().toISOString()
  },
  {
    id: "SN-TPR-DHA-01",
    name: "Dharmanagar Rural Slopes",
    latitude: 24.3667,
    longitude: 92.1667,
    soil_moisture: 33.5,
    rain_24h_obs: 25.0,
    rain_48h_prior: 18.0,
    rain_72h_prior: 12.0,
    rain_7d_prior: 62.0,
    api_7d: 70.8,
    r24_seasonal_anom: 1.2,
    api_seasonal_anom: 4.8,
    last_updated: new Date().toISOString()
  },
  {
    id: "SN-TPR-DHL-01",
    name: "Dhalai District Hill Clusters",
    latitude: 23.8500,
    longitude: 91.9000,
    soil_moisture: 39.5,
    rain_24h_obs: 52.0,
    rain_48h_prior: 38.0,
    rain_72h_prior: 22.0,
    rain_7d_prior: 118.0,
    api_7d: 132.6,
    r24_seasonal_anom: 12.4,
    api_seasonal_anom: 20.5,
    last_updated: new Date().toISOString()
  }
];

const INITIAL_CORRIDORS: CorridorData[] = [
  {
    name: "NH-10 (Siliguri - Gangtok)",
    status: "CAUTION",
    max_risk: 7.2,
    average_risk: 5.85,
    length_km: 114,
    sections: [
      {
        id: 101,
        section: "Siliguri - Kalimpong Junction",
        length_km: 65,
        risk_score: 4.5,
        risk_probability: 0.28,
        status: "CAUTION",
        coordinates: [
          [26.7271, 88.3953],
          [26.85, 88.42],
          [26.95, 88.44],
          [27.06, 88.47]
        ],
        slope_angle: 28.5,
        elevation: 650,
        distance_to_infrastructure: 0.15,
        primary_shap_trigger: "Rain Depth (24h)",
        sensor_node_id: "SN-SKM-GAN-01"
      } as any,
      {
        id: 102,
        section: "Kalimpong Cut Slope - Gangtok City Environs",
        length_km: 49,
        risk_score: 7.2,
        risk_probability: 0.68,
        status: "CAUTION",
        coordinates: [
          [27.06, 88.47],
          [27.15, 88.48],
          [27.25, 88.55],
          [27.3314, 88.6138]
        ],
        slope_angle: 42.0,
        elevation: 1650,
        distance_to_infrastructure: 0.05,
        primary_shap_trigger: "Soil Moisture VWC%",
        sensor_node_id: "SN-SKM-GAN-01"
      } as any
    ]
  },
  {
    name: "NH-29 (Dimapur - Kohima Corridor)",
    status: "BLOCKED",
    max_risk: 8.5,
    average_risk: 5.65,
    length_km: 74,
    sections: [
      {
        id: 201,
        section: "Dimapur Bypass - Chumoukedima",
        length_km: 30,
        risk_score: 2.8,
        risk_probability: 0.12,
        status: "OPEN",
        coordinates: [
          [25.9064, 93.7270],
          [25.84, 93.81],
          [25.78, 93.92]
        ],
        slope_angle: 18.0,
        elevation: 250,
        distance_to_infrastructure: 0.35,
        primary_shap_trigger: "None",
        sensor_node_id: "SN-NGL-KOH-01"
      } as any,
      {
        id: 202,
        section: "Chumoukedima - Kohima Town Ridges",
        length_km: 44,
        risk_score: 8.5,
        risk_probability: 0.81,
        status: "BLOCKED",
        coordinates: [
          [25.78, 93.92],
          [25.72, 94.02],
          [25.6751, 94.1116]
        ],
        slope_angle: 39.5,
        elevation: 1440,
        distance_to_infrastructure: 0.02,
        primary_shap_trigger: "Pore-Water Pressure (kPa)",
        sensor_node_id: "SN-NGL-KOH-01"
      } as any
    ]
  },
  {
    name: "NH-44 (Guwahati - Shillong - Silchar)",
    status: "BLOCKED",
    max_risk: 9.2,
    average_risk: 4.85,
    length_km: 284,
    sections: [
      {
        id: 401,
        section: "Guwahati - Nongpoh",
        length_km: 50,
        risk_score: 1.5,
        risk_probability: 0.03,
        status: "OPEN",
        coordinates: [
          [26.1445, 91.7362],
          [26.02, 91.80],
          [25.90, 91.85],
          [25.75, 91.88]
        ],
        slope_angle: 12.0,
        elevation: 320,
        distance_to_infrastructure: 0.45,
        primary_shap_trigger: "None",
        sensor_node_id: "SN-MEG-SHI-01"
      } as any,
      {
        id: 402,
        section: "Nongpoh - Shillong Urban Cuts",
        length_km: 50,
        risk_score: 3.2,
        risk_probability: 0.15,
        status: "OPEN",
        coordinates: [
          [25.75, 91.88],
          [25.65, 91.90],
          [25.5788, 91.8831]
        ],
        slope_angle: 24.5,
        elevation: 1520,
        distance_to_infrastructure: 0.12,
        primary_shap_trigger: "Rain Depth (24h)",
        sensor_node_id: "SN-MEG-SHI-01"
      } as any,
      {
        id: 403,
        section: "Shillong - Jowai Ridge",
        length_km: 64,
        risk_score: 5.5,
        risk_probability: 0.45,
        status: "CAUTION",
        coordinates: [
          [25.5788, 91.8831],
          [25.48, 92.05],
          [25.35, 92.20]
        ],
        slope_angle: 31.0,
        elevation: 1380,
        distance_to_infrastructure: 0.08,
        primary_shap_trigger: "7-Day API",
        sensor_node_id: "SN-MEG-EKH-01"
      } as any,
      {
        id: 404,
        section: "Jowai - Silchar / Dima Hasao Link",
        length_km: 120,
        risk_score: 9.2,
        risk_probability: 0.92,
        status: "BLOCKED",
        coordinates: [
          [25.35, 92.20],
          [25.20, 92.30],
          [25.10, 92.55],
          [25.02, 92.65],
          [24.8170, 92.80]
        ],
        slope_angle: 46.5,
        elevation: 1100,
        distance_to_infrastructure: 0.04,
        primary_shap_trigger: "Rain Anomaly (Z-score)",
        sensor_node_id: "SN-ASM-DH-01"
      } as any
    ]
  },
  {
    name: "NH-54 (Aizawl - Lunglei Highway)",
    status: "CAUTION",
    max_risk: 7.5,
    average_risk: 5.65,
    length_km: 200,
    sections: [
      {
        id: 501,
        section: "Aizawl - Serchhip Ridge",
        length_km: 90,
        risk_score: 3.8,
        risk_probability: 0.22,
        status: "OPEN",
        coordinates: [
          [23.7307, 92.7173],
          [23.58, 92.73],
          [23.40, 92.75]
        ],
        slope_angle: 22.0,
        elevation: 1150,
        distance_to_infrastructure: 0.18,
        primary_shap_trigger: "Soil Moisture VWC%",
        sensor_node_id: "SN-MZR-AIZ-01"
      } as any,
      {
        id: 502,
        section: "Serchhip - Lunglei Cut Slope",
        length_km: 110,
        risk_score: 7.5,
        risk_probability: 0.72,
        status: "CAUTION",
        coordinates: [
          [23.40, 92.75],
          [23.20, 92.75],
          [23.00, 92.75],
          [22.8864, 92.7483]
        ],
        slope_angle: 38.0,
        elevation: 1220,
        distance_to_infrastructure: 0.06,
        primary_shap_trigger: "Inclinometer Drift (°/hr)",
        sensor_node_id: "SN-MZR-LUN-01"
      } as any
    ]
  },
  {
    name: "NH-229 (Itanagar - Tawang Bypass)",
    status: "CAUTION",
    max_risk: 7.8,
    average_risk: 4.8,
    length_km: 320,
    sections: [
      {
        id: 601,
        section: "Itanagar - Pasighat Road Section",
        length_km: 180,
        risk_score: 1.8,
        risk_probability: 0.05,
        status: "OPEN",
        coordinates: [
          [27.0844, 93.6053],
          [27.40, 94.20],
          [28.0667, 95.3333]
        ],
        slope_angle: 15.4,
        elevation: 480,
        distance_to_infrastructure: 0.38,
        primary_shap_trigger: "None",
        sensor_node_id: "SN-ARN-PAS-01"
      } as any,
      {
        id: 602,
        section: "Bomdila - Tawang Valley Slopes",
        length_km: 140,
        risk_score: 7.8,
        risk_probability: 0.78,
        status: "CAUTION",
        coordinates: [
          [27.2667, 92.4000],
          [27.42, 92.10],
          [27.5849, 91.8623]
        ],
        slope_angle: 44.5,
        elevation: 2200,
        distance_to_infrastructure: 0.04,
        primary_shap_trigger: "Inclinometer Drift (°/hr)",
        sensor_node_id: "SN-ARN-TAW-01"
      } as any
    ]
  },
  {
    name: "NH-150 (Imphal - Ukhrul Link)",
    status: "BLOCKED",
    max_risk: 9.1,
    average_risk: 5.45,
    length_km: 124,
    sections: [
      {
        id: 701,
        section: "Imphal - Senapati Feeder Connection",
        length_km: 64,
        risk_score: 1.8,
        risk_probability: 0.05,
        status: "OPEN",
        coordinates: [
          [24.8170, 93.9368],
          [25.00, 94.00],
          [25.2667, 94.0667]
        ],
        slope_angle: 14.5,
        elevation: 780,
        distance_to_infrastructure: 0.42,
        primary_shap_trigger: "None",
        sensor_node_id: "SN-MNP-SEN-01"
      } as any,
      {
        id: 702,
        section: "Tamenglong - Ukhrul Slopes",
        length_km: 60,
        risk_score: 9.1,
        risk_probability: 0.91,
        status: "BLOCKED",
        coordinates: [
          [24.9833, 93.5000],
          [25.05, 94.00],
          [25.1167, 94.4333]
        ],
        slope_angle: 42.5,
        elevation: 1680,
        distance_to_infrastructure: 0.05,
        primary_shap_trigger: "Rain Depth (24h)",
        sensor_node_id: "SN-MNP-UKH-01"
      } as any
    ]
  },
  {
    name: "NH-44A (Agartala - Jampui Hills Feeder)",
    status: "CAUTION",
    max_risk: 6.5,
    average_risk: 4.15,
    length_km: 154,
    sections: [
      {
        id: 801,
        section: "Agartala - Dharmanagar Section",
        length_km: 110,
        risk_score: 1.8,
        risk_probability: 0.05,
        status: "OPEN",
        coordinates: [
          [23.8315, 91.2868],
          [24.10, 91.80],
          [24.3667, 92.1667]
        ],
        slope_angle: 10.5,
        elevation: 180,
        distance_to_infrastructure: 0.48,
        primary_shap_trigger: "None",
        sensor_node_id: "SN-TPR-DHA-01"
      } as any,
      {
        id: 802,
        section: "Jampui Hills Tribal Slopes",
        length_km: 44,
        risk_score: 6.5,
        risk_probability: 0.65,
        status: "CAUTION",
        coordinates: [
          [24.3667, 92.1667],
          [24.15, 92.20],
          [23.9500, 92.2667]
        ],
        slope_angle: 35.8,
        elevation: 930,
        distance_to_infrastructure: 0.08,
        primary_shap_trigger: "7-Day API",
        sensor_node_id: "SN-TPR-JAM-01"
      } as any
    ]
  }
];

const INITIAL_REPORTS = [
  {
    id: 1,
    reporter_name: "Tsering Namgyal",
    phone: "9876543210",
    latitude: 27.5849,
    longitude: 91.8623,
    description: "Tension Crack observed along outer bend. Proximity is high, approximately 15 meters above rural feeder road.",
    severity: "HIGH",
    category: "Tension Crack",
    crack_length: 12.5,
    crack_depth: 1.2,
    settlement_proximity: "<50m",
    verified: true,
    created_at: new Date(Date.now() - 3600000 * 2).toISOString()
  },
  {
    id: 2,
    reporter_name: "Lalringliana Ralte",
    phone: "9436123456",
    latitude: 23.7307,
    longitude: 92.7173,
    description: "Moderate slope slump and debris accumulation blocking one lane of the municipal arterial slope road.",
    severity: "MEDIUM",
    category: "Slope Slump",
    crack_length: 5.0,
    crack_depth: 0.4,
    settlement_proximity: "50m-200m",
    verified: false,
    created_at: new Date(Date.now() - 1800000).toISOString()
  }
];

const INITIAL_ALERTS: CAPAlertData[] = [
  {
    identifier: "CAP-NER-2026-08-24-001",
    sender: "SEOC-Nagaland-Disaster-Mgmt",
    sent: new Date().toISOString(),
    status: "Actual",
    msgType: "Alert",
    scope: "Public",
    info: [
      {
        category: "Met",
        event: "Landslide Warning & Transit Suspended",
        urgency: "Immediate",
        severity: "Extreme",
        certainty: "Observed",
        headline: "CRITICAL RED ALERT: Mass slope failure on NH-29 Kohima Highway",
        description: "Severe rainfall triggers landslide displacement near Chumoukedima slope cuts. Section is completely blocked. Heavy earthmovers pre-positioned. Evacuate roadside structures immediately.",
        instruction: "Divert all transit via alternative routes. Avoid NH-29 Kohima hills corridor completely until clearances are broadcast.",
        senderName: "Nagaland State Emergency Operations Center",
        area: [
          {
            areaDesc: "Chumoukedima-Kohima Highway Section"
          }
        ]
      }
    ]
  },
  {
    identifier: "CAP-NER-2026-08-24-002",
    sender: "SEOC-Assam-DimaHasao",
    sent: new Date(Date.now() - 3600000).toISOString(),
    status: "Actual",
    msgType: "Alert",
    scope: "Public",
    info: [
      {
        category: "Met",
        event: "High Landslide Threat",
        urgency: "Expected",
        severity: "Severe",
        certainty: "Likely",
        headline: "ORANGE ALERT: Dima Hasao railway cuts and rural connections",
        description: "Heavy monsoonal rains (195mm in 24h) trigger high antecedent soil moisture. Risk index rises to 9.2. Incidents of rockfalls reported.",
        instruction: "Stage emergency clearance machinery. Citizens in rural valley settlements are advised to remain alert and monitor local hazard grids.",
        senderName: "Assam Disaster Management Cell (Dima Hasao)",
        area: [
          {
            areaDesc: "Dima Hasao District Hills"
          }
        ]
      }
    ]
  }
];

// --- INITIALIZE LOCAL STORAGE ---
export function initializeMockDb() {
  if (!localStorage.getItem("ner_sensor_nodes")) {
    localStorage.setItem("ner_sensor_nodes", JSON.stringify(INITIAL_SENSORS));
  }
  if (!localStorage.getItem("ner_corridors")) {
    localStorage.setItem("ner_corridors", JSON.stringify(INITIAL_CORRIDORS));
  }
  if (!localStorage.getItem("ner_reports")) {
    localStorage.setItem("ner_reports", JSON.stringify(INITIAL_REPORTS));
  }
  if (!localStorage.getItem("ner_alerts")) {
    localStorage.setItem("ner_alerts", JSON.stringify(INITIAL_ALERTS));
  }
}

// --- GETTERS & SETTERS ---
export const mockApi = {
  getSensors(): SensorNodeData[] {
    initializeMockDb();
    const data = localStorage.getItem("ner_sensor_nodes");
    return data ? JSON.parse(data) : INITIAL_SENSORS;
  },

  saveSensors(nodes: SensorNodeData[]) {
    localStorage.setItem("ner_sensor_nodes", JSON.stringify(nodes));
  },

  getCorridors(): CorridorData[] {
    initializeMockDb();
    const data = localStorage.getItem("ner_corridors");
    return data ? JSON.parse(data) : INITIAL_CORRIDORS;
  },

  saveCorridors(corridors: CorridorData[]) {
    localStorage.setItem("ner_corridors", JSON.stringify(corridors));
  },

  getActiveAlerts(): CAPAlertData[] {
    initializeMockDb();
    const data = localStorage.getItem("ner_alerts");
    return data ? JSON.parse(data) : INITIAL_ALERTS;
  },

  saveAlerts(alerts: CAPAlertData[]) {
    localStorage.setItem("ner_alerts", JSON.stringify(alerts));
  },

  getReports(): any[] {
    initializeMockDb();
    const data = localStorage.getItem("ner_reports");
    return data ? JSON.parse(data) : INITIAL_REPORTS;
  },

  saveReports(reports: any[]) {
    localStorage.setItem("ner_reports", JSON.stringify(reports));
  },

  getSegmentForecast(segmentId: number) {
    const corridors = this.getCorridors();
    const sensors = this.getSensors();
    
    let foundSection: any = null;
    let foundCorridor: any = null;
    
    for (const c of corridors) {
      const sec = c.sections.find(s => s.id === segmentId);
      if (sec) {
        foundSection = sec;
        foundCorridor = c;
        break;
      }
    }

    if (!foundSection) return null;

    const sensor = sensors.find(s => s.id === foundSection.sensor_node_id) || sensors[0];
    
    const shap = {
      "Rain_Depth_24h": foundSection.risk_score > 6 ? 0.385 : 0.082,
      "Soil_VWC_Percent": foundSection.risk_score > 7 ? 0.294 : 0.065,
      "Antecedent_Precip_7d": foundSection.risk_score > 5 ? 0.186 : 0.042,
      "Slope_Gradient_Degrees": (foundSection.slope_angle / 50) * 0.15,
      "Pore_Water_Pressure_kPa": foundSection.risk_score > 8 ? 0.485 : 0.052,
    };

    return {
      segment_id: foundSection.id,
      segment_name: foundSection.section,
      section: foundCorridor.name,
      forecast: {
        susceptibility_prob: foundSection.risk_probability * 0.4,
        trigger_prob: foundSection.risk_probability * 0.6,
        fused_prob: foundSection.risk_probability,
        risk_score: foundSection.risk_score,
        alert_level: foundSection.status === "BLOCKED" ? "Critical" : foundSection.status === "CAUTION" ? "Warning" : "Operational",
        alert_color: foundSection.status === "BLOCKED" ? "red" : foundSection.status === "CAUTION" ? "yellow" : "green"
      },
      sensor_node: foundSection.sensor_node_id,
      sensor_name: sensor.name,
      shap_values: shap,
      telemetry: {
        rain_24h_obs: sensor.rain_24h_obs,
        api_7d: sensor.api_7d,
        r24_seasonal_anom: sensor.r24_seasonal_anom,
        soil_moisture: sensor.soil_moisture
      }
    };
  },

  overrideSegmentStatus(segmentId: number, nextStatus: string) {
    const corridors = this.getCorridors();
    let updated = false;

    const updatedCorridors = corridors.map(c => {
      const updatedSections = c.sections.map(sec => {
        if (sec.id === segmentId) {
          updated = true;
          let risk = sec.risk_score;
          if (nextStatus === "BLOCKED") risk = 9.5;
          else if (nextStatus === "CAUTION") risk = 6.2;
          else if (nextStatus === "OPEN") risk = 2.4;
          
          return {
            ...sec,
            status: nextStatus,
            risk_score: risk,
            risk_probability: risk / 10
          };
        }
        return sec;
      });

      const maxRisk = Math.max(...updatedSections.map(s => s.risk_score));
      const avgRisk = updatedSections.reduce((sum, s) => sum + s.risk_score, 0) / updatedSections.length;
      
      let overallStatus = "OPEN";
      if (updatedSections.some(s => s.status === "BLOCKED")) overallStatus = "BLOCKED";
      else if (updatedSections.some(s => s.status === "CAUTION")) overallStatus = "CAUTION";

      return {
        ...c,
        status: overallStatus,
        max_risk: maxRisk,
        average_risk: avgRisk,
        sections: updatedSections
      };
    });

    if (updated) {
      this.saveCorridors(updatedCorridors);
      if (nextStatus === "BLOCKED") {
        const matchingSection = updatedCorridors.flatMap(c => c.sections).find(s => s.id === segmentId);
        if (matchingSection) {
          const newAlert: CAPAlertData = {
            identifier: `CAP-OVERRIDE-${segmentId}-${Date.now()}`,
            sender: "SEOC-Emergency-Override",
            sent: new Date().toISOString(),
            status: "Actual",
            msgType: "Alert",
            scope: "Public",
            info: [
              {
                category: "Safety",
                event: "Slope Blockage Override Enforced",
                urgency: "Immediate",
                severity: "Extreme",
                certainty: "Observed",
                headline: `ADMIN WARNING: Transit suspended on ${matchingSection.section}`,
                description: `Emergency operations center has flagged ${matchingSection.section} as impassable. Landslide threat mitigation in progress.`,
                instruction: "Seek alternative paths. Road clearance machinery deployed.",
                senderName: "NER Resilience Grid Admin",
                area: [{ areaDesc: matchingSection.section }]
              }
            ]
          };
          const activeAlerts = this.getActiveAlerts();
          this.saveAlerts([newAlert, ...activeAlerts]);
        }
      }
    }
  },

  submitReport(formData: any) {
    const reports = this.getReports();
    const newReport = {
      id: reports.length + 1,
      reporter_name: formData.get("reporter_name") || "Citizen Scout",
      phone: formData.get("phone") || "N/A",
      latitude: parseFloat(formData.get("latitude")),
      longitude: parseFloat(formData.get("longitude")),
      description: formData.get("description") || "",
      severity: formData.get("severity") || "LOW",
      category: formData.get("category") || "Slope Slump",
      crack_length: parseFloat(formData.get("crack_length") || "0"),
      crack_depth: parseFloat(formData.get("crack_depth") || "0"),
      settlement_proximity: formData.get("settlement_proximity") || "N/A",
      photo_url: null as any,
      verified: false,
      created_at: new Date().toISOString()
    };
    
    const file = formData.get("file");
    if (file && file instanceof File) {
      newReport.photo_url = URL.createObjectURL(file);
    }
    
    const updated = [newReport, ...reports];
    this.saveReports(updated);
    return newReport;
  },

  verifyReport(reportId: number, status: boolean) {
    const reports = this.getReports();
    const updated = reports.map(r => {
      if (r.id === reportId) {
        if (status) {
          this.blockNearestCorridor(r.latitude, r.longitude);
        }
        return { ...r, verified: status, rejected: false };
      }
      return r;
    });
    this.saveReports(updated);
  },

  rejectReport(reportId: number) {
    const reports = this.getReports();
    const updated = reports.map(r => {
      if (r.id === reportId) {
        return { ...r, verified: false, rejected: true };
      }
      return r;
    });
    this.saveReports(updated);
  },

  deleteReport(reportId: number) {
    const reports = this.getReports();
    const updated = reports.filter(r => r.id !== reportId);
    this.saveReports(updated);
  },

  blockNearestCorridor(lat: number, lon: number) {
    const corridors = this.getCorridors();
    let minDistance = Infinity;
    let nearestSectionId = null;

    for (const c of corridors) {
      for (const s of c.sections) {
        for (const coord of s.coordinates) {
          const dist = haversineDistance(lat, lon, coord[0], coord[1]);
          if (dist < minDistance) {
            minDistance = dist;
            nearestSectionId = s.id;
          }
        }
      }
    }

    if (nearestSectionId !== null && minDistance < 20) {
      this.overrideSegmentStatus(nearestSectionId, "BLOCKED");
    }
  },

  computeDijkstraRoute(origin: string, destination: string, alpha?: number): SafeRouteResponse {
    const corridors = this.getCorridors();
    const segmentsMap = new Map<number, any>();
    corridors.forEach(c => {
      c.sections.forEach(s => {
        segmentsMap.set(s.id, { ...s, corridorName: c.name });
      });
    });
    
    const StandardRoutes: Record<string, Record<string, {
      standardPath: [number, number][];
      altPath: [number, number][];
      standardDistance: number;
      altDistance: number;
      standardTime: number;
      altTime: number;
      interferingSegmentIds: number[];
      standardInstructions: string[];
      altInstructions: string[];
      elevationGradient: number;
      contacts: string;
    }>> = {
      // 1. GUWAHATI (ASSAM)
      "Guwahati": {
        "Kohima": {
          standardPath: [
            [26.1445, 91.7362], // Guwahati
            [26.18, 92.50],
            [25.9064, 93.7270], // Dimapur
            [25.78, 93.92],    // Chumoukedima (NH-29 Sec 2)
            [25.6751, 94.1116]  // Kohima
          ],
          altPath: [
            [26.1445, 91.7362], // Guwahati
            [26.40, 92.80],     // Tezpur Junction
            [26.65, 93.50],     // Jorhat bypass
            [25.9064, 93.7270], // Dimapur
            [25.80, 94.25],     // Wokha / Mokokchung bypass detour (avoids Chumoukedima slide)
            [25.6751, 94.1116]  // Kohima
          ],
          standardDistance: 340,
          altDistance: 415,
          standardTime: 420,
          altTime: 540,
          interferingSegmentIds: [202],
          standardInstructions: [
            "Start from Guwahati ISBT, proceed on NH-37 East.",
            "Cross Nagaon bypass, merge onto NH-29 towards Dimapur.",
            "Pass Dimapur City and head uphill through Chumoukedima cut slopes.",
            "Arrive at Kohima town center."
          ],
          altInstructions: [
            "Start from Guwahati, take NH-37 towards Tezpur bypass.",
            "Proceed via Jorhat route bypassing Dimapur congestion.",
            "Divert left onto Wokha/Mokokchung regional feeder track to avoid Kohima southern ridges (NH-29 slide hazard).",
            "Descend into Kohima capital from North."
          ],
          elevationGradient: 6.8,
          contacts: "Kohima Control Cell: +91-370-2270054 | SEOC Nagaland: +91-370-2291122"
        },
        "Gangtok": {
          standardPath: [
            [26.1445, 91.7362], // Guwahati
            [26.40, 89.90],     // Cooch Behar
            [26.7271, 88.3953], // Siliguri
            [27.06, 88.47],     // Kalimpong Cut (NH-10)
            [27.3314, 88.6138]  // Gangtok
          ],
          altPath: [
            [26.1445, 91.7362], // Guwahati
            [26.40, 89.90],
            [26.7271, 88.3953], // Siliguri
            [26.90, 88.60],     // Damdim junction (via Gorubathan hills)
            [27.10, 88.70],     // Lava village bypass
            [27.3314, 88.6138]  // Gangtok (Gangtok East)
          ],
          standardDistance: 560,
          altDistance: 605,
          standardTime: 660,
          altTime: 780,
          interferingSegmentIds: [102],
          standardInstructions: [
            "Depart Guwahati via NH-27 West through Goalpara.",
            "Drive past Cooch Behar and enter Siliguri plains.",
            "Turn onto NH-10 following Teesta River valley uphill.",
            "Climb steep cut slopes near Kalimpong to reach Gangtok."
          ],
          altInstructions: [
            "Depart Guwahati via standard NH-27 West.",
            "At Siliguri, take the Damdim detour road towards Gorubathan.",
            "Navigate the gentle elevations via Lava and Pedong villages (avoiding Teesta river landslides on NH-10).",
            "Arrive in Gangtok from the eastern ridge road."
          ],
          elevationGradient: 9.1,
          contacts: "East Sikkim Control Room: +91-3592-202411 | GSI Sikkim Desk: +91-3592-201088"
        },
        "Aizawl": {
          standardPath: [
            [26.1445, 91.7362], // Guwahati
            [25.5788, 91.8831], // Shillong
            [25.35, 92.20],     // Jowai
            [24.8170, 92.80],   // Silchar
            [23.7307, 92.7173]  // Aizawl
          ],
          altPath: [
            [26.1445, 91.7362], // Guwahati
            [25.80, 92.40],     // Nagaon South detour
            [25.1833, 93.0167], // Haflong bypass (NH-27)
            [24.8170, 92.80],   // Silchar
            [24.20, 92.65],     // Kolasib bypass track
            [23.7307, 92.7173]  // Aizawl
          ],
          standardDistance: 460,
          altDistance: 535,
          standardTime: 600,
          altTime: 750,
          interferingSegmentIds: [404],
          standardInstructions: [
            "From Guwahati, head south on NH-44 to Shillong.",
            "Cross Shillong Peak bypass and drive to Jowai.",
            "Traverse the steep landslide-vulnerable Jowai-Silchar link down to plains.",
            "Proceed south on NH-54 to Aizawl."
          ],
          altInstructions: [
            "Take NH-37 east towards Nagaon from Guwahati.",
            "Bypass Jaintia Hills mudflows by cutting through Dima Hasao hills (gentler railway bypass road).",
            "Pass through Silchar and execute a detour via Kolasib rural feeder track.",
            "Arrive in Aizawl via northern municipal gate."
          ],
          elevationGradient: 7.9,
          contacts: "Mizoram Disaster Cell: +91-389-2326084 | Aizawl Control Room: +91-389-2334227"
        }
      },
      
      // 2. ITANAGAR (ARUNACHAL)
      "Itanagar": {
        "Tawang": {
          standardPath: [
            [27.0844, 93.6053], // Itanagar
            [27.2667, 92.4000], // Bomdila
            [27.42, 92.10],     // Sela Pass
            [27.5849, 91.8623]  // Tawang
          ],
          altPath: [
            [27.0844, 93.6053], // Itanagar
            [26.80, 92.60],     // Bhalukpong detour
            [27.15, 92.20],     // Dirang valley route
            [27.5849, 91.8623]  // Tawang
          ],
          standardDistance: 310,
          altDistance: 355,
          standardTime: 480,
          altTime: 600,
          interferingSegmentIds: [602],
          standardInstructions: [
            "From Itanagar, drive via NH-229 to Bomdila.",
            "Proceed up Sela pass towards Tawang valley slopes."
          ],
          altInstructions: [
            "From Itanagar, detour south via Bhalukpong borders.",
            "Climb up Dirang valley bypass to avoid Bomdila active cut slope slides.",
            "Rejoin Tawang road near Sela."
          ],
          elevationGradient: 8.5,
          contacts: "Arunachal Disaster Helpline: +91-360-2212268 | Tawang Control: +91-3794-222221"
        }
      },

      // 3. SHILLONG (MEGHALAYA)
      "Shillong": {
        "Tura": {
          standardPath: [
            [25.5788, 91.8831], // Shillong
            [25.60, 91.20],     // Nongstoin
            [25.5140, 90.2200]  // Tura
          ],
          altPath: [
            [25.5788, 91.8831], // Shillong
            [26.1445, 91.7362], // Guwahati
            [25.90, 90.60],     // Goalpara bypass
            [25.5140, 90.2200]  // Tura
          ],
          standardDistance: 310,
          altDistance: 370,
          standardTime: 360,
          altTime: 480,
          interferingSegmentIds: [403],
          standardInstructions: [
            "Drive west from Shillong on State Highway via Nongstoin directly to Tura hills."
          ],
          altInstructions: [
            "Head north to Guwahati plains, take Goalpara bypass highway west, then enter Tura from northern valleys."
          ],
          elevationGradient: 6.2,
          contacts: "Tura Control Room: +91-3651-223835 | Meghalaya Disaster Cell: 1070"
        }
      },

      // 4. IMPHAL (MANIPUR)
      "Imphal": {
        "Ukhrul": {
          standardPath: [
            [24.8170, 93.9368], // Imphal
            [24.9833, 93.5000], // Tamenglong cut
            [25.1167, 94.4333]  // Ukhrul
          ],
          altPath: [
            [24.8170, 93.9368], // Imphal
            [25.00, 94.10],     // Senapati link road
            [25.1167, 94.4333]  // Ukhrul (Eastern approach)
          ],
          standardDistance: 82,
          altDistance: 110,
          standardTime: 150,
          altTime: 220,
          interferingSegmentIds: [702],
          standardInstructions: [
            "Start from Imphal valley, proceed via Tamenglong arterial cut directly to Ukhrul."
          ],
          altInstructions: [
            "Take NH-2 north towards Senapati, divert at Jecob link to enter Ukhrul from the eastern valley route."
          ],
          elevationGradient: 7.5,
          contacts: "Ukhrul Disaster Helpline: +91-3870-222204 | SEOC Manipur: +91-385-2443441"
        }
      },

      // 5. AGARTALA (TRIPURA)
      "Agartala": {
        "Jampui Hills": {
          standardPath: [
            [23.8315, 91.2868], // Agartala
            [24.3667, 92.1667], // Dharmanagar
            [23.9500, 92.2667]  // Jampui Hills
          ],
          altPath: [
            [23.8315, 91.2868], // Agartala
            [23.8500, 91.9000], // Dhalai district track
            [23.9500, 92.2667]  // Jampui Hills (Southern link)
          ],
          standardDistance: 195,
          altDistance: 225,
          standardTime: 300,
          altTime: 380,
          interferingSegmentIds: [802],
          standardInstructions: [
            "From Agartala, proceed north to Dharmanagar, climb up to Jampui Hills tribal slopes."
          ],
          altInstructions: [
            "Head east through Dhalai District feeder roads, climb via Kanchanpur south bypass to reach Jampui Hills."
          ],
          elevationGradient: 5.8,
          contacts: "Jampui Emergency Cell: +91-3824-222354 | Tripura State Disaster Mgmt: 1070"
        }
      }
    };

    // Lookup origin -> destination
    const origKey = Object.keys(StandardRoutes).find(k => k.toLowerCase() === origin.toLowerCase()) || "Guwahati";
    const destMap = StandardRoutes[origKey];
    
    if (destMap) {
      const routeKey = Object.keys(destMap).find(k => k.toLowerCase() === destination.toLowerCase());
      if (routeKey) {
        const selected = destMap[routeKey];
        // Check if any of the interfering segments are blocked or high risk
        const isBlocked = selected.interferingSegmentIds.some(id => {
          const seg = segmentsMap.get(id);
          return seg && (seg.status === "BLOCKED" || seg.risk_score >= 7.0);
        });

        if (isBlocked) {
          // Detour bypass coordinates active
          return {
            origin: origKey,
            destination: routeKey,
            waypoints: selected.altPath,
            detour_steps: selected.altInstructions.map((inst, i) => ({
              instruction: inst,
              segment_name: `Bypass Section ${i + 1}`,
              distance_km: Math.round(selected.altDistance / selected.altInstructions.length),
              estimated_time_mins: Math.round(selected.altTime / selected.altInstructions.length),
              risk_score: 2.0
            })),
            total_distance_km: selected.altDistance,
            average_risk: 3.5,
            alternative_available: true,
            blocked_waypoints: selected.standardPath,
            detour_difference: {
              extra_km: selected.altDistance - selected.standardDistance,
              extra_mins: selected.altTime - selected.standardTime,
              safety_score: selected.elevationGradient,
              helpline: selected.contacts
            }
          };
        } else {
          // Standard path active
          return {
            origin: origKey,
            destination: routeKey,
            waypoints: selected.standardPath,
            detour_steps: selected.standardInstructions.map((inst, i) => ({
              instruction: inst,
              segment_name: `Highway Segment ${i + 1}`,
              distance_km: Math.round(selected.standardDistance / selected.standardInstructions.length),
              estimated_time_mins: Math.round(selected.standardTime / selected.standardInstructions.length),
              risk_score: 1.5
            })),
            total_distance_km: selected.standardDistance,
            average_risk: 2.4,
            alternative_available: false
          };
        }
      }
    }

    // Fallback simple routing if origin/destination is not seeded
    const getFallbackRoute = (orig: string, dest: string): SafeRouteResponse => {
      const sensors = this.getSensors();
      const origNode = sensors.find(s => s.name.toLowerCase().includes(orig.toLowerCase())) || { latitude: 26.2, longitude: 92.9 };
      const destNode = sensors.find(s => s.name.toLowerCase().includes(dest.toLowerCase())) || { latitude: 25.6, longitude: 94.1 };
      
      return {
        origin: orig,
        destination: dest,
        waypoints: [
          [origNode.latitude, origNode.longitude],
          [(origNode.latitude + destNode.latitude) / 2 + 0.1, (origNode.longitude + destNode.longitude) / 2 + 0.1],
          [destNode.latitude, destNode.longitude]
        ],
        detour_steps: [
          {
            instruction: `Proceed from ${orig} Junction on regional link.`,
            segment_name: "Regional Connectivity Segment",
            distance_km: 120,
            estimated_time_mins: 150,
            risk_score: 1.5
          },
          {
            instruction: `Navigate gentle gradient slopes approaching ${dest}.`,
            segment_name: "Mountain Feeder Bypass",
            distance_km: 90,
            estimated_time_mins: 120,
            risk_score: 2.0
          }
        ],
        total_distance_km: 210,
        average_risk: 2.0,
        alternative_available: false
      };
    };

    return getFallbackRoute(origin, destination);
  }
};
