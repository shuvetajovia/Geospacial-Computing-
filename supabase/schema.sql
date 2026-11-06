-- =========================================================================
-- NER Landslide Early Warning System (EWS) - Unified Database Schema
-- Consolidates all tables, functions, RLS policies, realtime, and seed data.
-- =========================================================================

-- =========================================================================
-- 0. CLEAN DROP (Remove all existing objects for clean deployment)
-- =========================================================================
DROP FUNCTION IF EXISTS simulate_sensor_drift() CASCADE;
DROP FUNCTION IF EXISTS get_nearby_users_for_alert(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) CASCADE;
DROP FUNCTION IF EXISTS get_active_alerts() CASCADE;

DROP TABLE IF EXISTS cap_alerts CASCADE;
DROP TABLE IF EXISTS field_crowdsource_reports CASCADE;
DROP TABLE IF EXISTS road_segments CASCADE;
DROP TABLE IF EXISTS sensor_nodes CASCADE;
DROP TABLE IF EXISTS app_users CASCADE;

-- Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================================
-- 1. SENSOR NODES
-- Stores dynamic meteorological readings and IoT station telemetry
-- =========================================================================
CREATE TABLE sensor_nodes (
    id VARCHAR(50) PRIMARY KEY,                         -- e.g., 'SN-MEG-CHE-01'
    name VARCHAR(100) NOT NULL,                        -- e.g., 'Cherrapunji Terraced Valleys'
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    
    -- Dynamic Meteorological & Sensor Metrics
    soil_moisture DOUBLE PRECISION DEFAULT 0.0,         -- Volumetric Water Content % (0-100)
    rain_24h_obs DOUBLE PRECISION DEFAULT 0.0,          -- Observed rainfall in last 24h (mm)
    rain_48h_prior DOUBLE PRECISION DEFAULT 0.0,        -- Prior 48h rainfall (mm)
    rain_72h_prior DOUBLE PRECISION DEFAULT 0.0,        -- Prior 72h rainfall (mm)
    rain_7d_prior DOUBLE PRECISION DEFAULT 0.0,         -- Prior 7d rainfall (mm)
    api_7d DOUBLE PRECISION DEFAULT 0.0,                -- 7-Day Antecedent Precipitation Index
    r24_seasonal_anom DOUBLE PRECISION DEFAULT 0.0,     -- 24h seasonal anomaly (mm)
    api_seasonal_anom DOUBLE PRECISION DEFAULT 0.0,     -- 7d API seasonal anomaly (mm)
    
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sensor_nodes_coords ON sensor_nodes (latitude, longitude);

-- =========================================================================
-- 2. ROAD SEGMENTS (HIGHWAY CORRIDORS)
-- Stores physical slope attributes and computed neural failure hazards
-- =========================================================================
CREATE TABLE road_segments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,                         -- Highway name, e.g., 'NH-44', 'NH-10'
    section VARCHAR(100) NOT NULL,                     -- Section title
    geometry TEXT NOT NULL,                            -- Linestring JSON array / coordinates
    length_km DOUBLE PRECISION NOT NULL,
    
    -- Static Geomorphic Susceptibility Features
    slope DOUBLE PRECISION DEFAULT 0.0,                -- Mean slope angle in degrees
    elevation DOUBLE PRECISION DEFAULT 0.0,            -- Elevation (meters)
    aspect_sin DOUBLE PRECISION DEFAULT 0.0,           -- Sine of slope orientation
    aspect_cos DOUBLE PRECISION DEFAULT 0.0,           -- Cosine of slope orientation
    curvature DOUBLE PRECISION DEFAULT 0.0,            -- Terrain curvature rate
    dist_to_road_km DOUBLE PRECISION DEFAULT 0.0,      -- Distance to cut slope
    
    -- Real-time AI Hazard Metrics
    risk_probability DOUBLE PRECISION DEFAULT 0.0,     -- Failure probability (0.0 to 1.0)
    risk_score DOUBLE PRECISION DEFAULT 1.0,           -- Standardized 1 - 10 risk rating
    status VARCHAR(20) DEFAULT 'OPEN',                 -- 'OPEN', 'CAUTION', 'BLOCKED'
    primary_shap_trigger VARCHAR(100) DEFAULT 'RAIN_DEPTH_24H',
    sensor_node_id VARCHAR(50) REFERENCES sensor_nodes(id) ON DELETE SET NULL,
    
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_road_segments_name ON road_segments (name);

-- =========================================================================
-- 3. CROWDSOURCED FIELD INCIDENTS
-- Citizens and field responders slope observations and ground-truth alerts
-- =========================================================================
CREATE TABLE field_crowdsource_reports (
    id SERIAL PRIMARY KEY,
    reporter_name VARCHAR(100),
    phone VARCHAR(20),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    photo_path VARCHAR(255),
    description TEXT,
    category VARCHAR(50) NOT NULL,                     -- 'Tension Crack', 'Slope Slump', 'Rockfall', 'Road Subsidence', 'Mudflow'
    crack_length DOUBLE PRECISION DEFAULT 0.0,         -- Crack length (meters)
    crack_depth DOUBLE PRECISION DEFAULT 0.0,          -- Crack depth (meters)
    settlement_proximity VARCHAR(50),                 -- '<50m', '50m-200m', '>200m'
    severity VARCHAR(30) DEFAULT 'MODERATE',          -- 'LOW', 'MODERATE', 'HIGH', 'CRITICAL'
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reports_verification ON field_crowdsource_reports (verified, created_at DESC);

-- =========================================================================
-- 4. ACTIVE COMMON ALERTING PROTOCOL (CAP) BROADCASTS
-- Broadcast hazards for emergency operational centers and mobile users
-- =========================================================================
CREATE TABLE cap_alerts (
    id SERIAL PRIMARY KEY,
    identifier VARCHAR(100) UNIQUE NOT NULL,
    sender VARCHAR(100) NOT NULL,
    sent TIMESTAMPTZ DEFAULT NOW(),
    status VARCHAR(30) DEFAULT 'Actual',
    msg_type VARCHAR(30) DEFAULT 'Alert',
    scope VARCHAR(30) DEFAULT 'Public',
    category VARCHAR(50) DEFAULT 'Met',
    event VARCHAR(100) NOT NULL,
    urgency VARCHAR(30) NOT NULL,                      -- 'Immediate', 'Expected', 'Future'
    severity VARCHAR(30) NOT NULL,                     -- 'Minor', 'Moderate', 'Severe', 'Extreme'
    certainty VARCHAR(30) NOT NULL,                    -- 'Observed', 'Likely', 'Possible'
    headline TEXT NOT NULL,
    description TEXT,
    instruction TEXT,
    area_desc TEXT NOT NULL
);

CREATE INDEX idx_alerts_sent ON cap_alerts (sent DESC);

-- =========================================================================
-- 5. APP USERS REGISTRY (Mobile Proximity Alerts)
-- =========================================================================
CREATE TABLE app_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    last_seen TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_app_users_coords ON app_users (latitude, longitude);

-- =========================================================================
-- 6. STORED PROCEDURES & RPC FUNCTIONS
-- =========================================================================

-- Haversine Proximity User Search for Geofenced Alerts
CREATE OR REPLACE FUNCTION get_nearby_users_for_alert(
    station_lat DOUBLE PRECISION,
    station_lon DOUBLE PRECISION,
    threshold_km DOUBLE PRECISION DEFAULT 15.0
)
RETURNS TABLE (
    user_id UUID,
    name VARCHAR,
    phone VARCHAR,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    distance_km DOUBLE PRECISION
) AS $$
DECLARE
    earth_radius DOUBLE PRECISION := 6371.0; -- Earth radius in km
BEGIN
    RETURN QUERY
    SELECT 
        u.id, 
        u.name::VARCHAR, 
        u.phone::VARCHAR, 
        u.latitude, 
        u.longitude,
        (2 * earth_radius * ASIN(SQRT(
            POWER(SIN(radians(u.latitude - station_lat) / 2), 2) +
            COS(radians(station_lat)) * COS(radians(u.latitude)) *
            POWER(SIN(radians(u.longitude - station_lon) / 2), 2)
        ))) AS dist_km
    FROM 
        app_users u
    WHERE 
        (2 * earth_radius * ASIN(SQRT(
            POWER(SIN(radians(u.latitude - station_lat) / 2), 2) +
            COS(radians(station_lat)) * COS(radians(u.latitude)) *
            POWER(SIN(radians(u.longitude - station_lon) / 2), 2)
        ))) <= threshold_km
    ORDER BY
        dist_km ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- IoT Sensor Drift Simulation (Physically bounded telemetry drift)
CREATE OR REPLACE FUNCTION simulate_sensor_drift()
RETURNS json AS $$
DECLARE
  updated_count INTEGER;
  r RECORD;
BEGIN
  FOR r IN SELECT id, soil_moisture, rain_24h_obs, api_7d FROM sensor_nodes LOOP
    DECLARE
      rain_delta DOUBLE PRECISION;
      sm_delta   DOUBLE PRECISION;
      is_extreme_zone BOOLEAN;
    BEGIN
      -- Check if station is in active extreme monsoon belt (Cherrapunji, Chungthang, Mangan)
      is_extreme_zone := r.id IN ('SN-MEG-CHE-01', 'SN-MEG-MAW-01', 'SN-SKM-CHU-01', 'SN-SKM-MAN-01', 'SN-SKM-DZO-01');

      IF is_extreme_zone THEN
        -- High monsoon drift (oscillates around 120-180mm)
        rain_delta := (random() - 0.48) * 1.5;
        sm_delta   := (random() - 0.48) * 0.5;
        
        UPDATE sensor_nodes SET
          rain_24h_obs      = GREATEST(90.0, LEAST(190.0, rain_24h_obs + rain_delta)),
          rain_48h_prior    = GREATEST(120.0, LEAST(240.0, rain_48h_prior + rain_delta * 0.8)),
          rain_72h_prior    = GREATEST(150.0, LEAST(280.0, rain_72h_prior + rain_delta * 0.6)),
          rain_7d_prior     = GREATEST(320.0, LEAST(580.0, rain_7d_prior  + rain_delta * 0.4)),
          api_7d            = GREATEST(220.0, LEAST(420.0, api_7d + rain_delta * 0.5)),
          soil_moisture     = GREATEST(58.0,  LEAST(82.0, soil_moisture + sm_delta)),
          r24_seasonal_anom = GREATEST(30.0, LEAST(85.0, (rain_24h_obs + rain_delta) - 65.0)),
          api_seasonal_anom = GREATEST(60.0, LEAST(175.0, (api_7d + rain_delta * 0.5) - 180.0)),
          last_updated      = NOW()
        WHERE id = r.id;
      ELSE
        -- Nominal safe stations (oscillates gently around realistic calm/safe values: 25-60mm rain, 30-46% SM)
        rain_delta := (random() - 0.50) * 0.6;
        sm_delta   := (random() - 0.50) * 0.3;

        UPDATE sensor_nodes SET
          rain_24h_obs      = GREATEST(15.0, LEAST(65.0, rain_24h_obs + rain_delta)),
          rain_48h_prior    = GREATEST(25.0, LEAST(85.0, rain_48h_prior + rain_delta * 0.8)),
          rain_72h_prior    = GREATEST(35.0, LEAST(115.0, rain_72h_prior + rain_delta * 0.6)),
          rain_7d_prior     = GREATEST(90.0, LEAST(240.0, rain_7d_prior  + rain_delta * 0.4)),
          api_7d            = GREATEST(60.0, LEAST(165.0, api_7d + rain_delta * 0.5)),
          soil_moisture     = GREATEST(25.0, LEAST(46.0, soil_moisture + sm_delta)),
          r24_seasonal_anom = GREATEST(-20.0, LEAST(18.0, (rain_24h_obs + rain_delta) - 45.0)),
          api_seasonal_anom = GREATEST(-40.0, LEAST(35.0, (api_7d + rain_delta * 0.5) - 110.0)),
          last_updated      = NOW()
        WHERE id = r.id;
      END IF;
    END;
  END LOOP;

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  RETURN json_build_object(
    'updated', updated_count,
    'timestamp', NOW(),
    'status', 'bounded_drift_applied'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Retrieve Active CAP Alerts
CREATE OR REPLACE FUNCTION get_active_alerts()
RETURNS SETOF cap_alerts AS $$
  SELECT * FROM cap_alerts
  WHERE status = 'Actual'
  ORDER BY sent DESC;
$$ LANGUAGE sql SECURITY DEFINER;

-- Grant Execute Permissions to Frontend Roles
GRANT EXECUTE ON FUNCTION simulate_sensor_drift() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_nearby_users_for_alert(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_active_alerts() TO anon, authenticated;

-- =========================================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================
ALTER TABLE sensor_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE road_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_crowdsource_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE cap_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

-- Sensor Nodes Policies
CREATE POLICY "Public read sensor_nodes" ON sensor_nodes FOR SELECT USING (true);
CREATE POLICY "Service write sensor_nodes" ON sensor_nodes FOR ALL USING (true);

-- Road Segments Policies
CREATE POLICY "Public read road_segments" ON road_segments FOR SELECT USING (true);
CREATE POLICY "Service write road_segments" ON road_segments FOR ALL USING (true);

-- CAP Alerts Policies
CREATE POLICY "Public read cap_alerts" ON cap_alerts FOR SELECT USING (true);
CREATE POLICY "Service write cap_alerts" ON cap_alerts FOR ALL USING (true);

-- Field Crowdsource Reports Policies
CREATE POLICY "Public read reports" ON field_crowdsource_reports FOR SELECT USING (true);
CREATE POLICY "Public insert reports" ON field_crowdsource_reports FOR INSERT WITH CHECK (true);

-- App Users Policies
CREATE POLICY "Public read users" ON app_users FOR SELECT USING (true);
CREATE POLICY "Public insert users" ON app_users FOR INSERT WITH CHECK (true);

-- =========================================================================
-- 8. REALTIME SUBSCRIPTION REGISTRATION
-- =========================================================================
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE sensor_nodes;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE cap_alerts;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE field_crowdsource_reports;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- =========================================================================
-- 9. SEED DATA (40 IoT Sensor Nodes Across 8 NER States + Initial Alerts)
-- =========================================================================

-- 40 IoT Sensor Nodes
INSERT INTO sensor_nodes (id, name, latitude, longitude, soil_moisture, rain_24h_obs, rain_48h_prior, rain_72h_prior, rain_7d_prior, api_7d, r24_seasonal_anom, api_seasonal_anom)
VALUES
-- ASSAM (6 nodes)
('SN-ASM-GUA-01','Guwahati Urban Hill Slopes (Kamrup Metro)',26.1445,91.7362,38.5,45.2,62.1,88.4,210.5,145.2,12.4,28.6),
('SN-ASM-SIL-01','Silchar Hillocks (Cachar)',24.8333,92.7789,42.1,58.4,71.2,95.8,225.4,162.1,18.2,35.4),
('SN-ASM-DH-01','Dima Hasao Rural Settlements',25.1200,93.0200,55.8,92.5,118.4,145.2,352.8,248.6,42.5,85.2),
('SN-ASM-HAF-01','Haflong Tribal Slopes',25.1667,93.0167,48.2,72.8,98.4,128.5,310.2,218.4,28.6,62.4),
('SN-ASM-KA-01','Karbi Anglong Remote Hamlets',26.0000,93.5000,35.4,38.5,52.4,71.2,185.4,128.6,8.5,22.4),
('SN-ASM-RRL-01','Lumding-Badarpur Hill Railway Cut',25.2000,93.1500,62.4,105.8,135.2,168.4,412.5,295.8,52.4,105.6),

-- MEGHALAYA (5 nodes)
('SN-MEG-SHI-01','Shillong Urban Municipal Cuts (East Khasi)',25.5788,91.8933,35.9,0.4,0.5,1.0,23.6,9.93,-9.6,-12.07),
('SN-MEG-TUR-01','Tura Town Slopes (West Garo Hills)',25.5194,90.2131,34.5,0.0,0.0,0.0,5.7,2.04,-7.0,-12.96),
('SN-MEG-CHE-01','Cherrapunji Terraced Valleys (Sohra)',25.2700,91.7200,37.1,0.0,0.0,0.3,8.7,4.18,-15.0,-30.82),
('SN-MEG-MAW-01','Mawsynram Tribal Hamlets',25.2956,91.5823,37.1,0.0,0.0,0.7,7.4,3.60,-14.0,-28.40),
('SN-MEG-EKH-01','East Khasi Hills Connectors',25.4200,91.9000,34.2,0.0,0.0,0.3,11.4,5.14,-8.5,-12.86),

-- SIKKIM (5 nodes)
('SN-SKM-GAN-01','Gangtok City Slopes (East Sikkim)',27.3389,88.6065,52.4,85.4,112.8,145.2,352.8,248.4,42.5,88.2),
('SN-SKM-NAM-01','Namchi Urban Ridge (South Sikkim)',27.1658,88.3558,45.8,68.4,92.5,118.4,295.2,208.4,28.4,62.5),
('SN-SKM-MAN-01','Mangan Rural Farm Slopes (North Sikkim)',27.5088,88.5338,48.5,72.5,98.4,125.2,308.4,218.5,32.4,68.2),
('SN-SKM-DZO-01','Dzongu Tribal Reserve (North Sikkim)',27.6500,88.5500,55.4,92.5,118.4,148.5,368.4,258.4,45.2,92.5),
('SN-SKM-CHU-01','Chungthang Valley Cuttings (North)',27.6144,88.6403,58.8,98.4,125.2,158.5,392.5,278.4,48.5,98.4),

-- NAGALAND (5 nodes)
('SN-NGL-KOH-01','Kohima Municipal Ridges',25.6751,94.1116,58.2,95.4,122.5,155.2,382.8,268.4,48.5,98.2),
('SN-NGL-MOK-01','Mokokchung Urban Slopes',26.3294,94.5171,42.5,62.4,85.2,112.5,278.4,195.2,22.5,48.4),
('SN-NGL-PHE-01','Phek Farming Villages',25.6728,94.4658,32.4,35.4,48.5,65.2,162.5,114.2,8.2,18.5),
('SN-NGL-WOK-01','Wokha Terraced Hamlets',26.1021,94.2655,44.8,68.5,92.4,118.5,295.4,208.5,28.5,62.4),
('SN-NGL-KIP-01','Kiphire Border Tracks',25.8703,94.7956,48.2,72.5,98.4,125.8,312.5,218.4,32.5,68.5),

-- MIZORAM (5 nodes)
('SN-MZR-AIZ-01','Aizawl Municipal Slopes (Capital Ridge)',23.7271,92.7176,65.4,112.5,142.8,178.4,445.8,315.2,58.4,118.5),
('SN-MZR-LUN-01','Lunglei Town Zone',22.8867,92.7431,48.5,72.5,98.4,125.8,312.5,218.4,32.5,68.5),
('SN-MZR-CHA-01','Champhai Agricultural Slopes',23.4592,93.3282,38.5,48.5,65.2,85.4,215.5,152.4,14.5,32.8),
('SN-MZR-SER-01','Serchhip Rural Clusters',23.2973,92.9546,42.4,62.4,85.2,112.5,278.4,195.2,22.5,48.5),
('SN-MZR-LAW-01','Lawngtlai Hill Settlements',22.5253,92.8954,52.4,85.4,112.8,145.5,362.5,255.2,42.5,88.4),

-- MANIPUR (5 nodes)
('SN-MNP-IMP-01','Imphal Valley Border Cuts',24.8170,93.9368,35.4,42.5,58.4,78.4,198.5,138.4,12.5,28.4),
('SN-MNP-UKH-01','Ukhrul Rural Hamlets',25.1234,94.3612,55.4,92.5,118.4,148.5,368.5,258.5,45.2,92.5),
('SN-MNP-TAM-01','Tamenglong Tribal Slopes',24.9922,93.4925,58.8,98.4,125.8,158.5,392.8,278.5,48.5,98.5),
('SN-MNP-SEN-01','Senapati Feeder Tracks',25.2706,93.9706,44.5,65.2,88.4,115.5,288.4,202.5,24.5,52.4),
('SN-MNP-CHU-01','Churachandpur Hill Clusters',24.3328,93.6756,48.5,72.5,98.4,125.5,312.5,218.5,32.5,68.5),

-- ARUNACHAL PRADESH (6 nodes)
('SN-ARN-ITA-01','Itanagar Capital Slopes (Papum Pare)',27.0844,93.6053,44.5,65.2,88.4,115.2,285.4,200.2,22.5,48.5),
('SN-ARN-PAS-01','Pasighat Slopes (East Siang)',28.0667,95.3333,38.4,48.5,65.2,88.4,218.5,152.5,14.5,32.8),
('SN-ARN-TAW-01','Tawang Valley Settlements',27.5861,91.8594,62.4,108.5,138.4,172.5,428.5,302.5,55.4,112.5),
('SN-ARN-BOM-01','Bomdila Alpine Slopes (West Kameng)',27.2667,92.4000,58.8,98.4,125.8,158.5,392.8,278.5,48.5,98.5),
('SN-ARN-ZIR-01','Ziro Valley (Lower Subansiri)',27.5453,93.8202,42.5,62.4,85.2,112.5,278.5,195.4,22.5,48.5),
('SN-ARN-ANJ-01','Anjaw Border Hamlets',28.0500,97.2000,48.5,72.5,98.4,125.5,312.5,218.5,32.5,68.5),

-- TRIPURA (4 nodes)
('SN-TPR-AGA-01','Agartala Border Ridges (West Tripura)',23.8315,91.2868,28.5,32.4,45.2,62.5,158.4,112.5,8.2,18.4),
('SN-TPR-JAM-01','Jampui Hills Tribal Slopes (North Tripura)',24.2000,92.1000,48.5,72.5,98.4,125.5,312.5,218.5,32.5,68.5),
('SN-TPR-DHA-01','Dharmanagar Rural Slopes (Unakoti)',24.3700,92.0300,38.5,48.5,65.2,88.4,218.5,152.5,14.5,32.8),
('SN-TPR-DHL-01','Dhalai District Clusters',24.0000,91.8500,42.5,62.4,85.2,112.5,278.5,195.4,22.5,48.5)
ON CONFLICT (id) DO UPDATE SET
    soil_moisture     = EXCLUDED.soil_moisture,
    rain_24h_obs      = EXCLUDED.rain_24h_obs,
    rain_48h_prior    = EXCLUDED.rain_48h_prior,
    rain_72h_prior    = EXCLUDED.rain_72h_prior,
    rain_7d_prior     = EXCLUDED.rain_7d_prior,
    api_7d            = EXCLUDED.api_7d,
    r24_seasonal_anom = EXCLUDED.r24_seasonal_anom,
    api_seasonal_anom = EXCLUDED.api_seasonal_anom,
    last_updated      = NOW();

-- CAP Alerts
INSERT INTO cap_alerts (identifier, sender, status, msg_type, scope, category, event, urgency, severity, certainty, headline, description, instruction, area_desc)
VALUES
('CAP-NER-2026-001','NER-LDEWS-AI@mdoner.gov.in','Actual','Alert','Public','Met',
 'Landslide Warning','Immediate','Extreme','Observed',
 'EXTREME RISK: Sikkim Central Zone — Active slope mobilization at Mangan-Dzongu-Chungthang corridors',
 'Inclinometer surface drift exceeding 0.08 deg/hr at North Sikkim. Piezometer 92 kPa. Rainfall 24h: 98mm. AI Risk Index: 9.2/10.',
 'IMMEDIATE: Suspend NH-10 traffic. Mobilize NDRF to Mangan junction. Evacuate settlements within 500m.',
 'North Sikkim — Mangan, Dzongu, Chungthang Sectors'),
('CAP-NER-2026-002','NER-LDEWS-AI@mdoner.gov.in','Actual','Alert','Public','Met',
 'Heavy Rainfall Advisory','Expected','Severe','Likely',
 'HEAVY RAIN ADVISORY: Meghalaya Cherrapunji-Mawsynram Belt — 148mm observed in 24 hours',
 'GSMap confirms extreme precipitation over Meghalaya escarpment. Soil VWC 68.5%. API 7d: 385mm.',
 'Caution on NH-6 and NH-44. Pre-position equipment at Nongstoin and Jowai junctions.',
 'Meghalaya — East Khasi Hills, Cherrapunji (Sohra), Mawsynram')
ON CONFLICT (identifier) DO NOTHING;

-- Sample Crowdsource Reports
INSERT INTO field_crowdsource_reports (reporter_name, phone, latitude, longitude, description, category, crack_length, crack_depth, settlement_proximity, severity, verified)
VALUES
('Ramesh Kumar','9876543210',25.6780,94.1150,
 'Large tension crack on NH-2 cut slope near Kohima bypass. Fresh scarp visible. Crack length approx 12m.',
 'Tension Crack',12.0,0.8,'<50m','HIGH',true),
('Priya Devi','8765432109',27.3400,88.6100,
 'Slope slump on Gangtok-Singtam approach road. Debris covering 30% of carriageway. Fresh seepage.',
 'Slope Slump',8.0,1.2,'50m-200m','CRITICAL',false),
('Field Officer T. Mizo','7654321098',23.7280,92.7190,
 'Small rockfall near Aizawl municipal boundary. Boulders on road verge. No casualties.',
 'Rockfall',0.0,0.0,'<50m','MODERATE',true)
ON CONFLICT DO NOTHING;

-- Verification query
SELECT 'sensor_nodes' AS tbl, COUNT(*) FROM sensor_nodes
UNION ALL
SELECT 'cap_alerts', COUNT(*) FROM cap_alerts
UNION ALL
SELECT 'field_crowdsource_reports', COUNT(*) FROM field_crowdsource_reports;
