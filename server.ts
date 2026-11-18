import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const DEFAULT_GOOGLE_DRIVE_SCRIPT_URL =
  process.env.APPS_SCRIPT_URL ||
  'https://script.google.com/macros/s/AKfycbz_8BWpjt04SLRb0cBx60vkXp1RGT7QVfo7ZQkfW5YrKccQTiGRtf98BGDNv2NZlvqs/exec';

function resolveSafeScriptUrl(candidate: unknown): string {
  if (typeof candidate === 'string' && candidate.trim()) {
    const trimmed = candidate.trim();
    if (
      trimmed.startsWith('https://script.google.com/macros/s/') &&
      trimmed.endsWith('/exec')
    ) {
      return trimmed;
    }
    throw new Error('URL ของ Google Apps Script ต้องขึ้นต้นด้วย https://script.google.com/macros/s/ และลงท้ายด้วย /exec');
  }
  return DEFAULT_GOOGLE_DRIVE_SCRIPT_URL;
}

async function startServer() {
  const app = express();

  app.use(express.text({ type: ['text/plain', 'application/json'], limit: '50mb' }));
  app.use(express.json({ limit: '50mb' }));

  app.get('/api/drive-proxy', async (req: Request, res: Response) => {
    try {
      const baseScriptUrl = resolveSafeScriptUrl(req.header('x-apps-script-url') || req.query._scriptUrl);
      const target = new URL(baseScriptUrl);
      Object.entries(req.query).forEach(([key, val]) => {
        if (key !== '_scriptUrl' && typeof val === 'string') {
          target.searchParams.set(key, val);
        }
      });

      const upstream = await fetch(target.toString(), {
        method: 'GET',
        redirect: 'follow',
      });
      const text = await upstream.text();
      res.setHeader('Cache-Control', 'no-store');
      res.status(upstream.status).type('application/json').send(text);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Proxy request failed';
      res.status(502).json({ status: 'error', message });
    }
  });

  app.post('/api/drive-proxy', async (req: Request, res: Response) => {
    try {
      let parsedBody: Record<string, unknown> = {};
      if (typeof req.body === 'string') {
        parsedBody = JSON.parse(req.body || '{}') as Record<string, unknown>;
      } else if (req.body && typeof req.body === 'object') {
        parsedBody = { ...(req.body as Record<string, unknown>) };
      }

      const baseScriptUrl = resolveSafeScriptUrl(
        req.header('x-apps-script-url') || req.query._scriptUrl || parsedBody._scriptUrl
      );
      if ('_scriptUrl' in parsedBody) {
        delete parsedBody._scriptUrl;
      }

      const upstream = await fetch(baseScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(parsedBody),
        redirect: 'follow',
      });
      const text = await upstream.text();
      res.setHeader('Cache-Control', 'no-store');
      res.status(upstream.status).type('application/json').send(text);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Proxy request failed';
      res.status(502).json({ status: 'error', message });
    }
  });

  app.use('/assets/aistudio', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    next();
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
