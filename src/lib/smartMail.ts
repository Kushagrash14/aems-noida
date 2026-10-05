// =============================================================================
// AEMS v2 — Smart Mail: drafted campaigns targeted at a location / plant,
// sent on demand ("Test") or automatically at a scheduled time ("Automail").
// =============================================================================

import type { RowDataPacket } from 'mysql2/promise';
import { env } from '@/lib/env';
import { getPool } from '@/lib/db/mysql';
import { persistDemoState } from '@/lib/demoPersistence';
import { getEmployees, getLocations, getPlants } from '@/lib/store';
import { sendEmail } from '@/lib/mailer';

export type SmartMailRepeat = 'once' | 'daily' | 'weekly' | 'monthly';
export type SmartMailStatus = 'draft' | 'scheduled' | 'sent' | 'failed';

export interface SmartMailCampaign {
  id: string;
  title: string;
  subject: string;
  body_html: string;
  recipients: string;
  include_employees: boolean;
  target_location_id: string | null;
  target_plant_id: string | null;
  schedule_at: string | null;
  repeat_mode: SmartMailRepeat;
  status: SmartMailStatus;
  last_sent_at: string | null;
  last_result: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type SmartMailInput = Pick<
  SmartMailCampaign,
  | 'title'
  | 'subject'
  | 'body_html'
  | 'recipients'
  | 'include_employees'
  | 'target_location_id'
  | 'target_plant_id'
  | 'schedule_at'
  | 'repeat_mode'
>;

const MAX_RECIPIENTS = 500;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REPEATS: SmartMailRepeat[] = ['once', 'daily', 'weekly', 'monthly'];

const globalRef = globalThis as unknown as {
  __aems_smart_mail_memory?: SmartMailCampaign[];
  __aems_smart_mail_table_ready?: Promise<void>;
  __aems_smart_mail_running?: boolean;
};

function memory(): SmartMailCampaign[] {
  if (!globalRef.__aems_smart_mail_memory) globalRef.__aems_smart_mail_memory = [];
  return globalRef.__aems_smart_mail_memory;
}

if (env.isMockMode) {
  persistDemoState(
    'smartMailCampaigns',
    () => memory(),
    (saved) => {
      if (Array.isArray(saved)) globalRef.__aems_smart_mail_memory = saved as SmartMailCampaign[];
    }
  );
}

function ensureTable(): Promise<void> {
  if (!globalRef.__aems_smart_mail_table_ready) {
    globalRef.__aems_smart_mail_table_ready = getPool()
      .query(
        `CREATE TABLE IF NOT EXISTS smart_mail_campaigns (
          id                  CHAR(36)     NOT NULL,
          title               VARCHAR(255) NOT NULL,
          subject             VARCHAR(500) NOT NULL,
          body_html           MEDIUMTEXT   NOT NULL,
          recipients          TEXT         NULL,
          include_employees   TINYINT(1)   NOT NULL DEFAULT 0,
          target_location_id  CHAR(36)     NULL,
          target_plant_id     CHAR(36)     NULL,
          schedule_at         DATETIME(3)  NULL,
          repeat_mode         VARCHAR(20)  NOT NULL DEFAULT 'once',
          status              VARCHAR(20)  NOT NULL DEFAULT 'draft',
          last_sent_at        DATETIME(3)  NULL,
          last_result         TEXT         NULL,
          created_by          CHAR(36)     NULL,
          created_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          updated_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
          PRIMARY KEY (id),
          KEY idx_smart_mail_due (status, schedule_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
      )
      .then(() => undefined)
      .catch((err) => {
        globalRef.__aems_smart_mail_table_ready = undefined;
        throw err;
      });
  }
  return globalRef.__aems_smart_mail_table_ready;
}

function toSqlDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 23).replace('T', ' ');
}

function rowToCampaign(r: RowDataPacket): SmartMailCampaign {
  return {
    id: r.id,
    title: r.title,
    subject: r.subject,
    body_html: r.body_html,
    recipients: r.recipients || '',
    include_employees: Boolean(r.include_employees),
    target_location_id: r.target_location_id || null,
    target_plant_id: r.target_plant_id || null,
    schedule_at: r.schedule_at || null,
    repeat_mode: (r.repeat_mode as SmartMailRepeat) || 'once',
    status: (r.status as SmartMailStatus) || 'draft',
    last_sent_at: r.last_sent_at || null,
    last_result: r.last_result || null,
    created_by: r.created_by || null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export function sanitizeInput(raw: Record<string, unknown>): SmartMailInput {
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const repeat = str(raw.repeat_mode) as SmartMailRepeat;
  return {
    title: str(raw.title) || 'Untitled mail',
    subject: str(raw.subject),
    body_html: str(raw.body_html).replace(/<script[\s\S]*?<\/script>/gi, ''),
    recipients: str(raw.recipients),
    include_employees: Boolean(raw.include_employees),
    target_location_id: str(raw.target_location_id) || null,
    target_plant_id: str(raw.target_plant_id) || null,
    schedule_at: str(raw.schedule_at) || null,
    repeat_mode: REPEATS.includes(repeat) ? repeat : 'once',
  };
}

export async function listCampaigns(): Promise<SmartMailCampaign[]> {
  if (env.isMockMode) {
    return [...memory()].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }
  await ensureTable();
  const [rows] = await getPool().query<RowDataPacket[]>('SELECT * FROM smart_mail_campaigns ORDER BY updated_at DESC');
  return rows.map(rowToCampaign);
}

export async function getCampaign(id: string): Promise<SmartMailCampaign | null> {
  if (env.isMockMode) return memory().find((c) => c.id === id) || null;
  await ensureTable();
  const [rows] = await getPool().query<RowDataPacket[]>('SELECT * FROM smart_mail_campaigns WHERE id = ?', [id]);
  return rows[0] ? rowToCampaign(rows[0]) : null;
}

export async function createCampaign(input: SmartMailInput, userId: string): Promise<SmartMailCampaign> {
  const now = new Date().toISOString();
  const campaign: SmartMailCampaign = {
    ...input,
    id: crypto.randomUUID(),
    status: 'draft',
    last_sent_at: null,
    last_result: null,
    created_by: userId,
    created_at: now,
    updated_at: now,
  };
  if (env.isMockMode) {
    memory().push(campaign);
    return campaign;
  }
  await ensureTable();
  await getPool().query(
    `INSERT INTO smart_mail_campaigns
      (id, title, subject, body_html, recipients, include_employees, target_location_id, target_plant_id,
       schedule_at, repeat_mode, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
    [
      campaign.id, campaign.title, campaign.subject, campaign.body_html, campaign.recipients,
      campaign.include_employees ? 1 : 0, campaign.target_location_id, campaign.target_plant_id,
      toSqlDate(campaign.schedule_at), campaign.repeat_mode, userId,
    ]
  );
  return (await getCampaign(campaign.id)) || campaign;
}

export async function updateCampaign(
  id: string,
  patch: Partial<SmartMailInput> & Partial<Pick<SmartMailCampaign, 'status' | 'last_sent_at' | 'last_result'>>
): Promise<SmartMailCampaign | null> {
  if (env.isMockMode) {
    const c = memory().find((x) => x.id === id);
    if (!c) return null;
    Object.assign(c, patch, { updated_at: new Date().toISOString() });
    return c;
  }
  await ensureTable();
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return getCampaign(id);
  const sets = entries.map(([k]) => `\`${k}\` = ?`).join(', ');
  const values = entries.map(([k, v]) => {
    if (k === 'schedule_at' || k === 'last_sent_at') return toSqlDate(v as string | null);
    if (k === 'include_employees') return v ? 1 : 0;
    return v;
  });
  await getPool().query(`UPDATE smart_mail_campaigns SET ${sets} WHERE id = ?`, [...values, id]);
  return getCampaign(id);
}

export async function deleteCampaign(id: string): Promise<void> {
  if (env.isMockMode) {
    globalRef.__aems_smart_mail_memory = memory().filter((c) => c.id !== id);
    return;
  }
  await ensureTable();
  await getPool().query('DELETE FROM smart_mail_campaigns WHERE id = ?', [id]);
}

export async function resolveRecipients(c: SmartMailCampaign): Promise<string[]> {
  const set = new Set<string>();
  c.recipients
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => EMAIL_RE.test(e))
    .forEach((e) => set.add(e));

  if (c.include_employees && (c.target_plant_id || c.target_location_id)) {
    const emps = await getEmployees({
      plantId: c.target_plant_id || undefined,
      locationId: c.target_plant_id ? undefined : c.target_location_id || undefined,
    });
    emps
      .filter((e) => e.status === 'active' && e.email && EMAIL_RE.test(e.email))
      .forEach((e) => set.add(e.email!.trim().toLowerCase()));
  }
  return [...set].slice(0, MAX_RECIPIENTS);
}

async function renderBody(c: SmartMailCampaign): Promise<{ subject: string; html: string }> {
  const [locations, plants] = await Promise.all([getLocations(), getPlants()]);
  const now = new Date();
  const vars: Record<string, string> = {
    location: locations.find((l) => l.id === c.target_location_id)?.name || '',
    plant: plants.find((p) => p.id === c.target_plant_id)?.name || '',
    date: now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }),
    time: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }),
  };
  const fill = (s: string) => s.replace(/\{\{\s*(location|plant|date|time)\s*\}\}/gi, (_, k: string) => vars[k.toLowerCase()] ?? '');
  return { subject: fill(c.subject), html: fill(c.body_html) };
}

