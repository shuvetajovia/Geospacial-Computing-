"""Sample UCI PERSIANN daily accumulations using its published readme.daily format."""
import gzip
import re
from datetime import datetime, timedelta, timezone
import numpy as np

ARCHIVE = 'https://persiann.eng.uci.edu/CHRSdata/PERSIANN/daily/'

def sample_daily(rows, sites, checked, keep):
    listing = checked(ARCHIVE).text
    candidates = set(re.findall(r'href=["\'](ms6s4_d\d{5}\.bin\.gz)["\']', listing, re.I))
    now = datetime.now(timezone.utc)
    dated = [(datetime.strptime(name[7:12], '%y%j').replace(tzinfo=timezone.utc), name)
             for name in candidates]
    day, name = max((day,name) for day,name in dated if day + timedelta(days=1) <= now)
    stamp = day.isoformat()
    if all(row.get('persiann',{}).get('period_start','') >= stamp for row in rows.values()):
        return 'Latest published day already stored'
    grid = np.frombuffer(gzip.decompress(checked(ARCHIVE + name).content),dtype='>f4').reshape(480,1440)
    count = 0
    for site in sites:
        i = int((60 - site['latitude']) / 0.25)
        j = int((site['longitude'] % 360) / 0.25)
        value = float(grid[i,j])
        if np.isfinite(value) and value >= 0:
            keep(rows[site['id']], 'persiann', dict(period_start=stamp, value=round(value,3),
                units='mm/24h', file=name, cell_latitude=59.875-i*.25, cell_longitude=.125+j*.25), 'period_start')
            count += 1
    return f'{count} points sampled for {day.date()} UTC'
