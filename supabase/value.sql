-- =========================================================================
-- NER Landslide EWS — Live Value Update from Open-Meteo + PERSIANN Fetch
-- File: supabase/value.sql
-- Source: frontend/public/point-snapshot.json (fetched 2026-11-06T01:29:32Z)
--
-- PURPOSE: Push the REAL values fetched from Open-Meteo (weather model) and
-- UCI PERSIANN into Supabase sensor_nodes so the fallback static seed data
-- is replaced with the actual current state.  Run this after every acquire
-- cycle (or trigger from a Supabase Edge Function / cron).
--
-- How to use:
--   1. Open Supabase > SQL Editor in your project dashboard.
--   2. Paste this entire file and click "Run".
--   3. The final SELECT will confirm the updated rows.
-- =========================================================================

-- ── 0. Ensure the EKH-01 (East Khasi Hills Connectors) station row exists ─
--      This station is in stations.json but was missing from the original schema seed.
INSERT INTO sensor_nodes
  (id, name, latitude, longitude,
   soil_moisture, rain_24h_obs, rain_48h_prior, rain_72h_prior,
   rain_7d_prior, api_7d, r24_seasonal_anom, api_seasonal_anom,
   last_updated)
VALUES
  ('SN-MEG-EKH-01', 'East Khasi Hills Connectors', 25.42, 91.9,
   34.2, 0.0, 0.0, 0.3, 11.4, 5.14,
   ROUND((0.0 - 8.5)::numeric, 2),   -- r24 anomaly (obs - climatological mean)
   ROUND((5.14 - 18.0)::numeric, 2),  -- api anomaly
   '2026-11-06T01:00:00+00:00')
ON CONFLICT (id) DO NOTHING;

-- ── 1. UPSERT all 41 sensor nodes with real fetched values ────────────────
--
--  Columns updated:
--    soil_moisture     → Open-Meteo top-1cm volumetric soil moisture (%)
--    rain_24h_obs      → Open-Meteo preceding 24 h accumulated rainfall (mm)
--    rain_48h_prior    → Open-Meteo 48 h window rainfall (mm)
--    rain_72h_prior    → Open-Meteo 72 h window rainfall (mm)
--    rain_7d_prior     → Open-Meteo 7-day accumulated rainfall (mm)
--    api_7d            → Antecedent Precipitation Index computed from 7-day series
--    r24_seasonal_anom → rain_24h_obs minus climatological mean (approximate)
--    api_seasonal_anom → api_7d minus climatological mean (approximate)
--    last_updated      → timestamp of the Open-Meteo data record
--
--  NOTE: r24_seasonal_anom and api_seasonal_anom use approximate post-monsoon
--  climatological baselines for each state (Oct–Nov dry-season normals).
--  Replace with your own station-specific normals once available.
-- ─────────────────────────────────────────────────────────────────────────

UPDATE sensor_nodes SET
  soil_moisture     = 24.9,
  rain_24h_obs      = 0.0,
  rain_48h_prior    = 0.0,
  rain_72h_prior    = 0.1,
  rain_7d_prior     = 10.5,
  api_7d            = 4.59,
  r24_seasonal_anom = ROUND((0.0  - 8.0)::numeric, 2),
  api_seasonal_anom = ROUND((4.59 - 18.0)::numeric, 2),
  last_updated      = '2026-11-06T01:00:00+00:00'
WHERE id = 'SN-ASM-GUA-01';

UPDATE sensor_nodes SET
  soil_moisture     = 39.4,
  rain_24h_obs      = 0.0,
  rain_48h_prior    = 0.0,
  rain_72h_prior    = 0.0,
  rain_7d_prior     = 12.6,
  api_7d            = 5.97,
  r24_seasonal_anom = ROUND((0.0  - 9.0)::numeric, 2),
  api_seasonal_anom = ROUND((5.97 - 20.0)::numeric, 2),
  last_updated      = '2026-11-06T01:00:00+00:00'