export async function sendCampaign(c: SmartMailCampaign): Promise<{ sent: number; failed: number; total: number; errors: string[] }> {
  const recipients = await resolveRecipients(c);
  if (recipients.length === 0) {
    return { sent: 0, failed: 0, total: 0, errors: ['No valid recipients found'] };
  }
  const { subject, html } = await renderBody(c);
  let sent = 0;
  const errors: string[] = [];
  for (const to of recipients) {
    const result = await sendEmail({ to, subject, html });
    if (result.success) sent++;
    else errors.push(`${to}: ${result.error}`);
  }
  return { sent, failed: recipients.length - sent, total: recipients.length, errors: errors.slice(0, 10) };
}

function nextRun(from: Date, repeat: SmartMailRepeat): Date | null {
  const d = new Date(from);
  if (repeat === 'daily') d.setDate(d.getDate() + 1);
  else if (repeat === 'weekly') d.setDate(d.getDate() + 7);
  else if (repeat === 'monthly') d.setMonth(d.getMonth() + 1);
  else return null;
  return d;
}

export function summarize(r: { sent: number; failed: number; total: number; errors: string[] }): string {
  const base = `Sent ${r.sent}/${r.total}`;
  return r.errors.length ? `${base} — ${r.errors.join('; ')}` : base;
}

