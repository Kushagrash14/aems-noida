import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { createAssetQrToken } from '@/lib/qrToken';
import { getPublicBaseUrl } from '@/lib/publicUrl';

/** Returns the public URL encoded in an asset's QR sticker (opens a PDF info sheet). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const validation = await validateSessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!validation.valid || !validation.user) {
    return NextResponse.json({ error: 'Unauthorized: active login session required' }, { status: 401 });
  }

  const { id } = await params;
  const token = createAssetQrToken(id);
  return NextResponse.json({ url: `${getPublicBaseUrl(req)}/api/qr/asset/${token}` });
}
