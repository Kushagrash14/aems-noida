/**
 * Minimal dependency-free PDF writer (A4, built-in Helvetica fonts).
 * Supports text, filled rectangles, lines and automatic page breaks — enough
 * for printable information sheets.
 */

const PAGE_W = 595.28;
const PAGE_H = 841.89;

type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as Rgb;
}

function rgb(hex: string): string {
  return hexToRgb(hex).map((v) => v.toFixed(3)).join(' ');
}

/** PDF base fonts use WinAnsi; anything outside Latin-1 is replaced. */
function pdfString(text: string): string {
  const safe = text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u20B9/g, 'Rs.')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');
  return `(${safe.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')})`;
}

/** Rough Helvetica width estimate (avg glyph ≈ 0.52em, bold ≈ 0.56em). */
export function estimateTextWidth(text: string, size: number, bold = false): number {
  return text.length * size * (bold ? 0.56 : 0.52);
}

export function wrapText(text: string, maxWidth: number, size: number, bold = false): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (estimateTextWidth(candidate, size, bold) <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

export class SimplePdf {
  readonly width = PAGE_W;
  readonly height = PAGE_H;
  private pages: string[][] = [[]];
  private images: { data: Buffer; width: number; height: number }[] = [];

  private get ops(): string[] {
    return this.pages[this.pages.length - 1];
  }

  addPage(): void {
    this.pages.push([]);
  }

  get pageCount(): number {
    return this.pages.length;
  }

  /** y is measured from the top of the page. */
  text(
    x: number,
    y: number,
    text: string,
    opts: { size?: number; bold?: boolean; color?: string } = {}
  ): void {
    const size = opts.size ?? 10;
    const font = opts.bold ? 'F2' : 'F1';
    this.ops.push(
      `BT /${font} ${size} Tf ${rgb(opts.color ?? '#0f172a')} rg ${x.toFixed(2)} ${(PAGE_H - y).toFixed(2)} Td ${pdfString(text)} Tj ET`
    );
  }

  rect(x: number, y: number, w: number, h: number, fill: string): void {
    this.ops.push(`${rgb(fill)} rg ${x.toFixed(2)} ${(PAGE_H - y - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
  }

  line(x1: number, y1: number, x2: number, y2: number, color = '#e2e8f0', width = 0.8): void {
    this.ops.push(
      `${rgb(color)} RG ${width} w ${x1.toFixed(2)} ${(PAGE_H - y1).toFixed(2)} m ${x2.toFixed(2)} ${(PAGE_H - y2).toFixed(2)} l S`
    );
  }

  /** Registers a baseline RGB JPEG for reuse with drawImage(); returns its handle. */
  addJpeg(data: Buffer, pixelWidth: number, pixelHeight: number): number {
    this.images.push({ data, width: pixelWidth, height: pixelHeight });
    return this.images.length - 1;
  }

  drawImage(handle: number, x: number, y: number, w: number, h: number): void {
    this.ops.push(`q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${(PAGE_H - y - h).toFixed(2)} cm /Im${handle} Do Q`);
  }

  toBuffer(): Buffer {
    const objects: string[] = [];
    // 1: catalog, 2: pages, 3: Helvetica, 4: Helvetica-Bold, then page/content pairs, then images
    const pageObjIds = this.pages.map((_, i) => 5 + i * 2);
    const imageObjIds = this.images.map((_, i) => 5 + this.pages.length * 2 + i);
    const xObjects = imageObjIds.length
      ? ` /XObject << ${imageObjIds.map((id, i) => `/Im${i} ${id} 0 R`).join(' ')} >>`
      : '';

    this.images.forEach((img, i) => {
      objects[imageObjIds[i]] =
        `<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.data.length} >>\n` +
        `stream\n${img.data.toString('latin1')}\nendstream`;
    });

    objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objects[2] = `<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${this.pages.length} >>`;
    objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';

    this.pages.forEach((ops, i) => {
      const pageId = pageObjIds[i];
      const contentId = pageId + 1;
      const stream = ops.join('\n');
      objects[pageId] =
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >>${xObjects} >> /Contents ${contentId} 0 R >>`;
      objects[contentId] = `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`;
    });

    let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
    const offsets: number[] = [];
    for (let id = 1; id < objects.length; id++) {
      offsets[id] = Buffer.byteLength(out, 'latin1');
      out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
    }
    const xrefStart = Buffer.byteLength(out, 'latin1');
    out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
    for (let id = 1; id < objects.length; id++) {
      out += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
    }
    out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
    return Buffer.from(out, 'latin1');
  }
}