WHERE id = 'SN-ASM-SIL-01';

UPDATE sensor_nodes SET
  soil_moisture     = 33.6,
  rain_24h_obs      = 0.0,
  rain_48h_prior    = 0.0,
  rain_72h_prior    = 0.0,
  rain_7d_prior     = 8.6,
  api_7d            = 3.55,
  r24_seasonal_anom = ROUND((0.0  - 7.0)::numeric, 2),
  api_seasonal_anom = ROUND((3.55 - 16.0)::numeric, 2),
  last_updated      = '2026-11-06T01:00:00+00:00'
WHERE id = 'SN-ASM-DH-01';

UPDATE sensor_nodes SET
  soil_moisture     = 33.6,
  rain_24h_obs      = 0.0,
  rain_48h_prior    = 0.0,
  rain_72h_prior    = 0.0,
  rain_7d_prior     = 8.6,
  api_7d            = 3.55,
  r24_seasonal_anom = ROUND((0.0  - 7.0)::numeric, 2),
  api_seasonal_anom = ROUND((3.55 - 16.0)::numeric, 2),
  last_updated      = '2026-11-06T01:00:00+00:00'
WHERE id = 'SN-ASM-HAF-01';

UPDATE sensor_nodes SET
  soil_moisture     = 37.2,
  rain_24h_obs      = 0.0,
  rain_48h_prior    = 0.2,
  rain_72h_prior    = 0.8,
  rain_7d_prior     = 22.5,
  api_7d            = 10.84,
  r24_seasonal_anom = ROUND((0.0  - 7.5)::numeric, 2),
  api_seasonal_anom = ROUND((10.84 - 18.0)::numeric, 2),
  last_updated      = '2026-11-06T01:00:00+00:00'
WHERE id = 'SN-ASM-KA-01';

UPDATE sensor_nodes SET
  soil_moisture     = 25.4,
  rain_24h_obs      = 0.1,
  rain_48h_prior    = 0.4,
  rain_72h_prior    = 0.5,
  rain_7d_prior     = 9.6,
  api_7d            = 4.09,
  r24_seasonal_anom = ROUND((0.1  - 7.0)::numeric, 2),
  api_seasonal_anom = ROUND((4.09 - 16.0)::numeric, 2),
  last_updated      = '2026-11-06T01:00:00+00:00'
WHERE id = 'SN-ASM-RRL-01';

-- MEGHALAYA

UPDATE sensor_nodes SET
  soil_moisture     = 35.9,
  rain_24h_obs      = 0.4,
  rain_48h_prior    = 0.5,
  rain_72h_prior    = 1.0,
  rain_7d_prior     = 23.6,
  api_7d            = 9.93,
  r24_seasonal_anom = ROUND((0.4  - 10.0)::numeric, 2),
  api_seasonal_anom = ROUND((9.93 - 22.0)::numeric, 2),
  last_updated      = '2026-11-06T01:00:00+00:00'
WHERE id = 'SN-MEG-SHI-01';

UPDATE sensor_nodes SET
  soil_moisture     = 34.5,
  rain_24h_obs      = 0.0,
  rain_48h_prior    = 0.0,
  rain_72h_prior    = 0.0,
  rain_7d_prior     = 5.7,
  api_7d            = 2.04,
  r24_seasonal_anom = ROUND((0.0  - 7.0)::numeric, 2),
  api_seasonal_anom = ROUND((2.04 - 15.0)::numeric, 2),
  last_updated      = '2026-11-06T01:00:00+00:00'
WHERE id = 'SN-MEG-TUR-01';

UPDATE sensor_nodes SET
  soil_moisture     = 37.1,
  rain_24h_obs      = 0.0,
  rain_48h_prior    = 0.0,
  rain_72h_prior    = 0.3,
  rain_7d_prior     = 8.7,
  api_7d            = 4.18,
  r24_seasonal_anom = ROUND((0.0  - 15.0)::numeric, 2),
  api_seasonal_anom = ROUND((4.18 - 35.0)::numeric, 2),
  last_updated      = '2026-11-06T01:00:00+00:00'
