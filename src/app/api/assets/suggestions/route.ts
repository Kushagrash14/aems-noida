import { NextRequest, NextResponse } from 'next/server';
import { getAssetFormSuggestions } from '@/lib/store';
import { validateSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const validation = await validateSessionToken(token);

  if (!validation.valid || !validation.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const suggestions = await getAssetFormSuggestions();
    return NextResponse.json(suggestions);
  } catch (err: unknown) {
    console.error('API /api/assets/suggestions error:', err);
    return NextResponse.json(
      {
        pos: [],
        serials: [],
        sapCodes: [],
        brands: [],
        models: [],
        vendors: [],
      },
      { status: 200 }
    );
  }
}
