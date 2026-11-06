import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, ExternalLink, Loader2, MapPin, Satellite, X } from "lucide-react";

interface SARInspectorProps {
  apiBaseUrl: string;
  initialLocation: { latitude: number; longitude: number; label: string };
  onClose: () => void;
}

interface DetectionJob {
  job_id: string;
  state: "QUEUED" | "SEARCHING" | "READING_RASTERS" | "INFERENCE" | "COMPLETE" | "FAILED";
  progress: string;
  result?: {
    scene_id: string;
    acquired_at: string;
    tile_cloud_pct: number;
    latitude: number;
    longitude: number;
    bounds: [[number, number], [number, number]];
    pixel_size_m: number;
    patch_size_m: number;
    valid_pixels: number;
    candidate_pixels: number;
    candidate_area_m2: number;
    candidate_pct: number;
    mean_slope_deg: number;
    mean_elevation_m: number;
    model: string;
    channels: string[];
    cloud_mask: string;
    limitations: string;
    scene_url: string;
    rgb_url: string;
    mask_url: string;
  };
}

const sleep = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

export const SARInspector: React.FC<SARInspectorProps> = ({ apiBaseUrl, initialLocation, onClose }) => {
  const [latitude] = useState(initialLocation.latitude);
  const [longitude] = useState(initialLocation.longitude);
  const [job, setJob] = useState<DetectionJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const runDetection = async () => {
    const lat = latitude;
    const lon = longitude;
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 21.5 || lat > 29.8 || lon < 88 || lon > 97.5) {
      setError("Enter coordinates inside the Northeast India coverage area (21.5–29.8°N, 88–97.5°E).");
      return;
    }

    controller.current?.abort();
    const activeController = new AbortController();
    controller.current = activeController;
    setBusy(true);
    setError(null);
    setJob(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/sentinel/detect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: lat, longitude: lon }),
        signal: activeController.signal,
      });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.detail || `Sentinel service returned ${response.status}.`);
      let current: DetectionJob = await response.json();
      setJob(current);
      while (!["COMPLETE", "FAILED"].includes(current.state)) {
        await sleep(1800);
        const statusResponse = await fetch(`${apiBaseUrl}/api/v1/sentinel/jobs/${current.job_id}`, { cache: "no-store", signal: activeController.signal });
        if (!statusResponse.ok) throw new Error(`Could not read detection status (${statusResponse.status}).`);
        current = await statusResponse.json();
        setJob(current);
      }
      if (current.state === "FAILED") setError(current.progress || "Detection did not complete.");
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError(cause instanceof Error ? cause.message : "Sentinel detection failed.");
    } finally {
      if (!activeController.signal.aborted) setBusy(false);
    }
  };

  const result = job?.result;
  const imageUrl = (path: string) => path.startsWith('data:image/png;base64,') ? path : `${apiBaseUrl}${path}?v=${job?.job_id}`;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center overflow-y-auto bg-black/75 p-3 backdrop-blur-sm">
      <section className="my-4 flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-borderColor bg-bgCard shadow-2xl">
        <header className="flex items-center justify-between border-b border-borderColor bg-bgPrimary/60 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-blue-600/20 bg-blue-600/10 p-2 text-blue-500"><Satellite className="h-5 w-5" /></div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-tight text-textPrimary">Live Sentinel‑2 Landslide Screening</h2>
              <p className="mt-1 text-[10px] font-semibold text-textMuted">{initialLocation.label} · live Sentinel scene catalog · local 14-channel research model</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg border border-borderColor p-2 text-textSecondary hover:bg-bgPrimary"><X className="h-4 w-4" /></button>
        </header>

        <div className="space-y-4 overflow-y-auto p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-borderColor bg-bgPrimary p-4">
            <div className="text-xs text-textSecondary"><strong className="text-textPrimary">{initialLocation.label}</strong><br />Screening around district center at {latitude.toFixed(4)}°N, {longitude.toFixed(4)}°E</div>
            <button onClick={runDetection} disabled={busy} className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-black uppercase text-white disabled:cursor-wait disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}{busy ? "Processing live scene" : "Find scene & run model"}
            </button>
          </div>

          {busy && <div className="flex items-center gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-xs font-semibold text-textSecondary"><Loader2 className="h-4 w-4 animate-spin text-blue-500" /><div><strong className="block text-textPrimary">{job?.state || "SCREENING"}</strong>{job?.progress || "Searching the catalog, reading satellite bands and running the model. This may take several minutes."}</div></div>}

          {error && <div className="flex gap-2 rounded-xl border border-alertOrange/30 bg-alertOrange/5 p-3 text-xs font-semibold text-textSecondary"><AlertTriangle className="h-4 w-4 shrink-0 text-alertOrange" /><span>{error}</span></div>}

          {result && (
            <>
              <div className="grid gap-3 sm:grid-cols-4">
                {[
                  ["Acquired (UTC)", new Date(result.acquired_at).toLocaleString("en-GB", { timeZone: "UTC", timeZoneName: "short" })],
                  ["Tile cloud cover", `${Number(result.tile_cloud_pct).toFixed(1)}%`],
                  ["Candidate pixels", `${result.candidate_pct}% · ${result.candidate_pixels.toLocaleString()}`],
                  ["Patch area", `${((result.patch_size_m / 1000) ** 2).toFixed(2)} km²`],
                ].map(([label, value]) => <div key={label} className="rounded-xl border border-borderColor bg-bgPrimary p-3"><div className="text-[9px] font-black uppercase text-textMuted">{label}</div><div className="mt-1 text-sm font-bold text-textPrimary">{value}</div></div>)}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <figure className="overflow-hidden rounded-2xl border border-borderColor bg-bgPrimary">
                  <figcaption className="border-b border-borderColor px-3 py-2 text-[10px] font-black uppercase text-textSecondary">Live Sentinel‑2 RGB · 10 m raster</figcaption>
                  <img src={imageUrl(result.rgb_url)} alt="RGB view rendered from the selected live Sentinel-2 scene" className="block aspect-square w-full object-cover" />
                </figure>
                <figure className="overflow-hidden rounded-2xl border border-borderColor bg-bgPrimary">
                  <figcaption className="border-b border-borderColor px-3 py-2 text-[10px] font-black uppercase text-textSecondary">Model candidate mask · red pixels</figcaption>
                  <img src={imageUrl(result.mask_url)} alt="Landslide screening candidate mask from the local model" className="block aspect-square w-full object-cover" />
                </figure>
              </div>

              <div className="grid gap-3 rounded-2xl border border-borderColor bg-bgPrimary p-4 text-[10px] text-textSecondary sm:grid-cols-2">
                <div><strong className="text-textPrimary">Scene:</strong> {result.scene_id}<br /><strong className="text-textPrimary">Model:</strong> {result.model}<br /><strong className="text-textPrimary">Inputs:</strong> {result.channels.join(", ")}</div>
                <div><strong className="text-textPrimary">Cloud mask:</strong> {result.cloud_mask}<br /><strong className="text-textPrimary">Mean terrain:</strong> {result.mean_slope_deg}° slope · {result.mean_elevation_m} m elevation<br /><a className="mt-1 inline-flex items-center gap-1 text-blue-500 underline" href={result.scene_url} target="_blank" rel="noreferrer">Open source scene <ExternalLink className="h-3 w-3" /></a></div>
              </div>
              <p className="rounded-xl border border-alertOrange/25 bg-alertOrange/5 p-3 text-[10px] font-semibold leading-relaxed text-textSecondary"><strong className="text-alertOrange">Research screening only.</strong> {result.limitations} A model mask is not a confirmed landslide, and this Sentinel‑2 revisit is not a 15-minute monitoring feed.</p>
            </>
          )}
        </div>
      </section>
    </div>
  );
};
