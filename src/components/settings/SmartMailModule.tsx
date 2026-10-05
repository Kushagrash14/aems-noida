'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bold,
  CalendarClock,
  CheckCircle2,
  Clock,
  Eraser,
  Italic,
  List,
  ListOrdered,
  Loader2,
  Mail,
  PauseCircle,
  Plus,
  Save,
  Send,
  Trash2,
  Underline,
  Users,
  Zap,
} from 'lucide-react';
import type { Location, Plant } from '@/types/database';
import { formatDateTime } from '@/lib/utils';

type Repeat = 'once' | 'daily' | 'weekly' | 'monthly';
type Status = 'draft' | 'scheduled' | 'sent' | 'failed';

interface Campaign {
  id: string;
  title: string;
  subject: string;
  body_html: string;
  recipients: string;
  include_employees: boolean;
  target_location_id: string | null;
  target_plant_id: string | null;
  schedule_at: string | null;
  repeat_mode: Repeat;
  status: Status;
  last_sent_at: string | null;
  last_result: string | null;
  updated_at: string;
}

interface Draft {
  id: string | null;
  title: string;
  subject: string;
  recipients: string;
  include_employees: boolean;
  target_location_id: string;
  target_plant_id: string;
  scheduleLocal: string;
  repeat_mode: Repeat;
  status: Status;
}

const EMPTY_DRAFT: Draft = {
  id: null,
  title: '',
  subject: '',
  recipients: '',
  include_employees: false,
  target_location_id: '',
  target_plant_id: '',
  scheduleLocal: '',
  repeat_mode: 'once',
  status: 'draft',
};

const STATUS_STYLE: Record<Status, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  scheduled: 'bg-blue-50 text-blue-700 border-blue-200',
  sent: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  failed: 'bg-rose-50 text-rose-700 border-rose-200',
};

const STATUS_LABEL: Record<Status, string> = {
  draft: 'Draft',
  scheduled: 'Automail On',
  sent: 'Sent',
  failed: 'Failed',
};

function isoToLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export default function SmartMailModule({ locations, plants }: { locations: Location[]; plants: Plant[] }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [busy, setBusy] = useState<null | 'save' | 'test' | 'schedule' | 'stop' | 'delete' | 'preview'>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [recipientPreview, setRecipientPreview] = useState<string[] | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const plantOptions = useMemo(
    () => (draft.target_location_id ? plants.filter((p) => p.location_id === draft.target_location_id) : plants),
    [plants, draft.target_location_id]
  );

  const flash = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const load = useCallback(
    () =>
      fetch('/api/smart-mail')
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to load mails');
          setCampaigns(data.campaigns || []);
        })
        .catch((err) => flash('error', err instanceof Error ? err.message : 'Failed to load mails'))
        .finally(() => setLoading(false)),
    []
  );

  useEffect(() => {
    void load();
  }, [load]);

  const openCampaign = (c: Campaign | null) => {
    setRecipientPreview(null);
    if (!c) {
      setDraft(EMPTY_DRAFT);
      if (editorRef.current) editorRef.current.innerHTML = '';
      return;
    }
    setDraft({
      id: c.id,
      title: c.title,
      subject: c.subject,
      recipients: c.recipients,
      include_employees: c.include_employees,
      target_location_id: c.target_location_id || '',
      target_plant_id: c.target_plant_id || '',
      scheduleLocal: isoToLocalInput(c.schedule_at),
      repeat_mode: c.repeat_mode,
      status: c.status,
    });
    if (editorRef.current) editorRef.current.innerHTML = c.body_html;
  };

  const exec = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
  };

  const insertPlaceholder = (key: string) => exec('insertText', `{{${key}}}`);

  const buildPayload = () => ({
    title: draft.title,
    subject: draft.subject,
    body_html: editorRef.current?.innerHTML || '',
    recipients: draft.recipients,
    include_employees: draft.include_employees,
    target_location_id: draft.target_location_id || null,
    target_plant_id: draft.target_plant_id || null,
    schedule_at: localInputToIso(draft.scheduleLocal),
    repeat_mode: draft.repeat_mode,
  });

  const save = async (extra?: { status?: Status }): Promise<Campaign | null> => {
    const payload = buildPayload();
    const text = (editorRef.current?.innerText || '').trim();
    if (!payload.subject.trim() || !text) {
      flash('error', 'Subject and mail content are required.');
      return null;
    }
    const res = await fetch('/api/smart-mail', {
      method: draft.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft.id ? { id: draft.id, ...payload, ...extra } : payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Save failed');
    let saved: Campaign = data.campaign;
    if (!draft.id && extra?.status) {
      const res2 = await fetch('/api/smart-mail', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: saved.id, ...payload, ...extra }),
      });
      const data2 = await res2.json();
      if (!res2.ok) throw new Error(data2.error || 'Save failed');
      saved = data2.campaign;
    }
    setDraft((d) => ({ ...d, id: saved.id, status: saved.status, scheduleLocal: isoToLocalInput(saved.schedule_at) }));
    await load();
    return saved;
  };

  const run = async (kind: NonNullable<typeof busy>, fn: () => Promise<void>) => {
    setBusy(kind);
    try {
      await fn();
    } catch (err) {
      flash('error', err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  };

  const handleSave = () =>
    run('save', async () => {
      if (await save()) flash('success', 'Mail draft saved.');
    });

  const handleTest = () =>
    run('test', async () => {
      const saved = await save();
      if (!saved) return;
      const res = await fetch('/api/smart-mail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: saved.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Send failed');
      const r = data.result as { sent: number; total: number; errors: string[] };
      await load();
      if (r.sent === r.total) flash('success', `Mail sent to ${r.sent} recipient(s).`);
      else flash('error', `Sent ${r.sent}/${r.total}. ${r.errors[0] || ''}`);
    });

  const handleSchedule = () =>
    run('schedule', async () => {
      if (!draft.scheduleLocal) {
        flash('error', 'Select a date & time for Automail.');
        return;
      }
      const saved = await save({ status: 'scheduled' });
      if (saved) flash('success', `Automail set for ${formatDateTime(saved.schedule_at)}${saved.repeat_mode !== 'once' ? ` (repeats ${saved.repeat_mode})` : ''}.`);
    });

  const handleStop = () =>
    run('stop', async () => {
      if (await save({ status: 'draft' })) flash('success', 'Automail stopped. Mail kept as draft.');
    });

  const handleDelete = () =>
    run('delete', async () => {
      if (!draft.id || !confirm('Delete this mail?')) return;
      const res = await fetch(`/api/smart-mail?id=${draft.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      openCampaign(null);
      await load();
      flash('success', 'Mail deleted.');
    });

  const handlePreview = () =>
    run('preview', async () => {
      const saved = await save();
      if (!saved) return;
      const res = await fetch('/api/smart-mail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: saved.id, previewOnly: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Preview failed');
      setRecipientPreview(data.recipients || []);
    });

  const isScheduled = draft.status === 'scheduled';
  const inputCls =
    'w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white';
  const labelCls = 'block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-4">
      {/* Mail list */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 space-y-2 h-fit">
        <button
          type="button"
          onClick={() => openCampaign(null)}
          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
        >
          <Plus className="w-4 h-4" /> New Mail
        </button>
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : campaigns.length === 0 ? (
          <p className="text-[11px] text-slate-400 text-center py-6">No mails drafted yet.</p>
        ) : (
          <div className="space-y-1.5 max-h-[560px] overflow-y-auto">
            {campaigns.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => openCampaign(c)}
                className={`w-full text-left p-2.5 rounded-xl border transition-colors cursor-pointer ${
                  draft.id === c.id ? 'border-blue-400 bg-blue-50/60' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-bold text-slate-900 break-words">{c.title}</span>
                  <span className={`shrink-0 px-1.5 py-0.5 rounded border text-[9px] font-black uppercase ${STATUS_STYLE[c.status]}`}>
                    {STATUS_LABEL[c.status]}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 break-words">{c.subject}</div>
                {c.status === 'scheduled' && c.schedule_at && (
                  <div className="text-[10px] text-blue-700 mt-1 flex items-center gap-1">
                    <CalendarClock className="w-3 h-3" /> {formatDateTime(c.schedule_at)}
                    {c.repeat_mode !== 'once' && ` • ${c.repeat_mode}`}
                  </div>
                )}
                {c.last_sent_at && (
                  <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Last sent {formatDateTime(c.last_sent_at)}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Drafter */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-blue-600 text-white flex items-center justify-center">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">{draft.id ? 'Edit Mail' : 'New Mail'}</h3>
              <p className="text-[11px] text-slate-500">Draft or paste your mail, pick a plant / location, then Test or set Automail.</p>
            </div>
          </div>
          {draft.id && (
            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-black uppercase ${STATUS_STYLE[draft.status]}`}>
              {STATUS_LABEL[draft.status]}
            </span>
          )}
        </div>

        {message && (
          <div
            className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
              message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" /> {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Mail Name (internal)</label>
            <input className={inputCls} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Monthly PM reminder – NGM" />
          </div>
          <div>
            <label className={labelCls}>Subject *</label>
            <input className={inputCls} value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} placeholder="e.g. Asset audit on {{date}} – {{plant}}" />
          </div>
          <div>
            <label className={labelCls}>Target Location</label>
            <select
              className={inputCls}
              value={draft.target_location_id}
              onChange={(e) => setDraft({ ...draft, target_location_id: e.target.value, target_plant_id: '' })}
            >
              <option value="">All / Not specific</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Target Plant</label>
            <select className={inputCls} value={draft.target_plant_id} onChange={(e) => setDraft({ ...draft, target_plant_id: e.target.value })}>
              <option value="">All plants in location</option>
              {plantOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelCls}>Recipients (emails, comma separated)</label>
          <textarea
            rows={2}
            className={inputCls}
            value={draft.recipients}
            onChange={(e) => setDraft({ ...draft, recipients: e.target.value })}
            placeholder="it.team@pgel.in, plant.head@pgel.in"
          />
          <div className="flex items-center justify-between gap-2 mt-1.5 flex-wrap">
            <label className="inline-flex items-center gap-2 text-[11px] font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.include_employees}
                onChange={(e) => setDraft({ ...draft, include_employees: e.target.checked })}
                className="accent-blue-600"
              />
              Also send to all active employees of the selected plant / location
            </label>
            <button
              type="button"
              onClick={handlePreview}
              disabled={busy !== null}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline cursor-pointer disabled:opacity-50"
            >
              {busy === 'preview' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Users className="w-3 h-3" />} Check recipients
            </button>
          </div>
          {recipientPreview && (
            <div className="mt-2 p-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 max-h-24 overflow-y-auto">
              <strong>{recipientPreview.length} recipient(s):</strong> {recipientPreview.join(', ') || '—'}
            </div>
          )}
        </div>

        {/* Rich drafter */}
        <div>
          <label className={labelCls}>Mail Content * (type or paste from Outlook / Word)</label>
          <div className="rounded-xl border border-slate-200 overflow-hidden focus-within:border-blue-500">
            <div className="flex items-center gap-0.5 flex-wrap px-2 py-1.5 bg-slate-50 border-b border-slate-200">
              {[
                { icon: Bold, cmd: 'bold', title: 'Bold' },
                { icon: Italic, cmd: 'italic', title: 'Italic' },
                { icon: Underline, cmd: 'underline', title: 'Underline' },
                { icon: List, cmd: 'insertUnorderedList', title: 'Bullets' },
                { icon: ListOrdered, cmd: 'insertOrderedList', title: 'Numbering' },
                { icon: Eraser, cmd: 'removeFormat', title: 'Clear formatting' },
              ].map(({ icon: Icon, cmd, title }) => (
                <button
                  key={cmd}
                  type="button"
                  title={title}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => exec(cmd)}
                  className="p-1.5 rounded-md text-slate-600 hover:bg-white hover:text-slate-900 cursor-pointer"
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              ))}
              <span className="mx-1.5 h-4 w-px bg-slate-300" />
              <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Insert:</span>
              {['plant', 'location', 'date', 'time'].map((k) => (
                <button
                  key={k}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insertPlaceholder(k)}
                  className="px-1.5 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-mono text-blue-700 hover:border-blue-300 cursor-pointer"
                >
                  {`{{${k}}}`}
                </button>
              ))}
            </div>
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              className="min-h-[220px] max-h-[420px] overflow-y-auto p-3 text-sm text-slate-800 focus:outline-none prose-sm [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
            />
          </div>
        </div>

        {/* Automail schedule */}
        <div className="p-3 rounded-xl border border-blue-200 bg-blue-50/50 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Automail Date &amp; Time</label>
            <input
              type="datetime-local"
              className={inputCls}
              value={draft.scheduleLocal}
              onChange={(e) => setDraft({ ...draft, scheduleLocal: e.target.value })}
            />
          </div>
          <div>
            <label className={labelCls}>Repeat</label>
            <select className={inputCls} value={draft.repeat_mode} onChange={(e) => setDraft({ ...draft, repeat_mode: e.target.value as Repeat })}>
              <option value="once">Once</option>
              <option value="daily">Every day</option>
              <option value="weekly">Every week</option>
              <option value="monthly">Every month</option>
            </select>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2">
            {draft.id && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {busy === 'delete' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Delete
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              {busy === 'save' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save Draft
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTest}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              {busy === 'test' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Test (Send Now)
            </button>
            {isScheduled ? (
              <button
                type="button"
                onClick={handleStop}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {busy === 'stop' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PauseCircle className="w-3.5 h-3.5" />} Stop Automail
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSchedule}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {busy === 'schedule' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />} Set to Automail
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
