import { defineConfig, type Connect, type Plugin } from 'vite';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MAX_BODY = 20 * 1024;
// a 5120x2880 frame (Retina, quality high) is up to ~26 MB as PNG
const MAX_SHOT = 64 * 1024 * 1024;

// Crash reports from playtest devices: POST /__errors appends one JSON line to logs/errors.log (dev and preview only).
function errorLog(): Plugin {
  const handler = (root: string): Connect.NextHandleFunction => (req, res, next) => {
    if (req.method !== 'POST' || !req.url?.split('?')[0].endsWith('/__errors')) return next();
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        res.statusCode = 413;
        res.end();
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (size > MAX_BODY) return;
      try {
        const b = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
        const s = (v: unknown) => (typeof v === 'string' ? v : '');
        const line = {
          time: new Date().toISOString(),
          ua: req.headers['user-agent'] ?? '',
          url: s(b.url),
          message: s(b.message),
          stack: s(b.stack),
          build: s(b.build),
        };
        mkdirSync(join(root, 'logs'), { recursive: true });
        appendFileSync(join(root, 'logs', 'errors.log'), JSON.stringify(line) + '\n');
        res.statusCode = 204;
      } catch {
        res.statusCode = 400;
      }
      res.end();
    });
  };
  return {
    name: 'error-log',
    configureServer: (server) => void server.middlewares.use(handler(server.config.root)),
    configurePreviewServer: (server) => void server.middlewares.use(handler(server.config.root)),
  };
}

// Screenshot key (src/ui/shot.ts): POST /__shots/<id>.png|json writes the file to logs/shots (dev and preview only).
function shotLog(): Plugin {
  const handler = (root: string): Connect.NextHandleFunction => (req, res, next) => {
    const m = req.method === 'POST' ? req.url?.split('?')[0].match(/\/__shots\/([\w-]{1,40}\.(?:png|json))$/) : null;
    if (!m) return next();
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_SHOT) {
        res.statusCode = 413;
        res.end();
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (size > MAX_SHOT) return;
      mkdirSync(join(root, 'logs', 'shots'), { recursive: true });
      writeFileSync(join(root, 'logs', 'shots', m[1]), Buffer.concat(chunks));
      res.statusCode = 204;
      res.end();
    });
  };
  return {
    name: 'shot-log',
    configureServer: (server) => void server.middlewares.use(handler(server.config.root)),
    configurePreviewServer: (server) => void server.middlewares.use(handler(server.config.root)),
  };
}

// Always the same port, reachable from the local network.
export default defineConfig({
  // GitHub Pages serves the site under /<repo>/ (set in .github/workflows/deploy.yml)
  base: process.env.VITE_BASE ?? '/',
  plugins: [errorLog(), shotLog()],
  server: { host: true, port: 5300, strictPort: true },
  preview: { host: true, port: 5300, strictPort: true },
});