WHERE id = 'SN-MEG-CHE-01';

UPDATE sensor_nodes SET
  soil_moisture     = 37.1,
  rain_24h_obs      = 0.0,
  rain_48h_prior    = 0.0,
  rain_72h_prior    = 0.7,
  rain_7d_prior     = 7.4,
  api_7d            = 3.60,
  r24_seasonal_anom = ROUND((0.0  - 14.0)::numeric, 2),
  api_seasonal_anom = ROUND((3.60 - 32.0)::numeric, 2),
  last_updated      = '2026-11-06T01:00:00+00:00'
WHERE id = 'SN-MEG-MAW-01';

-- East Khasi Hills Connectors (new station — INSERT covers creation above)
UPDATE sensor_nodes SET
  soil_moisture     = 34.2,
  rain_24h_obs      = 0.0,
  rain_48h_prior    = 0.0,
  rain_72h_prior    = 0.3,
  rain_7d_prior     = 11.4,
  api_7d            = 5.14,
  r24_seasonal_anom = ROUND((0.0  - 8.5)::numeric, 2),
  api_seasonal_anom = ROUND((5.14 - 18.0)::numeric, 2),
  last_updated      = '2026-11-06T01:00:00+00:00'
WHERE id = 'SN-MEG-EKH-01';

-- SIKKIM

UPDATE sensor_nodes SET
  soil_moisture     = 36.6,
  rain_24h_obs      = 0.1,
  rain_48h_prior    = 0.4,
  rain_72h_prior    = 0.5,
  rain_7d_prior     = 15.7,
  api_7d            = 6.75,
  r24_seasonal_anom = ROUND((0.1  - 10.0)::numeric, 2),
  api_seasonal_anom = ROUND((6.75 - 20.0)::numeric, 2),
  last_updated      = '2026-11-06T01:00:00+00:00'
WHERE id = 'SN-SKM-GAN-01';

UPDATE sensor_nodes SET
  soil_moisture     = 31.9,
  rain_24h_obs      = 0.0,
  rain_48h_prior    = 0.0,
  rain_72h_prior    = 0.0,
  rain_7d_prior     = 16.5,
  api_7d            = 6.11,
  r24_seasonal_anom = ROUND((0.0  - 9.0)::numeric, 2),
  api_seasonal_anom = ROUND((6.11 - 18.0)::numeric, 2),
  last_updated      = '2026-11-06T01:00:00+00:00'
WHERE id = 'SN-SKM-NAM-01';

UPDATE sensor_nodes SET
  soil_moisture     = 37.2,
  rain_24h_obs      = 0.0,
  rain_48h_prior    = 0.0,
  rain_72h_prior    = 0.0,
  rain_7d_prior     = 29.5,
  api_7d            = 11.40,
  r24_seasonal_anom = ROUND((0.0  - 11.0)::numeric, 2),
  api_seasonal_anom = ROUND((11.40 - 22.0)::numeric, 2),
  last_updated      = '2026-11-06T01:00:00+00:00'
WHERE id = 'SN-SKM-MAN-01';

UPDATE sensor_nodes SET
  soil_moisture     = 37.5,
  rain_24h_obs      = 0.0,
  rain_48h_prior    = 0.0,
  rain_72h_prior    = 0.0,
  rain_7d_prior     = 39.7,
  api_7d            = 14.71,
  r24_seasonal_anom = ROUND((0.0  - 12.0)::numeric, 2),
  api_seasonal_anom = ROUND((14.71 - 25.0)::numeric, 2),
  last_updated      = '2026-11-06T01:00:00+00:00'
WHERE id = 'SN-SKM-DZO-01';

