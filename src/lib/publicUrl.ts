import type { NextRequest } from 'next/server';

/**
 * Base URL for links that leave the app (QR stickers, emails). Prefers the configured
 * public URL, unless it is loopback while the request came from a real host (e.g. LAN IP).
 */
export function getPublicBaseUrl(req: NextRequest): string {
  const isLoopback = (u: string) => /\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(u);
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '') || '';
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || new URL(req.url).protocol.replace(':', '');
  const requestBase = host ? `${proto}://${host}` : new URL(req.url).origin;
  return configured && !(isLoopback(configured) && !isLoopback(requestBase)) ? configured : requestBase;
}
