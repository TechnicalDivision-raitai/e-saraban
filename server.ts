import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const GOOGLE_DRIVE_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbz_8BWpjt04SLRb0cBx60vkXp1RGT7QVfo7ZQkfW5YrKccQTiGRtf98BGDNv2NZlvqs/exec';

async function startServer() {
  const app = express();

  app.use(express.text({ type: ['text/plain', 'application/json'], limit: '50mb' }));
  app.use(express.json({ limit: '50mb' }));

  app.get('/api/drive-proxy', async (req: Request, res: Response) => {
    try {
      const target = new URL(GOOGLE_DRIVE_SCRIPT_URL);
      Object.entries(req.query).forEach(([key, val]) => {
        if (typeof val === 'string') {
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
      const bodyStr = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
      const upstream = await fetch(GOOGLE_DRIVE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: bodyStr,
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