UPDATE sensor_nodes SET
  soil_moisture     = 36.9,
  rain_24h_obs      = 3.5,
  rain_48h_prior    = 4.2,
  rain_72h_prior    = 4.5,
  rain_7d_prior     = 36.5,
  api_7d            = 16.85,
  r24_seasonal_anom = ROUND((3.5  - 11.0)::numeric, 2),
  api_seasonal_anom = ROUND((16.85 - 24.0)::numeric, 2),
  last_updated      = '2026-11-06T01:00:00+00:00'
WHERE id = 'SN-SKM-CHU-01';

-- NAGALAND

UPDATE sensor_nodes SET
  soil_moisture     = 46.7,
  rain_24h_obs      = 1.5,
  rain_48h_prior    = 1.9,
  rain_72h_prior    = 7.9,
  rain_7d_prior     = 57.1,
  api_7d            = 26.37,
  r24_seasonal_anom = ROUND((1.5  - 12.0)::numeric, 2),
  api_seasonal_anom = ROUND((26.37 - 25.0)::numeric, 2),
  last_updated      = '2026-11-06T01:00:00+00:00'
WHERE id = 'SN-NGL-KOH-01';

UPDATE sensor_nodes SET
  soil_moisture     = 45.5,
  rain_24h_obs      = 0.0,
  rain_48h_prior    = 0.4,
  rain_72h_prior    = 0.7,
  rain_7d_prior     = 41.6,
  api_7d            = 16.79,
  r24_seasonal_anom = ROUND((0.0  - 10.0)::numeric, 2),
  api_seasonal_anom = ROUND((16.79 - 22.0)::numeric, 2),
  last_updated      = '2026-11-06T01:00:00+00:00'
WHERE id = 'SN-NGL-MOK-01';

UPDATE sensor_nodes SET
  soil_moisture     = 38.6,
  rain_24h_obs      = 0.1,
  rain_48h_prior    = 0.1,
  rain_72h_prior    = 0.3,
  rain_7d_prior     = 18.5,
  api_7d            = 7.97,
  r24_seasonal_anom = ROUND((0.1  - 8.0)::numeric, 2),
  api_seasonal_anom = ROUND((7.97 - 18.0)::numeric, 2),
  last_updated      = '2026-11-06T01:00:00+00:00'
WHERE id = 'SN-NGL-PHE-01';

UPDATE sensor_nodes SET
  soil_moisture     = 45.7,
  rain_24h_obs      = 0.3,
  rain_48h_prior    = 1.3,
  rain_72h_prior    = 4.2,
  rain_7d_prior     = 24.0,
  api_7d            = 11.83,
  r24_seasonal_anom = ROUND((0.3  - 9.0)::numeric, 2),
  api_seasonal_anom = ROUND((11.83 - 20.0)::numeric, 2),
  last_updated      = '2026-11-06T01:00:00+00:00'
WHERE id = 'SN-NGL-WOK-01';

UPDATE sensor_nodes SET
  soil_moisture     = 30.8,
  rain_24h_obs      = 0.0,
  rain_48h_prior    = 0.0,
  rain_72h_prior    = 0.4,
  rain_7d_prior     = 19.5,
  api_7d            = 8.81,
  r24_seasonal_anom = ROUND((0.0  - 8.0)::numeric, 2),
  api_seasonal_anom = ROUND((8.81 - 18.0)::numeric, 2),
  last_updated      = '2026-11-06T01:00:00+00:00'
WHERE id = 'SN-NGL-KIP-01';

-- MIZORAM

UPDATE sensor_nodes SET
  soil_moisture     = 12.7,
  rain_24h_obs      = 0.1,
  rain_48h_prior    = 0.8,
  rain_72h_prior    = 1.0,
  rain_7d_prior     = 7.7,
  api_7d            = 3.95,
  r24_seasonal_anom = ROUND((0.1  - 7.0)::numeric, 2),
  api_seasonal_anom = ROUND((3.95 - 15.0)::numeric, 2),
  last_updated      = '2026-11-06T01:00:00+00:00'
WHERE id = 'SN-MZR-AIZ-01';

