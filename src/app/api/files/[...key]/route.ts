import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { getPresignedDownloadUrl, isS3Configured } from '@/lib/storage/s3';

export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  const validation = await validateSessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!validation.valid || !validation.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isS3Configured()) {
    return NextResponse.json({ error: 'File storage is not configured' }, { status: 503 });
  }

  const { key } = await params;
  const objectKey = key.map((part) => decodeURIComponent(part)).join('/');
  if (!objectKey.startsWith('uploads/') || objectKey.includes('..')) {
    return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
  }

  const signedUrl = await getPresignedDownloadUrl(objectKey);
  return NextResponse.redirect(signedUrl, { status: 302 });
}
