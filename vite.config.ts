import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import { handleTtsRequest, handleAiAssistantRequest } from './server/apiHandler';

function apiPlugin(): Plugin {
  return {
    name: 'medflow-api-server',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/v1/')) {
          return next();
        }

        // Helper to parse JSON body
        let body: any = {};
        if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
          const buffers: Buffer[] = [];
          for await (const chunk of req) {
            buffers.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
          }
          const raw = Buffer.concat(buffers).toString('utf-8');
          try {
            body = raw ? JSON.parse(raw) : {};
          } catch {
            body = {};
          }
        }

        const expressReq = Object.assign(req, { body }) as any;
        const expressRes = Object.assign(res, {
          status(code: number) {
            res.statusCode = code;
            return expressRes;
          },
          json(data: any) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
            return expressRes;
          },
        }) as any;

        if (req.url === '/api/v1/tts' && req.method === 'POST') {
          return handleTtsRequest(expressReq, expressRes);
        }

        if (req.url === '/api/v1/ai/assistant' && req.method === 'POST') {
          return handleAiAssistantRequest(expressReq, expressRes);
        }

        if (req.url === '/api/v1/health') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ status: 'ok', time: new Date().toISOString(), platform: 'MEDFLOW AI' }));
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), apiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

