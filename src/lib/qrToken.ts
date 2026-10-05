import { createHmac, timingSafeEqual } from 'crypto';
import { env } from '@/lib/env';

function sign(assetId: string): string {
  return createHmac('sha256', env.sessionSecret).update(`asset-qr:${assetId}`).digest('base64url').slice(0, 22);
}

/** Opaque, unguessable token that lets a scanned QR open one asset's info sheet. */
export function createAssetQrToken(assetId: string): string {
  return `${Buffer.from(assetId, 'utf8').toString('base64url')}.${sign(assetId)}`;
}

export function verifyAssetQrToken(token: string): string | null {
  const [idPart, sig] = (token || '').split('.');
  if (!idPart || !sig) return null;
  let assetId: string;
  try {
    assetId = Buffer.from(idPart, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  const expected = Buffer.from(sign(assetId));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return assetId;
}
