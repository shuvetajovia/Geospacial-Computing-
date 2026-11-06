const states = new Map(Object.entries({ 'Arunachal Pradesh': 'IN-AR', Assam: 'IN-AS', Manipur: 'IN-MN', Meghalaya: 'IN-ML', Mizoram: 'IN-MZ', Nagaland: 'IN-NL', Sikkim: 'IN-SK', Tripura: 'IN-TR' }));
const providers = ['https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ detail: 'Method not allowed' });
  }
  const state = req.query?.state;
  if (!states.has(state)) return res.status(400).json({ detail: 'Select a supported Northeast state.' });
  const query = `[out:json][timeout:20];area["ISO3166-2"="${states.get(state)}"]->.state;relation(area.state)["boundary"="administrative"]["admin_level"="5"];out center tags;`;
  for (const provider of providers) {
    try {
      const response = await fetch(provider, {
        method: 'POST', body: new URLSearchParams({ data: query }),
        headers: { 'User-Agent': 'MindMeld-DistrictLookup/1.0 (https://geospacial-computing.vercel.app)', 'Accept': 'application/json' },
        signal: AbortSignal.timeout(25000),
      });
      if (!response.ok) continue;
      const payload = await response.json();
      if (payload.remark || !Array.isArray(payload.elements)) continue;
      const districts = payload.elements
        .filter(item => item.tags?.name && Number.isFinite(item.center?.lat) && Number.isFinite(item.center?.lon))
        .map(item => ({ name: String(item.tags['name:en'] || item.tags.name), latitude: item.center.lat, longitude: item.center.lon }))
        .filter(item => item.latitude >= 21.5 && item.latitude <= 29.8 && item.longitude >= 88 && item.longitude <= 97.5)
        .sort((a, b) => a.name.localeCompare(b.name))
        .filter((item, index, all) => all.findIndex(entry => entry.name === item.name) === index);
      if (!districts.length) continue;
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600');
      return res.status(200).json({ districts, source: 'OpenStreetMap', fetched_at: new Date().toISOString() });
    } catch { /* Try the second public provider within the function time budget. */ }
  }
  return res.status(502).json({ detail: 'OpenStreetMap district lookup is temporarily unavailable. Please retry.' });
}