export async function recordSendResult(c: SmartMailCampaign, r: { sent: number; failed: number; total: number; errors: string[] }, scheduled: boolean) {
  const patch: Parameters<typeof updateCampaign>[1] = {
    last_sent_at: new Date().toISOString(),
    last_result: summarize(r),
  };
  if (scheduled) {
    const upcoming = c.schedule_at ? nextRun(new Date(c.schedule_at), c.repeat_mode) : null;
    if (upcoming) {
      while (upcoming.getTime() <= Date.now()) {
        const n = nextRun(upcoming, c.repeat_mode)!;
        upcoming.setTime(n.getTime());
      }
      patch.schedule_at = upcoming.toISOString();
      patch.status = 'scheduled';
    } else {
      patch.status = r.sent > 0 ? 'sent' : 'failed';
    }
  }
  await updateCampaign(c.id, patch);
}

export async function processDueCampaigns(): Promise<void> {
  if (globalRef.__aems_smart_mail_running) return;
  globalRef.__aems_smart_mail_running = true;
  try {
    const now = Date.now();
    const due = (await listCampaigns()).filter(
      (c) => c.status === 'scheduled' && c.schedule_at && new Date(c.schedule_at).getTime() <= now
    );
    for (const c of due) {
      try {
        const result = await sendCampaign(c);
        await recordSendResult(c, result, true);
        console.log(`[AEMS SMART MAIL] "${c.title}" ${summarize(result)}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        await updateCampaign(c.id, { status: 'failed', last_result: msg, last_sent_at: new Date().toISOString() });
        console.error(`[AEMS SMART MAIL] "${c.title}" failed:`, msg);
      }
    }
  } catch (err) {
    console.error('[AEMS SMART MAIL] Scheduler tick failed:', err instanceof Error ? err.message : err);
  } finally {
    globalRef.__aems_smart_mail_running = false;
  }
}
