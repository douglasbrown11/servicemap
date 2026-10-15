import { request } from 'node:https';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export function publicIPv4(address) {
  if (isIP(address) !== 4) return false;
  const [a, b, c] = address.split('.').map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113));
}

export function publicURL(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') ||
      !url.hostname.includes('.') || /(?:^|\.)(?:localhost|local|internal|invalid|test)$/.test(url.hostname) ||
      (isIP(url.hostname) && !publicIPv4(url.hostname)) || url.hostname.includes(':')) {
    throw new Error('Logo source must be a public HTTPS URL.');
  }
  return url;
}

// Pin the checked address to the socket; validate every redirect before connecting.
export async function fetchLogoResource(value, { timeout = 3000, maxBytes = 1024 * 1024, redirects = 3 } = {}) {
  const deadline = Date.now() + timeout;
  async function visit(value, remaining) {
    const url = publicURL(value);
    const budget = deadline - Date.now();
    if (budget <= 0) throw new Error('Logo request timed out.');
    let timer;
    const addresses = await Promise.race([
      lookup(url.hostname, { all: true, family: 4 }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Logo DNS timed out.')), budget); }),
    ]).finally(() => clearTimeout(timer));
    if (!addresses.length || addresses.some(({ address }) => !publicIPv4(address))) throw new Error('Private logo address blocked.');
    if (Date.now() >= deadline) throw new Error('Logo request timed out.');
    const response = await new Promise((resolve, reject) => {
      const req = request(url, {
        headers: { 'User-Agent': 'Servicemap logo resolver', Accept: 'image/*,text/html;q=0.8', 'Accept-Encoding': 'identity' },
        lookup: (_host, options, callback) => options.all
          ? callback(null, [addresses[0]]) : callback(null, addresses[0].address, 4),
      }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400) {
          res.destroy();
          resolve({ redirect: res.headers.location });
          return;
        }
        if (res.statusCode !== 200 || Number(res.headers['content-length']) > maxBytes) {
          res.destroy(); reject(new Error('Logo response rejected.')); return;
        }
        let size = 0;
        const chunks = [];
        res.on('data', chunk => {
          size += chunk.length;
          if (size > maxBytes) res.destroy(new Error('Logo response too large.'));
          else chunks.push(chunk);
        });
        res.on('error', reject);
        res.on('end', () => resolve({ body: Buffer.concat(chunks), type: String(res.headers['content-type'] ?? ''), url: url.href }));
      });
      const timer = setTimeout(() => req.destroy(new Error('Logo request timed out.')), Math.max(1, deadline - Date.now()));
      req.on('close', () => clearTimeout(timer));
      req.on('error', reject);
      req.end();
    });
    if ('redirect' in response) {
      if (!response.redirect || remaining <= 0) throw new Error('Too many logo redirects.');
      return visit(new URL(response.redirect, url).href, remaining - 1);
    }
    return response;
  }
  return visit(value, redirects);
}
