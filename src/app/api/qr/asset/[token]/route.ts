import { readFileSync } from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAssetQrToken } from '@/lib/qrToken';
import { getAssetById } from '@/lib/store';
import { SimplePdf, wrapText } from '@/lib/simplePdf';
import { displayAssetType } from '@/lib/assetType';
import type { Asset, AssetCustomValue } from '@/types/database';

const STATUS_LABELS: Record<string, string> = {
  in_service: 'In Service (Assigned)',
  in_storage: 'In Stock / Available',
  maintenance: 'Under Maintenance',
  damaged: 'Damaged',
  missing: 'Missing',
  scrapped: 'Scrapped',
};

function formatDate(value?: string | null, withTime = false): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: true } : {}),
  });
}

function customFieldRows(asset: Asset): [string, string][] {
  const cv = asset.custom_values;
  if (!cv) return [];
  const humanize = (k: string) => k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  if (Array.isArray(cv)) {
    return (cv as (AssetCustomValue & { field?: { field_label?: string; field_name?: string } })[])
      .filter((v) => v.field_value)
      .map((v) => [v.field?.field_label || humanize(v.field?.field_name || 'Field'), String(v.field_value)]);
  }
  return Object.entries(cv)
    .filter(([k, v]) => v && !k.startsWith('_') && typeof v !== 'object')
    .map(([k, v]) => [humanize(k), String(v)]);
}

const LOGO_PX_W = 790;
const LOGO_PX_H = 388;
let cachedLogo: Buffer | null | undefined;

function loadLogo(): Buffer | null {
  if (cachedLogo === undefined) {
    try {
      cachedLogo = readFileSync(path.join(process.cwd(), 'public', 'pg-logo.jpg'));
    } catch {
      cachedLogo = null;
    }
  }
  return cachedLogo;
}

function buildPdf(asset: Asset): Buffer {
  const pdf = new SimplePdf();
  const margin = 40;
  const contentW = pdf.width - margin * 2;
  const labelW = 170;
  const valueX = margin + labelW + 12;
  const valueW = contentW - labelW - 24;
  let y = 0;

  const logo = loadLogo();
  const logoHandle = logo ? pdf.addJpeg(logo, LOGO_PX_W, LOGO_PX_H) : null;

  const header = () => {
    pdf.rect(0, 0, pdf.width, 78, '#0f172a');
    pdf.rect(0, 78, pdf.width, 4, '#2563eb');
    let textX = margin;
    if (logoHandle !== null) {
      const boxH = 54;
      const logoH = 44;
      const logoW = (logoH * LOGO_PX_W) / LOGO_PX_H;
      const boxW = logoW + 12;
      pdf.rect(margin, 12, boxW, boxH, '#ffffff');
      pdf.drawImage(logoHandle, margin + 6, 17, logoW, logoH);
      textX = margin + boxW + 16;
    }
    pdf.text(textX, 34, 'PG ELECTROPLAST LTD', { size: 18, bold: true, color: '#ffffff' });
    pdf.text(textX, 56, 'A.E.M.S  |  Asset Information Sheet', { size: 10, color: '#cbd5e1' });
    pdf.text(pdf.width - margin - 150, 56, `Generated ${formatDate(new Date().toISOString(), true)}`, {
      size: 8,
      color: '#94a3b8',
    });
    y = 110;
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > pdf.height - 60) {
      pdf.addPage();
      header();
    }
  };

  const section = (title: string) => {
    ensureSpace(50);
    y += 22;
    pdf.text(margin, y, title.toUpperCase(), { size: 10, bold: true, color: '#2563eb' });
    y += 6;
    pdf.line(margin, y, margin + contentW, y, '#bfdbfe', 1);
    y += 4;
  };

  let rowIndex = 0;
  const row = (label: string, value?: string | null) => {
    const text = (value ?? '').toString().trim();
    if (!text) return;
    const lines = wrapText(text, valueW, 10);
    const h = Math.max(22, lines.length * 13 + 9);
    ensureSpace(h);
    if (rowIndex++ % 2 === 0) pdf.rect(margin, y, contentW, h, '#f8fafc');
    pdf.text(margin + 10, y + 15, label, { size: 9, bold: true, color: '#475569' });
    lines.forEach((ln, i) => pdf.text(valueX, y + 15 + i * 13, ln, { size: 10, color: '#0f172a' }));
    y += h;
  };

  header();

  // Title block
  pdf.text(margin, y, asset.name || 'Asset', { size: 16, bold: true });
  y += 22;
  pdf.text(margin, y, asset.asset_tag, { size: 12, bold: true, color: '#2563eb' });
  const status = STATUS_LABELS[asset.status] || asset.status;
  pdf.text(margin + 260, y, `Status: ${status}`, { size: 10, bold: true, color: '#0f766e' });
  y += 14;

  section('Identification');
  rowIndex = 0;
  row('Asset Code / Tag', asset.asset_tag);
  row('Asset Type', displayAssetType(asset));
  row('Manufacturer / Brand', asset.manufacturer);
  row('Model', asset.model);
  row('Serial Number', asset.serial_number);
  row('Hostname', asset.hostname);

  section('Location & Ownership');
  rowIndex = 0;
  row('Department', asset.department?.name);
  row('Location', asset.location?.name);
  row('Plant', asset.plant?.name);
  const emp = asset.assigned_employee;
  row(
    'Assigned To',
    emp ? `${emp.full_name}${emp.emp_code ? ` (${emp.emp_code})` : ''}` : asset.status === 'in_service' ? 'In-house / Department' : 'Not assigned'
  );
  if (emp) {
    row('Employee Email', emp.email);
    row('Designation', emp.designation);
  }

  section('Purchase & Warranty');
  rowIndex = 0;
  row('Purchase Date', formatDate(asset.purchase_date));
  row('Vendor', asset.vendor_name);
  row('Warranty Expiry', formatDate(asset.warranty_expiry));
  row('AMC Vendor', asset.amc_vendor);
  row('AMC Expiry', formatDate(asset.amc_expiry));
  row('Registered On', formatDate(asset.created_at, true));
  row('Last Updated', formatDate(asset.updated_at, true));

  const specs = customFieldRows(asset);
  if (specs.length) {
    section('Specifications');
    rowIndex = 0;
    specs.forEach(([k, v]) => row(k, v));
  }

  const peripherals = (asset.peripherals || []).filter((p) => p.is_included !== false && p.peripheral_name);
  if (peripherals.length) {
    section('Handover Items / Peripherals');
    rowIndex = 0;
    peripherals.forEach((p, i) =>
      row(
        `${i + 1}. ${p.peripheral_name}`,
        [p.model_number && `Model: ${p.model_number}`, p.serial_number && `SN: ${p.serial_number}`]
          .filter(Boolean)
          .join('   ') || 'Included'
      )
    );
  }

  // Footer on the last page
  pdf.line(margin, pdf.height - 44, margin + contentW, pdf.height - 44);
  pdf.text(margin, pdf.height - 30, 'Property of PG Electroplast Ltd - Do not remove the asset tag.', {
    size: 8,
    color: '#64748b',
  });

  return pdf.toBuffer();
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const assetId = verifyAssetQrToken(token);
  if (!assetId) {
    return NextResponse.json({ error: 'Invalid or tampered QR code' }, { status: 404 });
  }

  const asset = await getAssetById(assetId);
  if (!asset || asset.is_deleted) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  const body = buildPdf(asset);
  const fileName = `${asset.asset_tag || 'asset'}.pdf`.replace(/[^A-Za-z0-9._-]/g, '_');
  return new NextResponse(new Uint8Array(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
}
