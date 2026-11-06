import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

if (process.env.VERCEL && process.platform === 'linux') {
  const output = 'sentinel_runtime/native';
  mkdirSync(output, { recursive: true });
  const name = 'libexpat.so.1';
  const paths = ['/usr/lib64', '/lib64', '/usr/lib/x86_64-linux-gnu'];
  const location = paths.map(dir => join(dir, name)).find(existsSync);
  if (!location) throw new Error('Linux build image is missing ' + name);
  copyFileSync(location, join(output, name));
}
