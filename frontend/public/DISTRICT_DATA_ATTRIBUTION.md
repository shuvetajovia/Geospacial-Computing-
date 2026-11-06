Reference district coordinates derived from Vardhan Maps revision 2c829a3543171810a4b28162ea736fb76dfdef40. Retrieved 2026-11-06. ODbL 1.0. Derived data: /districts-reference.json. Coordinates are approximate boundary bounding-box midpoints, not verified administrative headquarters. Reference data may lag administrative changes.

# Attribution & data licensing

## Code

The source code of `vardhan-maps` is licensed under the **MIT License** (see `LICENSE`).

## Map data — OpenStreetMap, ODbL 1.0

The boundary geometry (state and district polygons) is **derived from
OpenStreetMap** and is therefore licensed under the
**[Open Database License (ODbL) v1.0](https://opendatacommons.org/licenses/odbl/1-0/)**.

If you use this data you must:

1. **Attribute** OpenStreetMap. Any map or product using this data must carry the
   credit: **“© OpenStreetMap contributors”**, linking to
   <https://www.openstreetmap.org/copyright>.
2. **Share-alike** — if you publicly use an *adapted* version of the underlying
   database, you must release the adapted database under ODbL as well. (Producing
   and sharing a *rendered image* — a “Produced Work” — does not by itself trigger
   share-alike, but the attribution requirement still applies.)

## Depiction of India's external boundaries — read this

This package aims to present India's boundaries in line with the **official
Government of India depiction** (e.g. Jammu & Kashmir and Ladakh, and Arunachal
Pradesh, shown as part of India).

**How that is produced, and its limits:**

- The base geometry comes from OpenStreetMap, whose default data follows OSM's own
  “on the ground / disputed” mapping conventions, which do **not** match the
  official Government of India depiction for the disputed regions.
- This package applies **editorial corrections** (see `data/overrides/` and
  `scripts/patch-borders.mjs`) to the disputed segments so the result aligns with
  the GoI depiction as closely as our sourcing allows.
- These corrections are a **best-effort approximation**, not a survey-grade or
  government-certified boundary. **This is not an official map of India** and must
  not be represented as one. For any legal, official, or survey purpose, use the
  Survey of India's authoritative maps.

By using this package you accept that the boundary depiction is provided “as is”,
for general-purpose visualisation only, with no warranty as to accuracy or
official status.


MIT License

Copyright (c) 2026 Vardhan Systems

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

--------------------------------------------------------------------------------

NOTE ON THE MAP DATA (not the code):

The boundary data shipped with this package is derived from OpenStreetMap and is
licensed under the Open Database License (ODbL) 1.0, NOT the MIT license above.
See ATTRIBUTION.md for the required attribution and the ODbL terms, and for the
disclaimer about the depiction of India's external boundaries.
