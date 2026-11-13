import type { IncomingMessage, ServerResponse } from 'http';
import { createApiApp } from '../server/createApiApp.ts';

const app = createApiApp();

export default function handler(req: IncomingMessage, res: ServerResponse) {
  // Normalize rewritten Vercel paths (e.g., /api?__path=tmdb/trending -> /api/tmdb/trending)
  if (req.url) {
    const parsed = new URL(req.url, 'http://localhost');
    const rewrittenPath = parsed.searchParams.get('__path');
    if (rewrittenPath !== null) {
      parsed.searchParams.delete('__path');
      const cleanSubPath = rewrittenPath.replace(/^\/+/, '');
      const qs = parsed.searchParams.toString();
      req.url = `/api/${cleanSubPath}${qs ? `?${qs}` : ''}`;
    } else if (!req.url.startsWith('/api')) {
      req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
    }
  }

  return app(req, res);
}