UPDATE sensor_nodes SET
  soil_moisture     = 32.9,
  rain_24h_obs      = 0.7,
  rain_48h_prior    = 2.3,
  rain_72h_prior    = 2.6,
  rain_7d_prior     = 10.0,
  api_7d            = 5.52,
  r24_seasonal_anom = ROUND((0.7  - 7.0)::numeric, 2),
  api_seasonal_anom = ROUND((5.52 - 15.0)::numeric, 2),
  last_updated      = '2026-11-06T01:00:00+00:00'
WHERE id = 'SN-MZR-LUN-01';

UPDATE sensor_nodes SET
  soil_moisture     = 19.6,
  rain_24h_obs      = 1.4,
  rain_48h_prior    = 1.5,
  rain_72h_prior    = 3.3,
  rain_7d_prior     = 6.6,
  api_7d            = 4.23,
  r24_seasonal_anom = ROUND((1.4  - 7.0)::numeric, 2),
  api_seasonal_anom = ROUND((4.23 - 15.0)::numeric, 2),
  last_updated      = '2026-11-06T01:00:00+00:00'
WHERE id = 'SN-MZR-CHA-01';

UPDATE sensor_nodes SET
  soil_moisture     = 29.2,
  rain_24h_obs      = 0.2,
  rain_48h_prior    = 0.3,
  rain_72h_prior    = 0.8,
  rain_7d_prior     = 5.8,
  api_7d            = 2.70,
  r24_seasonal_anom = ROUND((0.2  - 7.0)::numeric, 2),
  api_seasonal_anom = ROUND((2.70 - 15.0)::numeric, 2),
  last_updated      = '2026-11-06T01:00:00+00:00'
WHERE id = 'SN-MZR-SER-01';

UPDATE sensor_nodes SET
  soil_moisture     = 34.1,
  rain_24h_obs      = 1.0,
  rain_48h_prior    = 1.4,
  rain_72h_prior    = 1.4,
  rain_7d_prior     = 5.3,
  api_7d            = 3.11,
  r24_seasonal_anom = ROUND((1.0  - 7.0)::numeric, 2),
  api_seasonal_anom = ROUND((3.11 - 15.0)::numeric, 2),
  last_updated      = '2026-11-06T01:00:00+00:00'
WHERE id = 'SN-MZR-LAW-01';

-- MANIPUR

UPDATE sensor_nodes SET
  soil_moisture     = 20.9,
  rain_24h_obs      = 0.0,
  rain_48h_prior    = 0.0,
  rain_72h_prior    = 0.0,
  rain_7d_prior     = 4.7,
  api_7d            = 1.90,
  r24_seasonal_anom = ROUND((0.0  - 7.0)::numeric, 2),
  api_seasonal_anom = ROUND((1.90 - 15.0)::numeric, 2),
  last_updated      = '2026-11-06T01:00:00+00:00'
WHERE id = 'SN-MNP-IMP-01';

UPDATE sensor_nodes SET
  soil_moisture     = 26.9,
  rain_24h_obs      = 0.4,
  rain_48h_prior    = 0.4,
  rain_72h_prior    = 0.5,
  rain_7d_prior     = 12.5,
  api_7d            = 5.86,
  r24_seasonal_anom = ROUND((0.4  - 8.0)::numeric, 2),
  api_seasonal_anom = ROUND((5.86 - 18.0)::numeric, 2),
  last_updated      = '2026-11-06T01:00:00+00:00'
WHERE id = 'SN-MNP-UKH-01';

UPDATE sensor_nodes SET
  soil_moisture     = 19.5,
  rain_24h_obs      = 0.0,
  rain_48h_prior    = 0.0,
  rain_72h_prior    = 0.2,
  rain_7d_prior     = 9.7,
  api_7d            = 4.32,
  r24_seasonal_anom = ROUND((0.0  - 8.0)::numeric, 2),
  api_seasonal_anom = ROUND((4.32 - 18.0)::numeric, 2),
  last_updated      = '2026-11-06T01:00:00+00:00'
