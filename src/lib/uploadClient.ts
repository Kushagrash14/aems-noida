// Client-side helpers for storing attachments.
// Files go to S3 through /api/uploads; when storage is not configured the
// caller receives the file as a data URL instead (legacy behaviour).

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => (typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read file')));
    reader.onerror = () => reject(reader.error || new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/data:([^;]+)/)?.[1] || 'application/octet-stream';
  const binary = atob(base64 || '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function uploadAttachment(file: Blob, fileName: string): Promise<string> {
  const form = new FormData();
  form.append('file', file, fileName);

  const res = await fetch('/api/uploads', { method: 'POST', body: form, credentials: 'include' });
  if (res.ok) {
    const data = await res.json();
    return data.url as string;
  }
  if (res.status === 503) {
    return readAsDataUrl(file);
  }
  const err = await res.json().catch(() => ({}));
  throw new Error(err.error || 'File upload failed');
}

export async function uploadDataUrl(dataUrl: string, fileName: string): Promise<string> {
  if (!dataUrl.startsWith('data:')) return dataUrl;
  return uploadAttachment(dataUrlToBlob(dataUrl), fileName);
}
