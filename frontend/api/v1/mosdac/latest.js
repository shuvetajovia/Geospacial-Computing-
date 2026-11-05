// Small same-origin Vercel function; does not load the Python/ML backend.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ detail: 'Method not allowed' });
  }
  const now = new Date();
  const url = new URL('https://mosdac.gov.in/apios/datasets.json');
  url.search = new URLSearchParams({
    datasetId: '3RIMG_L2B_HEM',
    startTime: new Date(now.getTime() - 86400000).toISOString().slice(0, 10),
    endTime: now.toISOString().slice(0, 10),
    count: '10', boundingBox: '88,21.5,97.5,29.8',
  }).toString();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`upstream HTTP ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload?.entries)) throw new Error('invalid catalog response');
    const entries = payload.entries
      .map(entry => ({ entry, time: Date.parse(entry?.updated) }))
      .filter(row => Number.isFinite(row.time))
      .sort((a, b) => b.time - a.time);
    const latest = entries[0];
    const age = latest ? Math.max(0, (now.getTime() - latest.time) / 60000) : null;
    return res.status(200).json({
      source: 'MOSDAC / INSAT-3DR', dataset_id: '3RIMG_L2B_HEM',
      product: 'Hydro-Estimator rainfall (HEM)', cadence_minutes: 30,
      coverage: 'Northeast India search area',
      state: age === null ? 'NO_CURRENT_GRANULE' : age <= 60 ? 'CURRENT' : 'STALE',
      updated_at: latest ? new Date(latest.time).toISOString() : null,
      age_minutes: age === null ? null : Math.round(age * 10) / 10,
      filename: latest?.entry.identifier ?? null,
      record_id: latest?.entry.id ?? null,
      download_requires_registered_login: true,
      catalog_is_read_through: true,
    });
  } catch {
    return res.status(502).json({ detail: 'MOSDAC catalog unavailable. Please retry shortly.' });
  }
}