WHERE id = 'SN-MNP-TAM-01';

UPDATE sensor_nodes SET
  soil_moisture     = 23.3,
  rain_24h_obs      = 0.1,
  rain_48h_prior    = 0.1,
  rain_72h_prior    = 0.1,
  rain_7d_prior     = 8.1,
  api_7d            = 3.62,
  r24_seasonal_anom = ROUND((0.1  - 7.0)::numeric, 2),
  api_seasonal_anom = ROUND((3.62 - 15.0)::numeric, 2),
  last_updated      = '2026-11-06T01:00:00+00:00'
WHERE id = 'SN-MNP-SEN-01';

UPDATE sensor_nodes SET
  soil_moisture     = 29.0,
  rain_24h_obs      = 0.6,
  rain_48h_prior    = 1.0,
  rain_72h_prior    = 1.0,
  rain_7d_prior     = 6.5,
  api_7d            = 3.32,
  r24_seasonal_anom = ROUND((0.6  - 7.0)::numeric, 2),
  api_seasonal_anom = ROUND((3.32 - 15.0)::numeric, 2),
  last_updated      = '2026-11-06T01:00:00+00:00'
WHERE id = 'SN-MNP-CHU-01';

-- ARUNACHAL PRADESH

UPDATE sensor_nodes SET
  soil_moisture     = 25.4,
  rain_24h_obs      = 0.0,
  rain_48h_prior    = 0.0,
  rain_72h_prior    = 1.0,
  rain_7d_prior     = 18.0,
  api_7d            = 10.24,
  r24_seasonal_anom = ROUND((0.0  - 9.0)::numeric, 2),
  api_seasonal_anom = ROUND((10.24 - 20.0)::numeric, 2),
  last_updated      = '2026-11-06T01:00:00+00:00'
WHERE id = 'SN-ARN-ITA-01';

UPDATE sensor_nodes SET
  soil_moisture     = 34.7,
  rain_24h_obs      = 0.0,
  rain_48h_prior    = 0.0,
  rain_72h_prior    = 0.8,
  rain_7d_prior     = 16.4,
  api_7d            = 8.08,
  r24_seasonal_anom = ROUND((0.0  - 9.0)::numeric, 2),
  api_seasonal_anom = ROUND((8.08 - 20.0)::numeric, 2),
  last_updated      = '2026-11-06T01:00:00+00:00'
WHERE id = 'SN-ARN-PAS-01';

UPDATE sensor_nodes SET
  soil_moisture     = 34.4,
  rain_24h_obs      = 0.0,
  rain_48h_prior    = 0.0,
  rain_72h_prior    = 0.1,
  rain_7d_prior     = 9.5,
  api_7d            = 4.39,
  r24_seasonal_anom = ROUND((0.0  - 8.0)::numeric, 2),
  api_seasonal_anom = ROUND((4.39 - 18.0)::numeric, 2),
  last_updated      = '2026-11-06T01:00:00+00:00'
WHERE id = 'SN-ARN-TAW-01';

UPDATE sensor_nodes SET
  soil_moisture     = 32.8,
  rain_24h_obs      = 0.0,
  rain_48h_prior    = 5.3,
  rain_72h_prior    = 12.2,
  rain_7d_prior     = 27.6,
  api_7d            = 17.04,
  r24_seasonal_anom = ROUND((0.0  - 9.0)::numeric, 2),
  api_seasonal_anom = ROUND((17.04 - 20.0)::numeric, 2),
  last_updated      = '2026-11-06T01:00:00+00:00'
WHERE id = 'SN-ARN-BOM-01';

UPDATE sensor_nodes SET
  soil_moisture     = 32.4,
  rain_24h_obs      = 0.0,
  rain_48h_prior    = 0.0,
  rain_72h_prior    = 1.0,
  rain_7d_prior     = 6.1,
  api_7d            = 3.28,
  r24_seasonal_anom = ROUND((0.0  - 7.0)::numeric, 2),
  api_seasonal_anom = ROUND((3.28 - 15.0)::numeric, 2),
  last_updated      = '2026-11-06T01:00:00+00:00'
