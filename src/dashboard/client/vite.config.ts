import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Use same port as bridge so Vite proxy works (avoids ECONNREFUSED when DASHBOARD_PORT != 3847)
function dashboardPortFromRootEnv() {
  const envPath = join(__dirname, '../../../.env');
  if (!existsSync(envPath)) {return '3847';}
  const m = readFileSync(envPath, 'utf8').match(/^\s*DASHBOARD_PORT\s*=\s*(\d+)/m);
  return m ? m[1] : '3847';
}
const bridgePort = process.env.DASHBOARD_PORT || dashboardPortFromRootEnv();
const proxyTarget = process.env.VITE_PROXY_TARGET || `http://localhost:${bridgePort}`;

export default defineConfig({
  plugins: [react()],
  root: '.',
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', '@codeium/react-code-editor'],
    exclude: [],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1100, // vendor (Codeium/Monaco/Remotion/React) is expected >500kB
    // No rolldownOptions.codeSplitting — use Rolldown default chunking to avoid
    // ReactCurrentBatchConfig undefined (module order bug within custom chunks).
  },
  server: {
    // Forward browser console/errors to dev server terminal (Vite 8; useful for coding agents)
    forwardConsole: true,
    // Listen on all interfaces so Docker port mapping and cloudflared can reach the dev server
    host: true,
    // Use 5173 so Vite dev doesn't conflict with bridge when DASHBOARD_PORT=3848
    port: parseInt(process.env.VITE_DEV_PORT || '5173', 10) || 5173,
    strictPort: false,
    allowedHosts: [
      'dashboard.example.com',
      'localhost',
      '.trycloudflare.com',
      process.env.VITE_ALLOWED_HOSTS,
    ].filter((host): host is string => typeof host === 'string' && host.length > 0),
    proxy: {
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
      },
      '/n8n': {
        target: proxyTarget,
        changeOrigin: true,
        ws: true,
      },
      // n8n 2.x editor loads /types/*.json from site root (same as /rest); bridge proxies to n8n
      '/types': {
        target: proxyTarget,
        changeOrigin: true,
      },
      '/langfuse': {
        target: proxyTarget,
        changeOrigin: true,
        ws: true,
      },
      '/ws': {
        target: proxyTarget.replace(/^http/, 'ws'),
        ws: true,
        configure: (proxy) => {
          proxy.on('error', (err: NodeJS.ErrnoException, _req, _res) => {
            const code = err.code ?? '';
            if (
              ['ECONNREFUSED', 'ECONNABORTED', 'ECONNRESET'].includes(code)
            ) {
              return; // Silently ignore when Express is down or connection drops
            }
            console.error('[vite] ws proxy error:', err.message || String(err));
          });
          proxy.on('close', () => {});
        },
      },
    },
  },
});
