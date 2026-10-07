'use client';

import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { QrCode, ExternalLink, Printer, X, Download } from 'lucide-react';
import { Asset } from '@/types/database';

interface AssetQRCodeProps {
  asset: Asset;
  size?: number;
  showScanModal?: boolean;
  onModalClose?: () => void;
  onSheetUrlChange?: (url: string) => void;
}

export default function AssetQRCode({
  asset,
  size = 96,
  showScanModal = false,
  onModalClose,
  onSheetUrlChange,
}: AssetQRCodeProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [sheetUrl, setSheetUrl] = useState<string>('');
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function generate() {
      try {
        // Scanning opens a formatted PDF info sheet (signed link, no login needed).
        const res = await fetch(`/api/assets/${encodeURIComponent(asset.id)}/qr-token`);
        const data = res.ok ? await res.json() : null;
        const payload: string = data?.url || `${window.location.origin}/assets/${asset.id}`;
        if (cancelled) return;
        setSheetUrl(data?.url || '');
        onSheetUrlChange?.(data?.url || '');

        const url = await QRCode.toDataURL(payload, {
          width: 256,
          margin: 1,
          color: {
            dark: '#0f172a',
            light: '#ffffff',
          },
          errorCorrectionLevel: 'M',
        });
        if (!cancelled) setQrDataUrl(url);
      } catch (err) {
        console.error('Failed to generate QR:', err);
      }
    }

    if (asset?.asset_tag) {
      generate();
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset]);

  const openScan = () => {
    if (sheetUrl) {
      window.open(sheetUrl, '_blank', 'noopener,noreferrer');
    } else {
      setShowModal(true);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Asset Tag - ${asset.asset_tag}</title>
          <style>
            body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #fff; }
            .tag-card { border: 2px solid #0f172a; padding: 16px; border-radius: 12px; width: 320px; text-align: center; }
            .logo { font-size: 14px; font-weight: 900; letter-spacing: 1px; color: #1e3a8a; margin-bottom: 4px; }
            .title { font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 8px; }
            .qr { width: 140px; height: 140px; margin: 0 auto 8px auto; display: block; }
            .code { font-family: monospace; font-size: 14px; font-weight: 900; color: #0f172a; letter-spacing: 1px; }
            .serial { font-size: 10px; color: #64748b; margin-top: 4px; font-family: monospace; }
            .footer { font-size: 9px; color: #94a3b8; margin-top: 8px; border-top: 1px solid #e2e8f0; padding-top: 6px; }
          </style>
        </head>
        <body>
          <div class="tag-card">
            <div class="logo">PG ELECTROPLAST LTD</div>
            <div class="title">${asset.name}</div>
            <img class="qr" src="${qrDataUrl}" alt="${asset.asset_tag}" />
            <div class="code">${asset.asset_tag}</div>
            ${asset.sap_asset_code ? `<div class="code" style="font-size: 11px; color: #b45309; margin-top: 2px;">SAP: ${asset.sap_asset_code}</div>` : ''}
            ${asset.serial_number ? `<div class="serial">SN: ${asset.serial_number}</div>` : ''}
            <div class="footer">Property of PG Electroplast Ltd • DO NOT REMOVE</div>
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <>
      <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-white border border-slate-200 shadow-xs group">
        <div
          onClick={openScan}
          className="cursor-pointer transition-transform group-hover:scale-105"
          title="Click to open the scan page (PDF)"
        >
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt={`QR Code for ${asset.asset_tag}`}
              style={{ width: size, height: size }}
              className="object-contain"
            />
          ) : (
            <div
              style={{ width: size, height: size }}
              className="flex items-center justify-center bg-slate-100 rounded-lg animate-pulse"
            >
              <QrCode className="w-6 h-6 text-slate-400" />
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={openScan}
          className="mt-1 flex items-center gap-1 text-[10px] font-black text-blue-600 hover:text-blue-800 tracking-wider uppercase cursor-pointer"
        >
          <span>OPEN SCAN</span>
          <ExternalLink className="w-2.5 h-2.5" />
        </button>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="mt-0.5 flex items-center gap-1 text-[9px] font-bold text-slate-500 hover:text-slate-800 tracking-wider uppercase cursor-pointer"
          title="View, print or download the QR tag"
        >
          <Printer className="w-2.5 h-2.5" />
          <span>Print Tag</span>
        </button>
      </div>

      {/* QR Code Inspection & Print Modal */}
      {(showModal || showScanModal) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => {
            setShowModal(false);
            onModalClose?.();
          }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full p-6 space-y-4 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                setShowModal(false);
                onModalClose?.();
              }}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-1">
              <span className="text-[10px] font-black tracking-widest text-blue-600 uppercase">
                UNIQUE ASSET QR TAG
              </span>
              <h3 className="text-base font-black text-slate-900 leading-tight">
                {asset.name}
              </h3>
              <p className="text-xs font-mono font-bold text-slate-600">
                {asset.asset_tag}
              </p>
            </div>

            <div className="flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-200 rounded-xl">
              {qrDataUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrDataUrl}
                  alt={asset.asset_tag}
                  className="w-44 h-44 object-contain shadow-xs bg-white p-2 rounded-lg"
                />
              )}
              {asset.sap_asset_code && (
                <span className="text-[11px] font-mono text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 mt-2 font-bold">
                  SAP Code: {asset.sap_asset_code}
                </span>
              )}
              {asset.serial_number && (
                <span className="text-[11px] font-mono text-slate-500 mt-1 font-medium">
                  Serial: {asset.serial_number}
                </span>
              )}
            </div>

            <div className="text-[11px] text-slate-500 text-center leading-snug">
              Scanning this QR opens the asset information sheet as a PDF.
              {sheetUrl && (
                <>
                  {' '}
                  <a href={sheetUrl} target="_blank" rel="noreferrer" className="font-bold text-blue-600 hover:underline">
                    Preview PDF
                  </a>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handlePrint}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Asset Tag</span>
              </button>
              <a
                href={qrDataUrl}
                download={`${asset.asset_tag}-QR.png`}
                className="flex items-center justify-center gap-1 py-2 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                title="Download PNG"
              >
                <Download className="w-3.5 h-3.5" />
                <span>PNG</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