WHERE id = 'SN-ARN-ZIR-01';

UPDATE sensor_nodes SET
  soil_moisture     = 33.1,
  rain_24h_obs      = 0.0,
  rain_48h_prior    = 0.0,
  rain_72h_prior    = 1.5,
  rain_7d_prior     = 11.1,
  api_7d            = 6.02,
  r24_seasonal_anom = ROUND((0.0  - 8.0)::numeric, 2),
  api_seasonal_anom = ROUND((6.02 - 18.0)::numeric, 2),
  last_updated      = '2026-11-06T01:00:00+00:00'
WHERE id = 'SN-ARN-ANJ-01';

-- TRIPURA

UPDATE sensor_nodes SET
  soil_moisture     = 31.4,
  rain_24h_obs      = 0.0,
  rain_48h_prior    = 0.0,
  rain_72h_prior    = 0.0,
  rain_7d_prior     = 3.4,
  api_7d            = 1.41,
  r24_seasonal_anom = ROUND((0.0  - 6.0)::numeric, 2),
  api_seasonal_anom = ROUND((1.41 - 13.0)::numeric, 2),
  last_updated      = '2026-11-06T01:00:00+00:00'
WHERE id = 'SN-TPR-AGA-01';

UPDATE sensor_nodes SET
  soil_moisture     = 6.5,
  rain_24h_obs      = 0.0,
  rain_48h_prior    = 0.0,
  rain_72h_prior    = 0.3,
  rain_7d_prior     = 10.4,
  api_7d            = 4.46,
  r24_seasonal_anom = ROUND((0.0  - 7.0)::numeric, 2),
  api_seasonal_anom = ROUND((4.46 - 15.0)::numeric, 2),
  last_updated      = '2026-11-06T01:00:00+00:00'
WHERE id = 'SN-TPR-JAM-01';

UPDATE sensor_nodes SET
  soil_moisture     = 23.8,
  rain_24h_obs      = 0.0,
  rain_48h_prior    = 0.0,
  rain_72h_prior    = 0.0,
  rain_7d_prior     = 4.7,
  api_7d            = 2.21,
  r24_seasonal_anom = ROUND((0.0  - 6.0)::numeric, 2),
  api_seasonal_anom = ROUND((2.21 - 13.0)::numeric, 2),
  last_updated      = '2026-11-06T01:00:00+00:00'
WHERE id = 'SN-TPR-DHA-01';

UPDATE sensor_nodes SET
  soil_moisture     = 13.9,
  rain_24h_obs      = 0.0,
  rain_48h_prior    = 0.0,
  rain_72h_prior    = 0.0,
  rain_7d_prior     = 9.0,
  api_7d            = 3.72,
  r24_seasonal_anom = ROUND((0.0  - 6.0)::numeric, 2),
  api_seasonal_anom = ROUND((3.72 - 13.0)::numeric, 2),
  last_updated      = '2026-11-06T01:00:00+00:00'
WHERE id = 'SN-TPR-DHL-01';

-- ── 2. VERIFICATION ───────────────────────────────────────────────────────
-- After running, confirm all 41 rows show realistic post-monsoon values.
-- soil_moisture should be 6–47%, rain_24h_obs should be 0–4 mm for November.
SELECT
  id,
  name,
  ROUND(soil_moisture::numeric, 1)  AS sm_pct,
  ROUND(rain_24h_obs::numeric, 1)   AS r24_mm,
  ROUND(rain_7d_prior::numeric, 1)  AS r7d_mm,
  ROUND(api_7d::numeric, 2)         AS api,
  to_char(last_updated, 'YYYY-MM-DD HH24:MI TZ') AS fetched_at
FROM sensor_nodes
ORDER BY id;

