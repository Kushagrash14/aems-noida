import { NextRequest, NextResponse } from 'next/server';
import { getAuditLogs, generateAuditCsv } from '@/lib/audit';
import { buildHistoricalEvents } from '@/lib/auditHistory';
import { validateSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const validation = await validateSessionToken(token);

  if (!validation.valid || !validation.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (validation.user.role !== 'it_admin' && validation.user.role !== 'admin') {
    return NextResponse.json({ error: 'Permission denied: Audit logs are restricted to Admins' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const toIso = (v: string | null, endOfDay = false) => {
    if (!v) return undefined;
    // Date-only values are interpreted in IST (the app's operating timezone).
    const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T${endOfDay ? '23:59:59.999' : '00:00:00'}+05:30`) : new Date(v);
    return isNaN(d.getTime()) ? undefined : d.toISOString();
  };

  const filter = {
    event_category: searchParams.get('category') || undefined,
    risk_level: searchParams.get('risk') || undefined,
    locationId: searchParams.get('locationId') || undefined,
    plantId: searchParams.get('plantId') || undefined,
    departmentId: searchParams.get('departmentId') || undefined,
    userId: searchParams.get('userId') || undefined,
    search: searchParams.get('search') || undefined,
    from: toIso(searchParams.get('from')),
    to: toIso(searchParams.get('to'), true),
  };
  const limit = Math.min(Number(searchParams.get('limit')) || 1000, 5000);
  const includeHistory = searchParams.get('history') !== '0';
  const exportCsv = searchParams.get('export') === 'csv';

  const logs = await getAuditLogs({ ...filter, limit });
  let merged = logs;
  let historicalCount = 0;
  if (includeHistory) {
    const historical = await buildHistoricalEvents(filter);
    historicalCount = historical.length;
    merged = [...logs, ...historical]
      .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0))
      .slice(0, limit);
  }

  if (exportCsv) {
    const csvContent = generateAuditCsv(merged);
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="aems_audit_logs_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  }

  return NextResponse.json({ logs: merged, historicalCount });
}
